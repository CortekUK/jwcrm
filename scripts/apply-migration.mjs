// Apply a SQL file against the Supabase project's Postgres using the
// Management API. Requires SUPABASE_ACCESS_TOKEN (personal access token)
// and NEXT_PUBLIC_SUPABASE_PROJECT_ID in .env.local.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID;
if (!token || !projectRef) {
  console.error('Missing SUPABASE_ACCESS_TOKEN or NEXT_PUBLIC_SUPABASE_PROJECT_ID in .env.local');
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/apply-migration.mjs <path-to-sql>');
  process.exit(1);
}
const query = readFileSync(resolve(file), 'utf8');

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query }),
});
const body = await res.text();
if (!res.ok) {
  console.error(`Failed (${res.status}):`, body);
  process.exit(2);
}
console.log('OK');
console.log(body);
