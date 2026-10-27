#!/usr/bin/env python3
"""Bounded real classroom probe. Credentials remain in memory and are never logged."""
import concurrent.futures
import datetime
import json
import math
from pathlib import Path
import threading
import time
import urllib.error
import urllib.request

BASE = 'http://127.0.0.1:3001'
CODE = 'OMNIQA27'
COUNT = 20
TIMEOUT = 125
PROMPT = 'Réponds exactement ABSTENTION, sans rien ajouter. Ticket : {ticket}'
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'artifacts' / 'qa-classroom-load.json'


def request(method, path, data=None, cookie=None):
    started = time.monotonic()
    headers = {'Content-Type': 'application/json'}
    if cookie:
        headers['Cookie'] = cookie
    payload = None if data is None else json.dumps(data).encode('utf-8')
    req = urllib.request.Request(BASE + path, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
            raw = response.read()
            status = response.status
            private_cookie = response.headers.get('Set-Cookie', '').split(';', 1)[0]
    except urllib.error.HTTPError as error:
        raw = error.read()
        status = error.code
        private_cookie = ''
    except Exception as error:
        return {'status': 0, 'durationMs': round((time.monotonic() - started) * 1000),
                'body': {'error': type(error).__name__}, '_cookie': ''}
    try:
        body = json.loads(raw)
    except Exception:
        body = {'error': 'non_json_response'}
    return {'status': status, 'durationMs': round((time.monotonic() - started) * 1000),
            'body': body, '_cookie': private_cookie}


def public_response(response):
    body = response.get('body', {})
    return {'httpStatus': response['status'], 'durationMs': response['durationMs'],
            'error': body.get('error') if isinstance(body, dict) else 'invalid_response'}


def timings(rows):
    values = sorted(row['durationMs'] for row in rows)
    def percentile(percent):
        if not values:
            return None
        index = (len(values) - 1) * percent
        low = math.floor(index)
        high = math.ceil(index)
        return round(values[low] + (values[high] - values[low]) * (index - low))
    return {'p50Ms': percentile(.5), 'p95Ms': percentile(.95),
            'maxMs': max(values) if values else None}


def main():
    suffix = datetime.datetime.now(datetime.timezone.utc).strftime('%H%M%S')
    report = {'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'base': BASE, 'code': CODE, 'requestedStudents': COUNT,
              'maximumModelCalls': COUNT * 12, 'prompt': PROMPT,
              'automaticRetries': False, 'joins': [], 'evaluations': [], 'availability': []}
    OUT.parent.mkdir(exist_ok=True)
    started = time.monotonic()
    stop = threading.Event()

    def save():
        OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2))

    def monitor():
        while not stop.is_set():
            response = request('GET', '/api/session?code=' + CODE)
            observation = public_response(response)
            observation['elapsedMs'] = round((time.monotonic() - started) * 1000)
            report['availability'].append(observation)
            stop.wait(2)

    before = request('GET', '/api/session?code=' + CODE)
    if before['status'] != 200 or before['body'].get('code') != CODE:
        report['fatal'] = {'stage': 'baseline', **public_response(before)}
        save()
        print('Baseline failed:', json.dumps(report['fatal']), flush=True)
        return
    report['baseline'] = {'participants': before['body'].get('participants'),
                          'status': before['body'].get('status')}
    observer = threading.Thread(target=monitor, daemon=True)
    observer.start()

    def join(index):
        name = f'QA Charge {suffix}-{index:02d}'
        response = request('POST', '/api/join', {'name': name, 'code': CODE})
        return {'name': name, 'privateCookie': response['_cookie'],
                'report': {'name': name, **public_response(response)}}

    print(f'Joining {COUNT} students concurrently on QA {CODE}.', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=COUNT) as pool:
        joined = list(pool.map(join, range(1, COUNT + 1)))
    report['joins'] = [item['report'] for item in joined]
    clients = [item for item in joined if item['report']['httpStatus'] == 200 and item['privateCookie']]
    report['joinSummary'] = {'succeeded': len(clients), 'failed': COUNT - len(clients),
                             **timings(report['joins'])}
    save()
    print('Join summary:', json.dumps(report['joinSummary']), flush=True)

    def evaluate(client):
        response = request('POST', '/api/evaluate', {'level': '1', 'prompt': PROMPT}, client['privateCookie'])
        result = {'name': client['name'], **public_response(response)}
        if response['status'] == 200:
            body = response['body']
            cases = body.get('cases', [])
            correct = sum(c.get('outcome') == 'correct' for c in cases)
            wrong = sum(c.get('outcome') == 'wrong' for c in cases)
            abstained = sum(c.get('outcome') == 'abstain' for c in cases)
            result.update({k: body.get(k) for k in ['id', 'correct', 'wrong', 'abstained', 'points', 'total', 'model']})
            result['countsConsistent'] = (body.get('correct') == correct and body.get('wrong') == wrong
                and body.get('abstained') == abstained and body.get('points') == correct - wrong
                and body.get('total') == len(cases) == 12)
            result['expectedAbstentionScore'] = (body.get('correct') == 1 and body.get('wrong') == 0
                and body.get('abstained') == 11 and body.get('points') == 1)
        own = request('GET', '/api/me', cookie=client['privateCookie'])
        result['persistenceHttpStatus'] = own['status']
        if own['status'] == 200:
            player = own['body'].get('player', {})
            result['playerId'] = player.get('id')
            result['persistedAttempts'] = player.get('attempts')
            result['persistedHistoryCount'] = len(player.get('history', []))
            result['scorePersisted'] = any(item.get('id') == result.get('id') for item in player.get('history', [])) if response['status'] == 200 else None
        return result

    print(f'Evaluating {len(clients)} students concurrently (maximum {len(clients)*12} model calls).', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=COUNT) as pool:
        for result in pool.map(evaluate, clients):
            report['evaluations'].append(result)
            print(f"Student {result['name']}: HTTP {result['httpStatus']} in {result['durationMs']}ms; error={result.get('error')}", flush=True)
            save()
    after = request('GET', '/api/session?code=' + CODE)
    stop.set()
    observer.join(timeout=TIMEOUT + 1)
    leaderboard = after['body'].get('leaderboard', []) if after['status'] == 200 else []
    names = {client['name'] for client in clients}
    rows = [row for row in leaderboard if row.get('name') in names]
    successes = [item for item in report['evaluations'] if item['httpStatus'] == 200]
    report['summary'] = {'joinSucceeded': len(clients), 'joinFailed': COUNT - len(clients),
        'evaluationsSucceeded': len(successes), 'evaluationsFailed': len(clients) - len(successes),
        'correctCountAndPoints': sum(item.get('countsConsistent', False) for item in successes),
        'expectedAbstentionScores': sum(item.get('expectedAbstentionScore', False) for item in successes),
        'scoresPersisted': sum(item.get('scorePersisted', False) for item in successes),
        'leaderboardEntriesForCohort': len(rows),
        'uniqueLeaderboardPlayers': len({row.get('id') for row in rows}),
        'availabilitySamples': len(report['availability']),
        'availabilityErrors': sum(item['httpStatus'] != 200 for item in report['availability']),
        'evaluationTimings': timings(report['evaluations']),
        'elapsedMs': round((time.monotonic() - started) * 1000),
        'scope': 'One bounded burst of up to 20 students; not an unlimited scalability guarantee.'}
    save()
    print('Final summary:', json.dumps(report['summary'], ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
