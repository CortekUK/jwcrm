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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2] || 'admin@justwills.com';
const roles = (process.argv[3] || 'superadmin,admin,hr,finance,lead_management,salesperson').split(',').map(r => r.trim()).filter(Boolean);

const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

const u = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers: h }).then(r => r.json());
const user = (u.users || u).find(x => x.email?.toLowerCase() === email.toLowerCase());
if (!user) { console.error('user not found:', email); process.exit(1); }
console.log('user_id:', user.id);

const rows = roles.map(role => ({ user_id: user.id, role }));
const res = await fetch(`${url}/rest/v1/user_roles?on_conflict=user_id,role`, {
  method: 'POST',
  headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(rows),
});
if (!res.ok) { console.error('upsert failed:', res.status, await res.text()); process.exit(1); }
console.log('granted:', roles.join(', '));

const final = await fetch(`${url}/rest/v1/user_roles?user_id=eq.${user.id}&select=role`, { headers: h }).then(r => r.json());
console.log('current roles:', final.map(r => r.role).join(', '));
