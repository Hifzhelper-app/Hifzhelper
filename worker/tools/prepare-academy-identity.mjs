import { readFile, writeFile } from 'node:fs/promises';
import { buildIdentityPlan } from './academy-identity.mjs';

// Preparation only. There is deliberately no remote-write or deployment mode.
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs,value,index,list) => {
  if (index % 2 === 0) pairs.push([value,list[index+1]]);
  return pairs;
},[]));
if (!args['--hifz'] || !args['--academy'] || !args['--environment'] || !args['--output']) {
  throw new Error('Use --hifz snapshot.json --academy snapshot.json --environment development|production --output plan.json');
}
const rows = async file => {
  const data = JSON.parse(await readFile(file,'utf8'));
  return Array.isArray(data) ? data : data.rows;
};
const plan = buildIdentityPlan(await rows(args['--hifz']), await rows(args['--academy']), args['--environment']);
await writeFile(args['--output'],JSON.stringify(plan,null,2) + '\n',{mode:0o600});
console.log(JSON.stringify({environment:plan.environment,mappedProfiles:plan.mappings.length,retainedInactive:plan.retainedInactive.length,output:args['--output']}));
