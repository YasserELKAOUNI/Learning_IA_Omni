import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mutate,load,writeEtag} from '../lib/store';

test('Le CAS utilise le tag fort même quand la compression HTTP affaiblit le GET',()=>{assert.equal(writeEtag('W/"version"'),'"version"');assert.equal(writeEtag('"version"'),'"version"');});

test('Des inscriptions concurrentes ne perdent aucune écriture',async()=>{const key=`tests/${randomUUID()}.json`;await Promise.all(Array.from({length:25},(_,i)=>mutate<{ids:number[]},number>(key,()=>({ids:[]}),s=>{s.ids.push(i);return s.ids.length;})));const state=await load<{ids:number[]}>(key);assert.equal(state?.ids.length,25);assert.equal(new Set(state?.ids).size,25);});
test('Les écritures de chemins arbitraires sont rejetées',async()=>{await assert.rejects(load('../outside.json'));});
