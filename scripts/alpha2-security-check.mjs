import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const migration = read('supabase/migrations/20260819180000_alpha2_auth_couples.sql')
const client = read('src/cloud/supabaseClient.ts')
const gateway = read('src/cloud/SupabaseAccountGateway.ts')
const panel = read('src/components/CloudAccountPanel.tsx')
const envExample = read('.env.example')
const opening = read('src/features/opening/OpeningScreen.tsx')
const viteConfig = read('vite.config.ts')
const serviceWorker = read('public/sw.js')
const packageMetadata = JSON.parse(read('package.json'))
const app = read('src/app/App.tsx')
const authModal = read('src/components/CloudAccountModal.tsx')

for (const table of ['profiles', 'couples', 'couple_members', 'couple_invites']) {
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'), `${table} must enable RLS.`)
}

assert.match(migration, /user_id uuid primary key references auth\.users\(id\)/i, 'Profiles must use Supabase Auth UUIDs.')
assert.match(migration, /future_with_you_profile_on_auth_user_created/i, 'New Auth users must receive profiles.')
assert.match(migration, /code_hash text not null unique/i, 'Invite codes must only be stored as hashes.')
assert.match(migration, /expires_at > now\(\)/i, 'Invite redemption must enforce expiry.')
assert.match(migration, /couple_members_one_active_couple_per_user/i, 'Users must have at most one active couple.')
assert.match(migration, /couple_members_one_active_user_per_slot/i, 'A couple must have at most two active slots.')
assert.match(migration, /security definer[\s\S]*set search_path = ''/i, 'Privileged RPCs need a fixed empty search path.')
assert.match(migration, /revoke all on table public\.couple_invites from anon, authenticated/i, 'Invite rows must not be directly readable.')
assert.doesNotMatch(migration, /grant\s+(?:select|insert|update|delete)[^;]*couple_invites/i, 'Invite rows must only be accessed through RPCs.')

assert.match(client, /sb_publishable_/, 'The browser client must reject non-publishable keys.')
assert.match(client, /persistSession:\s*true/, 'Auth sessions must persist safely across reloads.')
assert.match(gateway, /join_couple_by_code/, 'The Supabase gateway must use the protected invite RPC.')
assert.match(panel, /愿望、回忆与照片仍以本机为准/, 'Alpha 2 UI must not imply that local stories are already synced.')
assert.doesNotMatch(`${client}\n${gateway}\n${envExample}`, /sb_secret_|service_role|SUPABASE_SECRET/i, 'Browser code and examples must never mention a privileged key.')
assert.equal(packageMetadata.releaseChannel, 'ALPHA 2', 'Package metadata must identify the current release channel.')
assert.match(viteConfig, /__APP_RELEASE_LABEL__/, 'Vite must inject release metadata from package.json.')
assert.match(opening, /__APP_RELEASE_LABEL__/, 'The opening letter must use injected release metadata.')
assert.doesNotMatch(opening, /V0\.2/, 'The opening letter must not retain the stale V0.2 label.')
assert(serviceWorker.includes(packageMetadata.version), 'The PWA cache must advance with the package version.')
assert.match(app, /cloudWelcomeOpen[\s\S]*CloudAccountModal/, 'Cloud Preview must surface Auth after entering the gift.')
assert.match(app, /sessionStorage/, 'The optional cloud welcome should only dismiss for the current browser session.')
assert.match(authModal, /暂时使用本地模式/, 'Offline-first mode must remain available without forcing cloud login.')

console.log('Alpha 2 security check passed for Auth, profiles, couples, invites, browser key boundaries, and release branding.')
