// One-off: copies diagrams from the old local SQLite database (data/devart.db) into Supabase.
//
//   npm run import:local -- --email you@gmail.com [--db data/devart.db] [--include-deleted] [--dry-run]
//
// The person must have signed in to the deployed app with Google once, so their account exists.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example). Safe to re-run: diagrams already imported are skipped.
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const { values: o } = parseArgs({
  options: {
    email: { type: 'string' },
    db: { type: 'string', default: 'data/devart.db' },
    'include-deleted': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});

const die = (m: string): never => { console.error(m); process.exit(1); };
if (!o.email) die('Pass --email with the Google account that should own the diagrams.');
if (!existsSync(o.db!)) die(`No database at ${o.db}`);

const db = new DatabaseSync(o.db!, { readOnly: true });
const rows = db.prepare('SELECT id, title, canvas, created_at, updated_at, deleted_at FROM files ORDER BY created_at').all() as {
  id: string; title: string; canvas: string; created_at: number; updated_at: number; deleted_at: number | null;
}[];

const iso = (ms: number) => new Date(ms).toISOString();
const wanted = rows.filter((r) => {
  if (r.deleted_at && !o['include-deleted']) return false;
  // Same rule as the home page: an untouched blank drawing isn't worth keeping.
  return !(r.canvas === '[]' && r.title === 'Untitled architecture');
});
console.log(`${rows.length} diagrams in ${o.db}; importing ${wanted.length}${o['include-deleted'] ? '' : ' (skipping deleted and blank ones)'}:`);
for (const r of wanted) console.log(`  - ${r.title}${r.deleted_at ? ' (deleted)' : ''}`);
if (o['dry-run']) die('Dry run: nothing uploaded.');

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) die('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.');
const supabase = createClient(url!, key!, { auth: { persistSession: false } });

const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listError) die(`Could not look up users: ${listError.message}`);
const user = list.users.find((u) => u.email?.toLowerCase() === o.email!.toLowerCase());
if (!user) die(`${o.email} has not signed in yet. Sign in to the app with Google once, then run this again.`);

const records = wanted.map((r) => ({
  owner_id: user!.id,
  legacy_id: r.id,
  title: r.title.slice(0, 200) || 'Untitled',
  canvas: JSON.parse(r.canvas),
  created_at: iso(r.created_at),
  updated_at: iso(r.updated_at),
  deleted_at: r.deleted_at ? iso(r.deleted_at) : null,
}));
const { data: inserted, error } = await supabase.from('files').upsert(records, { onConflict: 'owner_id,legacy_id', ignoreDuplicates: true }).select('id');
if (error) die(`Upload failed: ${error.message}`);
const added = inserted?.length ?? 0;
console.log(`Imported ${added} new diagram(s); ${records.length - added} were already there.`);
