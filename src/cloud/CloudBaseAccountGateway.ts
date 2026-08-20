import type { AccountIdentity, CloudSession, CoupleMember, CoupleSpace } from '../domain/cloud'
import type {
  AuthGateway,
  CoupleContext,
  CoupleGateway,
  CreateCoupleInput,
  SignInInput,
  SignUpInput,
  SignUpResult,
} from '../sync/SyncGateway'
import type { CloudBaseApp } from './cloudbaseClient'

interface ProfileRow {
  user_id: string
  display_name: string
  avatar_path: string | null
}

interface CoupleRow {
  id: string
  name: string
  greeting: string
  status: 'active' | 'archived'
  created_by: string
  created_at: string
  updated_at: string
}

interface MemberRow {
  couple_id: string
  user_id: string
  role: 'owner' | 'partner'
  member_slot: 1 | 2
  joined_at: string
  left_at: string | null
}

interface CloudBaseUserLike {
  ID?: string
  id?: string
  uid?: string
  sub?: string
  email?: string
  phone?: string
  phone_number?: string
  phoneNumber?: string
  name?: string
  username?: string
  user_metadata?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

interface CloudBaseSessionLike {
  access_token?: string
  expires_at?: string | number
  expires_in?: number
  user?: CloudBaseUserLike
}

interface CloudBaseAuthData {
  session?: CloudBaseSessionLike | null
  user?: CloudBaseUserLike | null
  verifyOtp?: (params: { token: string }) => Promise<unknown>
}

interface CloudBaseResponse {
  data?: CloudBaseAuthData | null
  error?: unknown
}

interface CloudBaseRpcResult {
  data?: unknown
  error?: unknown
}

type CloudBaseDatabase = ReturnType<CloudBaseApp['rdb']> & {
  rpc(name: string, params?: Record<string, unknown>): PromiseLike<CloudBaseRpcResult>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function throwResponseError(response: unknown) {
  if (isRecord(response) && response.error) throw response.error
}

function userId(user: CloudBaseUserLike) {
  const value = user.ID || user.id || user.uid || user.sub
  if (!value) throw new Error('CloudBase user response did not contain an ID.')
  return value
}

function displayNameFromUser(user: CloudBaseUserLike) {
  const metadataName = [user.user_metadata?.display_name, user.metadata?.display_name]
    .find((value) => typeof value === 'string' && value.trim())
  if (typeof metadataName === 'string') return metadataName.trim()
  return user.name?.trim() || user.username?.trim() || user.email?.split('@')[0] || '新的旅人'
}

function sessionExpiry(session: CloudBaseSessionLike) {
  if (typeof session.expires_at === 'number') {
    const timestamp = session.expires_at < 10_000_000_000 ? session.expires_at * 1_000 : session.expires_at
    return new Date(timestamp).toISOString()
  }
  if (typeof session.expires_at === 'string' && !Number.isNaN(Date.parse(session.expires_at))) {
    return new Date(session.expires_at).toISOString()
  }
  return new Date(Date.now() + Math.max(session.expires_in ?? 3_600, 60) * 1_000).toISOString()
}

function mapSession(session: CloudBaseSessionLike | null | undefined, fallbackUser?: CloudBaseUserLike | null): CloudSession | null {
  if (!session?.access_token) return null
  const user = session.user || fallbackUser
  if (!user) throw new Error('CloudBase session did not contain a user.')
  return {
    accessToken: session.access_token,
    expiresAt: sessionExpiry(session),
    user: {
      id: userId(user),
      displayName: displayNameFromUser(user),
      email: user.email,
      phone: user.phone || user.phoneNumber || user.phone_number,
    },
  }
}

function mapProfile(row: ProfileRow, fallback?: AccountIdentity): AccountIdentity {
  return {
    id: row.user_id,
    displayName: row.display_name,
    email: fallback?.email,
    phone: fallback?.phone,
    avatarPath: row.avatar_path ?? undefined,
  }
}

function mapCouple(row: CoupleRow): CoupleSpace {
  return {
    id: row.id,
    name: row.name,
    greeting: row.greeting,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapMember(row: MemberRow, displayName?: string): CoupleMember {
  return {
    coupleId: row.couple_id,
    userId: row.user_id,
    role: row.role,
    memberSlot: row.member_slot,
    joinedAt: row.joined_at,
    leftAt: row.left_at ?? undefined,
    displayName,
  }
}

export class CloudBaseAccountGateway implements AuthGateway, CoupleGateway {
  private readonly auth: CloudBaseApp['auth']
  private readonly db: CloudBaseDatabase
  private pendingSignUp?: {
    destination: string
    displayName: string
    verifyOtp(params: { token: string }): Promise<unknown>
  }

  constructor(app: CloudBaseApp) {
    this.auth = app.auth
    this.db = app.rdb() as CloudBaseDatabase
  }

  async getSession(): Promise<CloudSession | null> {
    const response = await this.auth.getSession() as unknown as CloudBaseResponse
    throwResponseError(response)
    return mapSession(response.data?.session, response.data?.user)
  }

  async signUp(input: SignUpInput): Promise<SignUpResult> {
    const destination = input.identifier.trim().toLowerCase()
    const response = await this.auth.signUp({
      email: destination,
      password: input.password,
    }) as unknown as CloudBaseResponse
    throwResponseError(response)

    const session = mapSession(response.data?.session, response.data?.user)
    if (session) {
      await this.ensureProfile(session, input.displayName)
      return { session, confirmationRequired: false }
    }

    if (typeof response.data?.verifyOtp !== 'function') {
      throw new Error('CloudBase registration did not return an email verification step.')
    }
    this.pendingSignUp = {
      destination,
      displayName: input.displayName.trim(),
      verifyOtp: response.data.verifyOtp,
    }
    return {
      session: null,
      confirmationRequired: true,
      verification: { kind: 'email-otp', destination },
    }
  }

  async verifySignUp(code: string): Promise<CloudSession> {
    if (!this.pendingSignUp) throw new Error('No CloudBase email verification is pending.')
    const response = await this.pendingSignUp.verifyOtp({ token: code.trim() }) as CloudBaseResponse
    throwResponseError(response)
    const session = mapSession(response.data?.session, response.data?.user)
    if (!session) throw new Error('CloudBase verification did not return a session.')
    await this.ensureProfile(session, this.pendingSignUp.displayName)
    this.pendingSignUp = undefined
    return session
  }

  cancelSignUpVerification() {
    this.pendingSignUp = undefined
  }

  async signIn(input: SignInInput): Promise<CloudSession> {
    const response = await this.auth.signInWithPassword({
      email: input.identifier.trim().toLowerCase(),
      password: input.password,
    }) as unknown as CloudBaseResponse
    throwResponseError(response)
    const session = mapSession(response.data?.session, response.data?.user)
    if (!session) throw new Error('CloudBase sign-in response did not contain a session.')
    return session
  }

  async signOut(): Promise<void> {
    const response = await this.auth.signOut()
    throwResponseError(response)
  }

  onSessionChange(listener: (session: CloudSession | null) => void): () => void {
    const { data } = this.auth.onAuthStateChange((_event: unknown, session: unknown) => {
      try {
        listener(mapSession(session as unknown as CloudBaseSessionLike))
      } catch {
        listener(null)
      }
    })
    return () => data.subscription.unsubscribe()
  }

  async getProfile(): Promise<AccountIdentity | null> {
    const session = await this.getSession()
    if (!session) return null
    const response = await this.db
      .from('profiles')
      .select('user_id, display_name, avatar_path')
      .eq('user_id', session.user.id)
      .maybeSingle()
    throwResponseError(response)
    return response.data
      ? mapProfile(response.data as ProfileRow, session.user)
      : this.ensureProfile(session, session.user.displayName)
  }

  async updateProfile(displayName: string): Promise<AccountIdentity> {
    const session = await this.getSession()
    if (!session) throw new Error('Authentication required.')
    return this.ensureProfile(session, displayName)
  }

  private async ensureProfile(session: CloudSession, displayName: string): Promise<AccountIdentity> {
    const normalizedName = displayName.trim()
    if (!normalizedName || normalizedName.length > 40) {
      throw new Error('Display name must contain between 1 and 40 characters.')
    }
    const response = await this.db
      .from('profiles')
      .upsert({ user_id: session.user.id, display_name: normalizedName }, { onConflict: 'user_id' })
      .select('user_id, display_name, avatar_path')
      .single()
    throwResponseError(response)
    return mapProfile(response.data as ProfileRow, session.user)
  }

  async getActiveCouple(): Promise<CoupleContext | null> {
    const session = await this.getSession()
    if (!session) return null

    const membershipResponse = await this.db
      .from('couple_members')
      .select('couple_id, user_id, role, member_slot, joined_at, left_at')
      .eq('user_id', session.user.id)
      .is('left_at', null)
      .maybeSingle()
    throwResponseError(membershipResponse)
    if (!membershipResponse.data) return null

    const membership = membershipResponse.data as MemberRow
    const [coupleResponse, membersResponse] = await Promise.all([
      this.db.from('couples')
        .select('id, name, greeting, status, created_by, created_at, updated_at')
        .eq('id', membership.couple_id)
        .single(),
      this.db.from('couple_members')
        .select('couple_id, user_id, role, member_slot, joined_at, left_at')
        .eq('couple_id', membership.couple_id)
        .is('left_at', null)
        .order('member_slot', { ascending: true }),
    ])
    throwResponseError(coupleResponse)
    throwResponseError(membersResponse)

    const memberRows = (membersResponse.data ?? []) as MemberRow[]
    const memberIds = memberRows.map((member) => member.user_id)
    const profilesResponse = memberIds.length
      ? await this.db.from('profiles').select('user_id, display_name, avatar_path').in('user_id', memberIds)
      : { data: [], error: null }
    throwResponseError(profilesResponse)
    const names = new Map(((profilesResponse.data ?? []) as ProfileRow[])
      .map((profile) => [profile.user_id, profile.display_name]))

    return {
      couple: mapCouple(coupleResponse.data as CoupleRow),
      members: memberRows.map((member) => mapMember(member, names.get(member.user_id))),
    }
  }

  async createCouple(input: CreateCoupleInput): Promise<CoupleContext> {
    const response = await this.db.rpc('create_couple_space', {
      space_name: input.name.trim(),
      space_greeting: input.greeting.trim(),
    })
    throwResponseError(response)
    const context = await this.getActiveCouple()
    if (!context) throw new Error('The couple space was created but could not be loaded.')
    return context
  }

  async createInvite(coupleId: string) {
    const response = await this.db.rpc('create_couple_invite', { target_couple_id: coupleId })
    throwResponseError(response)
    const row = Array.isArray(response.data) ? response.data[0] : response.data
    if (!isRecord(row) || typeof row.code !== 'string' || typeof row.expires_at !== 'string') {
      throw new Error('The CloudBase invite response is incomplete.')
    }
    return { code: row.code, expiresAt: row.expires_at }
  }

  async joinWithInvite(code: string): Promise<CoupleContext> {
    const response = await this.db.rpc('join_couple_by_code', { invite_code: code.trim().toUpperCase() })
    throwResponseError(response)
    const context = await this.getActiveCouple()
    if (!context) throw new Error('The invitation was accepted but the couple space could not be loaded.')
    return context
  }

  async leaveCouple(coupleId: string): Promise<void> {
    const response = await this.db.rpc('leave_couple_space', { target_couple_id: coupleId })
    throwResponseError(response)
  }
}
