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
const cloudErrors = read('src/cloud/friendlyCloudError.ts')
const captchaConfig = read('src/cloud/captchaConfig.ts')
const captchaChallenge = read('src/components/CaptchaChallenge.tsx')
const syncContract = read('src/sync/SyncGateway.ts')

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
assert.match(packageMetadata.releaseChannel, /^ALPHA [23]$/, 'Alpha 2 security regressions must remain active in Alpha 2 or Alpha 3.')
assert.match(viteConfig, /__APP_RELEASE_LABEL__/, 'Vite must inject release metadata from package.json.')
assert.match(opening, /__APP_RELEASE_LABEL__/, 'The opening letter must use injected release metadata.')
assert.doesNotMatch(opening, /V0\.2/, 'The opening letter must not retain the stale V0.2 label.')
assert(serviceWorker.includes(packageMetadata.version), 'The PWA cache must advance with the package version.')
assert.match(app, /cloudWelcomeOpen[\s\S]*CloudAccountModal/, 'Cloud Preview must surface Auth after entering the gift.')
assert.match(app, /sessionStorage/, 'The optional cloud welcome should only dismiss for the current browser session.')
assert.match(authModal, /暂时使用本地模式/, 'Offline-first mode must remain available without forcing cloud login.')
assert.match(authModal, /CaptchaChallenge/, 'Cloud Auth must render the configured CAPTCHA challenge.')
assert.match(authModal, /captchaConfig\.enabled && !captchaToken/, 'Cloud Auth must wait for a CAPTCHA token before submission.')
assert.equal((gateway.match(/captchaToken:\s*input\.captchaToken/g) ?? []).length, 2, 'Sign-up and sign-in must both forward CAPTCHA tokens.')
assert.match(syncContract, /interface SignUpInput[\s\S]*captchaToken\?: string/, 'Sign-up input must carry a CAPTCHA token.')
assert.match(syncContract, /interface SignInInput[\s\S]*captchaToken\?: string/, 'Sign-in input must carry a CAPTCHA token.')
assert.match(captchaChallenge, /HCaptcha/, 'The frontend must support the hCaptcha provider.')
assert.match(captchaChallenge, /Turnstile/, 'The frontend must support the Turnstile provider.')
assert.match(captchaChallenge, /onExpire/, 'Expired CAPTCHA tokens must be cleared.')
assert.match(captchaChallenge, /onError/, 'CAPTCHA loading or verification errors must be handled.')
assert.match(captchaConfig, /VITE_SUPABASE_CAPTCHA_PROVIDER[\s\S]*VITE_SUPABASE_CAPTCHA_SITE_KEY/, 'CAPTCHA provider and public Site Key must come from environment config.')
assert.doesNotMatch(`${captchaConfig}\n${captchaChallenge}\n${envExample}`, /VITE_[A-Z0-9_]*(?:SECRET|PRIVATE)/i, 'No CAPTCHA secret may enter browser environment variables.')

for (const authErrorCode of [
  'captcha_failed',
  'email_address_not_authorized',
  'over_email_send_rate_limit',
  'email_not_confirmed',
  'weak_password',
  'unexpected_failure',
]) {
  assert.match(cloudErrors, new RegExp(`\\b${authErrorCode}\\b`), `Auth error ${authErrorCode} must have a safe localized mapping.`)
}
assert.match(cloudErrors, /错误码：/, 'Unknown cloud failures must retain a safe diagnostic code.')
assert.doesNotMatch(cloudErrors, /return raw|return message/, 'Raw provider or database errors must not be shown directly.')

console.log('Alpha 2 security check passed for Auth, CAPTCHA token forwarding, safe error diagnostics, profiles, couples, invites, browser key boundaries, and release branding.')
