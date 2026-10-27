import type {RunResult,PublicRunResult} from './catalog';

/** Keep hidden inputs and answer keys on the server, including for historical runs. */
export function publicRun(run:RunResult):PublicRunResult {
 return {...run,cases:run.cases.map(({id,tier,outcome,actual,reason,hint})=>({id,tier,outcome,actual,reason,hint}))};
}
