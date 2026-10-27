import test from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS,unlocked,ranked,type Session,type Player,type Score} from '../lib/catalog';
import {getCases} from '../lib/cases';
import {grade,summarize} from '../lib/grader';
import {messagesFor} from '../lib/model';
import {validateUpload} from '../lib/uploads';

test('Tous les corrigés sont acceptés et les jeux contiennent les trois difficultés',()=>{for(const level of LEVELS){const cases=getCases(level.id);assert.equal(cases.length,level.count);assert.equal(new Set(cases.map(c=>c.id)).size,cases.length);assert.equal(summarize(cases.map(c=>grade(level.id,c,c.expected))).correct,level.count);assert.ok(cases.some(c=>c.tier==='facile'));assert.ok(cases.some(c=>c.tier==='piège'));}});
test('Le correcteur refuse les réponses bavardes même si les bons mots sont présents',()=>{const c=getCases('1')[0];assert.equal(grade('1',c,`${c.expected}. C’est une panne réseau bloquante.`).outcome,'wrong');assert.equal(grade('1',c,c.expected+'\n').outcome,'correct');});
test('JSON : ordre des clés libre, types et clés supplémentaires stricts',()=>{const c=getCases('2')[0],correct=JSON.parse(c.expected);const reverse=Object.fromEntries(Object.entries(correct).reverse());assert.equal(grade('2',c,JSON.stringify(reverse)).outcome,'correct');assert.equal(grade('2',c,JSON.stringify({...correct,commentaire:'ok'})).outcome,'wrong');assert.equal(grade('2',c,JSON.stringify({...correct,delai_heures:'null'})).outcome,'wrong');assert.equal(grade('2',c,'```json\n'+c.expected+'\n```').outcome,'wrong');});
test('Abstention volontaire neutre, abstention justifiée correcte, erreur négative',()=>{const cases=getCases('1');const a=grade('1',cases[0],'ABSTENTION'),b=grade('1',cases.at(-1)!,'ABSTENTION'),c=grade('1',cases[0],'logiciel / basse');assert.equal(a.outcome,'abstain');assert.equal(b.outcome,'correct');assert.deepEqual(summarize([a,b,c]),{correct:1,wrong:1,abstained:1,points:0,total:3});});
test('Le niveau système utilise réellement system et les autres niveaux isolent chaque ticket',()=>{assert.deepEqual(messagesFor('5','POLITIQUE','demande'),[{role:'system',content:'POLITIQUE'},{role:'user',content:'demande'}]);assert.deepEqual(messagesFor('1','Ticket : {ticket}','VPN'),[{role:'user',content:'Ticket : VPN'}]);assert.equal(messagesFor('6','{ticket}','incident','responsable')[0].role,'system');});
test('Dépôts : types limités et limite réelle à 3 Mo',()=>{assert.equal(validateUpload('rapport.PDF',100),'application/pdf');assert.throws(()=>validateUpload('script.html',100));assert.throws(()=>validateUpload('rapport.pdf',3*1024*1024+1));assert.throws(()=>validateUpload('vide.txt',0));});
