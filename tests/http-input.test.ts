import test from 'node:test';
import assert from 'node:assert/strict';
import {sameOrigin,body} from '../lib/http';
test('Les formulaires utilisent le Host visible par le navigateur derrière Next',()=>{assert.doesNotThrow(()=>sameOrigin(new Request('http://localhost:3001/api/join',{headers:{host:'127.0.0.1:3001',origin:'http://127.0.0.1:3001'}})));});
test('Une origine étrangère est refusée même derrière un proxy',()=>{assert.throws(()=>sameOrigin(new Request('https://internal.example/api/join',{headers:{host:'atelier.example',origin:'https://evil.example'}})));assert.doesNotThrow(()=>sameOrigin(new Request('https://internal.example/api/join',{headers:{host:'atelier.example',origin:'https://atelier.example'}})));});
test('Un corps JSON doit être un objet',async()=>{for(const value of [null,[],true,3,'texte'])await assert.rejects(body(new Request('http://localhost/api',{method:'POST',body:JSON.stringify(value)})));assert.deepEqual(await body(new Request('http://localhost/api',{method:'POST',body:'{"name":"Salma"}'})),{name:'Salma'});});
