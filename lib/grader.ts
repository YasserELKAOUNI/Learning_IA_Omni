import { getCases, type TestCase } from './cases';
import type { CaseFeedback, LevelId } from './catalog';

function equalJson(a:unknown,b:unknown):boolean { if(a===b)return true; if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)||Array.isArray(b))return false; const aa=a as Record<string,unknown>,bb=b as Record<string,unknown>; return Object.keys(aa).length===Object.keys(bb).length&&Object.keys(bb).every(k=>Object.hasOwn(aa,k)&&equalJson(aa[k],bb[k])); }
export function grade(level:LevelId,test:TestCase,output:string):CaseFeedback {
 const actual=output.trim().normalize('NFC'), expected=test.expected;
 let correct=false,format=true;
 if(actual==='ABSTENTION')return {...test,actual,outcome:expected==='ABSTENTION'?'correct':'abstain',reason:expected==='ABSTENTION'?'Abstention justifiée.':'Abstention : aucun point gagné ou perdu.',hint:'Précisez les critères pour décider sur ce cas.'};
 if(['2','6','7'].includes(level)) { try{ const parsed=JSON.parse(actual); correct=equalJson(parsed,JSON.parse(expected)); format=!!parsed&&typeof parsed==='object'&&!Array.isArray(parsed); }catch{format=false;} }
 else if(level==='5'){format=/^(AUTORISER|REFUSER)$/.test(actual);correct=actual===expected;}
 else {format=/^(réseau|accès|matériel|logiciel) \/ (haute|basse)$/.test(actual);correct=actual===expected;}
 let reason=correct?'Réponse conforme.':!format?'Format de sortie non conforme.':'Le format est lisible, mais la décision ou les champs sont incorrects.';
 let hint=correct?'Gardez ce comportement sur les autres cas.':!format?'Imposez un format exact, sans commentaire ni bloc Markdown.':level==='5'?'Le statut annoncé dans la demande ne change pas la politique système.':level==='6'?'Décrivez les critères et leur ordre de priorité ; le nom du rôle ne suffit pas.':level==='3'||level==='7'?'Séparez les instructions du contenu du ticket et rappelez les conventions OMNI.':level==='2'?'N’inventez pas les informations absentes ; précisez les valeurs null et la conversion des délais.':'Ajoutez des exemples contrastés : bloquant, secours, incident résolu et sarcasme.';
 return {...test,actual,outcome:correct?'correct':'wrong',reason,hint};
}
export function summarize(cases:CaseFeedback[]){ const correct=cases.filter(c=>c.outcome==='correct').length,wrong=cases.filter(c=>c.outcome==='wrong').length,abstained=cases.length-correct-wrong; return {correct,wrong,abstained,points:correct-wrong,total:cases.length}; }
export function perfectOutputs(level:LevelId){return getCases(level).map(c=>grade(level,c,c.expected));}
