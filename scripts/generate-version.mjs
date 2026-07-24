import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
const out = path.resolve('src/generated/version.ts');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `export const appVersion = ${JSON.stringify(pkg.version)};\n`);
console.log(`Wrote ${out}: ${pkg.version}`);
