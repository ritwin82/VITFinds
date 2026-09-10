import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const [stack, region] = process.argv.slice(2);
if (!stack || !region || !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(stack) || !/^[a-z]{2}-[a-z]+-\d$/.test(region)) throw new Error('Usage: node scripts/configure-aws.mjs <stack-name> <region>');
const result = JSON.parse(execFileSync('aws', ['cloudformation', 'describe-stacks', '--stack-name', stack, '--region', region, '--output', 'json'], { encoding: 'utf8' }));
const output = Object.fromEntries(result.Stacks[0].Outputs.map(x => [x.OutputKey, x.OutputValue]));
for (const key of ['ApiUrl','UserPoolClientId','SiteUrl','SiteBucket']) if (!output[key]) throw new Error(`Missing stack output ${key}`);
await writeFile('dist/config.js', `window.VITFINDS_CONFIG = ${JSON.stringify({ apiUrl: output.ApiUrl, region, userPoolClientId: output.UserPoolClientId, imageBaseUrl: output.SiteUrl })};\n`);
console.log(`Frontend configured in dist/config.js. Upload dist/ to ${output.SiteBucket}. Site: ${output.SiteUrl}`);
