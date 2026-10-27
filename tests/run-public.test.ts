import test from 'node:test';
import assert from 'node:assert/strict';
import {publicRun} from '../lib/run-public';
import type {RunResult} from '../lib/catalog';

const full:RunResult={id:'run',level:'1',correct:0,wrong:1,abstained:0,points:-1,total:1,length:6,prompt:'classe',role:'',model:'gpt-4o-mini',createdAt:1,durationMs:10,cases:[{id:'1-01',tier:'piège',input:'ticket serveur confidentiel',expected:'réseau / haute',actual:'logiciel / basse',outcome:'wrong',reason:'Décision incorrecte.',hint:'Appliquez les conventions OMNI.'}]};
test('La réponse participant expose seulement les six champs de feedback autorisés',()=>{const result=publicRun(full);assert.deepEqual(Object.keys(result.cases[0]).sort(),['id','tier','outcome','actual','reason','hint'].sort());assert.equal(result.cases[0].actual,full.cases[0].actual);assert.equal(result.points,full.points);assert.equal(JSON.stringify(result).includes('ticket serveur confidentiel'),false);assert.equal(JSON.stringify(result).includes('réseau / haute'),false);});
test('Le run complet enregistré pour l’animateur reste intact',()=>{const snapshot=structuredClone(full);publicRun(full);assert.deepEqual(full,snapshot);assert.equal(full.cases[0].input,'ticket serveur confidentiel');assert.equal(full.cases[0].expected,'réseau / haute');});
