import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const sql = read('backend/cloudbase-pg/migrations/0001_v050_foundation.sql')
const envExample = read('.env.example')
const architecture = read('docs/V0.5.0_ARCHITECTURE.md')
const domain = read('src/domain/cloud.ts')

const coupleOwnedTables = [
  'wishes',
  'memories',
  'memory_media',
  'daily_answers',
  'anniversaries',
  'time_capsules',
  'notifications',
  'migration_runs',
  'sync_operations',
  'sync_events',
]

for (const table of coupleOwnedTables) {
  const tablePattern = new RegExp(`create table public\\.${table} \\([^;]*?couple_id uuid not null`, 'i')
  assert.match(sql, tablePattern, `${table} must be owned by couple_id.`)
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'), `${table} must enable RLS.`)
}

assert.doesNotMatch(sql, /where\s+user_id\s*=\s*user_id/i, 'SQL must not contain a shadowed identity comparison.')
assert.match(sql, /code_hash text not null unique/i, 'Invite codes must be stored as hashes.')
assert.match(sql, /deleted_at timestamptz/i, 'Shared entities need deletion tombstones.')
assert.match(sql, /revision bigint not null default 1/i, 'Shared entities need optimistic revisions.')
assert.match(sql, /create table public\.sync_events/i, 'The global incremental event log is required.')
assert.match(domain, /'memory_media'/, 'Media changes must be a first-class sync entity.')

assert.match(envExample, /^VITE_BACKEND_PROVIDER=local$/m, 'Local mode must remain the safe default.')
assert.doesNotMatch(envExample, /SERVICE_ROLE|API_KEY=/, 'Administrator keys must never be suggested to the browser.')
assert.match(architecture, /Vercel Preview/, 'The deployment guide must document the Vercel preview workflow.')
assert.match(architecture, /retain|保留 V0\.4 本地快照/i, 'The migration guide must preserve the local source until verification.')

console.log(`V0.5 foundation check passed for ${coupleOwnedTables.length} couple-owned tables.`)
