import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const packageMetadata = JSON.parse(read('package.json'))
const envExample = read('.env.example')
const backendConfig = read('src/config/backend.ts')
const factory = read('src/cloud/accountGatewayFactory.ts')
const client = read('src/cloud/cloudbaseClient.ts')
const gateway = read('src/cloud/CloudBaseAccountGateway.ts')
const captcha = read('src/cloud/cloudbaseCaptcha.ts')
const authModal = read('src/components/CloudAccountModal.tsx')
const otpModal = read('src/components/CloudBaseEmailVerificationModal.tsx')
const captchaChallenge = read('src/components/CloudBaseCaptchaChallenge.tsx')
const panel = read('src/components/CloudAccountPanel.tsx')
const migration = read('backend/cloudbase-pg/migrations/0002_alpha3_mainland_auth_hardening.sql')
const runbook = read('docs/ALPHA3_CLOUDBASE_RUNBOOK.md')
const architecture = read('docs/V0.5.0_ARCHITECTURE.md')
const workflow = read('.github/workflows/alpha3-ci.yml')
const serviceWorker = read('public/sw.js')

assert.equal(packageMetadata.version, '0.5.0-dev.7', 'Alpha 3 must have an explicit prerelease version.')
assert.equal(packageMetadata.releaseChannel, 'ALPHA 3', 'Package metadata must identify Alpha 3.')
assert.match(packageMetadata.dependencies['@cloudbase/js-sdk'], /^\^3\.8\.0$/, 'CloudBase Web SDK 3.8.x must be pinned in package metadata.')
assert.equal(packageMetadata.scripts['test:alpha3'], 'node scripts/alpha3-mainland-check.mjs')
assert(serviceWorker.includes(packageMetadata.version), 'The PWA cache name must advance with the release version.')

assert.match(backendConfig, /'cloudbase-pg'/, 'CloudBase PG must be a selectable backend provider.')
assert.match(backendConfig, /VITE_CLOUDBASE_ENV_ID/, 'CloudBase environment ID must be configured at build time.')
assert.match(backendConfig, /VITE_CLOUDBASE_PUBLISHABLE_KEY/, 'CloudBase browser key must be configured at build time.')
assert.doesNotMatch(
  `${envExample}\n${backendConfig}\n${client}`,
  /VITE_CLOUDBASE_(?:SECRET|PRIVATE|ADMIN|SERVER)/i,
  'No privileged CloudBase credential may be exposed through VITE variables.',
)

assert.match(factory, /import\('\.\/cloudbaseClient'\)/, 'CloudBase must load only when its provider is selected.')
assert.match(factory, /import\('\.\/supabaseClient'\)/, 'Supabase must remain a separately loaded rollback provider.')
assert.doesNotMatch(factory, /import\s+\{[^}]*getCloudBaseClientState[^}]*\}\s+from/, 'CloudBase must not inflate the default bundle.')
assert.doesNotMatch(captcha, /@cloudbase\/js-sdk/, 'The CAPTCHA UI bridge must not pull CloudBase into the default bundle.')
assert.match(client, /accessKey:\s*backendConfig\.cloudbase\.publishableKey/, 'The SDK must receive only the publishable browser key.')
assert.match(client, /persistence:\s*'local'/, 'CloudBase sessions must survive a safe page reload.')

assert.match(gateway, /auth\.signUp\(/, 'CloudBase registration must use the v3 Auth API.')
assert.match(gateway, /verifyOtp\(\{\s*token:/, 'Email registration must complete through OTP verification.')
assert.match(gateway, /signInWithPassword\(/, 'CloudBase password login must be implemented.')
for (const rpc of ['create_couple_space', 'create_couple_invite', 'join_couple_by_code', 'leave_couple_space']) {
  assert.match(gateway, new RegExp(`rpc\\('${rpc}'`), `CloudBase gateway must call protected RPC ${rpc}.`)
}

assert.match(captcha, /openURIWithCallback/, 'Risk CAPTCHA must be bridged from the CloudBase SDK.')
assert.match(captcha, /parseCaptcha/, 'CloudBase CAPTCHA URLs must be parsed by the SDK.')
assert.match(captcha, /verifyCaptchaData/, 'CAPTCHA answers must be verified by CloudBase.')
assert.match(authModal, /CloudBaseCaptchaChallenge/, 'Auth UI must render a CloudBase challenge when requested.')
assert.doesNotMatch(captchaChallenge, /<form[\s>]/, 'The CloudBase challenge must not nest a form inside the Auth form.')
assert.match(otpModal, /autoComplete="one-time-code"/, 'The OTP form must support mobile one-time-code autofill.')
assert.match(panel, /愿望、回忆与照片仍以本机为准/, 'Alpha 3 must not imply that local stories are already uploaded.')

for (const rpc of ['create_couple_space', 'create_couple_invite', 'join_couple_by_code', 'leave_couple_space']) {
  const functionPattern = new RegExp(
    `create or replace function public\\.${rpc}\\([\\s\\S]*?\\$\\$;`,
    'i',
  )
  const definition = migration.match(functionPattern)?.[0] ?? ''
  assert(definition, `Migration must redefine ${rpc}.`)
  assert.match(definition, /if not public\.is_authenticated_request\(\)/i, `${rpc} must validate the JWT role inside the function.`)
}
assert.match(migration, /request\.jwt\.claims/, 'The hardening migration must inspect verified JWT claims.')
assert.match(migration, /revoke all on function public\.create_couple_space[\s\S]*from public, anon/i, 'Anonymous RPC execution must be revoked.')
assert.match(migration, /char_length\(btrim\(space_name\)\) > 80/, 'The privileged create RPC must cap space names server-side.')
assert.match(migration, /char_length\(coalesce\(space_greeting, ''\)\) > 240/, 'The privileged create RPC must cap greetings server-side.')

assert.match(architecture, /一个情侣空间只能选择一个权威后端/, 'Architecture must prohibit cross-cloud dual writes.')
assert.match(runbook, /dev[^\n]*测试/, 'The runbook must keep dev on a test deployment.')
assert.match(runbook, /main[^\n]*正式/, 'The runbook must reserve main for production.')
assert.match(runbook, /npm ci/, 'CloudBase builds must use reproducible dependency installation.')
assert.match(runbook, /dist/, 'CloudBase static hosting must publish the Vite dist directory.')
assert.match(runbook, /不得跨云双写/, 'The operational runbook must preserve one canonical data source.')
assert.match(workflow, /npm ci/, 'CI must install from the lockfile.')
assert.match(workflow, /npm run test:alpha3/, 'CI must run Alpha 3 mainland checks.')
assert.match(workflow, /npm run build/, 'CI must verify the production build.')

console.log('Alpha 3 mainland check passed: CloudBase Auth/OTP, built-in risk CAPTCHA, protected couple RPCs, provider isolation, deployment gates, and PWA versioning are all present.')
