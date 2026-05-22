import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Tiny .env.local loader (no dep)
const envPath = resolve(__dirname, '..', '.env.local');
const envText = readFileSync(envPath, 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
  if (!m) continue;
  let value = m[2];
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!process.env[m[1]]) process.env[m[1]] = value;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const role = process.argv[2] || 'admin';
const email = process.argv[3] || `${role}@justwills.com`;
const password = process.argv[4] || `${role}123`;
const fullName = process.argv[5] || `${role.charAt(0).toUpperCase() + role.slice(1)} User`;

const authHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function findUserByEmail(email) {
  const res = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: authHeaders,
  });
  if (!res.ok) throw new Error(`listUsers ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const users = body.users || body;
  return users.find?.((u) => u.email?.toLowerCase() === email.toLowerCase()) || null;
}

async function createUser(email, password) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body.msg || body.message || body.error || JSON.stringify(body);
    return { user: null, error: { status: res.status, message: msg } };
  }
  return { user: body, error: null };
}

let userId;
const created = await createUser(email, password);
if (created.error) {
  if (/already (registered|exists|been registered)/i.test(created.error.message) || created.error.status === 422) {
    console.log('User already exists — ensuring admin role.');
    const existing = await findUserByEmail(email);
    if (!existing) {
      console.error('Could not locate existing user:', created.error.message);
      process.exit(1);
    }
    userId = existing.id;
  } else {
    console.error('Failed to create user:', created.error.message);
    process.exit(1);
  }
} else {
  userId = created.user.id;
  console.log('Created auth user:', userId);
}

// Upsert profile via PostgREST (in case the trigger did not run, e.g. for pre-existing user)
const profileRes = await fetch(`${url}/rest/v1/profiles?on_conflict=user_id`, {
  method: 'POST',
  headers: {
    ...authHeaders,
    Prefer: 'resolution=merge-duplicates,return=minimal',
  },
  body: JSON.stringify({ user_id: userId, full_name: fullName }),
});
if (!profileRes.ok) console.warn('profile upsert warn:', profileRes.status, await profileRes.text());

// Upsert user_roles row
const roleRes = await fetch(`${url}/rest/v1/user_roles?on_conflict=user_id,role`, {
  method: 'POST',
  headers: {
    ...authHeaders,
    Prefer: 'resolution=merge-duplicates,return=minimal',
  },
  body: JSON.stringify({ user_id: userId, role }),
});
if (!roleRes.ok) console.warn('user_roles upsert warn:', roleRes.status, await roleRes.text());

console.log('\nUser ready:');
console.log('  role    :', role);
console.log('  email   :', email);
console.log('  password:', password);
console.log('  user_id :', userId);
