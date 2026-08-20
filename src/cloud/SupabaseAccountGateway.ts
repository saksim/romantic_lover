import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
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

function displayNameFromUser(user: User) {
  const metadataName = typeof user.user_metadata?.display_name === 'string'
    ? user.user_metadata.display_name.trim()
    : ''
  return metadataName || user.email?.split('@')[0] || '新的旅人'
}

function mapSession(session: Session | null): CloudSession | null {
  if (!session) return null
  return {
    accessToken: session.access_token,
    expiresAt: new Date((session.expires_at ?? 0) * 1_000).toISOString(),
    user: {
      id: session.user.id,
      displayName: displayNameFromUser(session.user),
      email: session.user.email,
      phone: session.user.phone || undefined,
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

export class SupabaseAccountGateway implements AuthGateway, CoupleGateway {
  constructor(private readonly client: SupabaseClient) {}

  async getSession(): Promise<CloudSession | null> {
    const { data, error } = await this.client.auth.getSession()
    if (error) throw error
    return mapSession(data.session)
  }

  async signUp(input: SignUpInput): Promise<SignUpResult> {
    const { data, error } = await this.client.auth.signUp({
      email: input.identifier.trim(),
      password: input.password,
      options: {
        data: { display_name: input.displayName.trim() },
        emailRedirectTo: `${window.location.origin}/`,
      },
    })
    if (error) throw error
    return {
      session: mapSession(data.session),
      confirmationRequired: Boolean(data.user && !data.session),
    }
  }

  async signIn(input: SignInInput): Promise<CloudSession> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: input.identifier.trim(),
      password: input.password,
    })
    if (error) throw error
    const session = mapSession(data.session)
    if (!session) throw new Error('The sign-in response did not contain a session.')
    return session
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut()
    if (error) throw error
  }

  onSessionChange(listener: (session: CloudSession | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      listener(mapSession(session))
    })
    return () => data.subscription.unsubscribe()
  }

  async getProfile(): Promise<AccountIdentity | null> {
    const session = await this.getSession()
    if (!session) return null
    const { data, error } = await this.client
      .from('profiles')
      .select('user_id, display_name, avatar_path')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (error) throw error
    return data ? mapProfile(data as ProfileRow, session.user) : session.user
  }

  async updateProfile(displayName: string): Promise<AccountIdentity> {
    const session = await this.getSession()
    if (!session) throw new Error('Authentication required.')
    const normalizedName = displayName.trim()
    if (!normalizedName || normalizedName.length > 40) {
      throw new Error('Display name must contain between 1 and 40 characters.')
    }
    const { data, error } = await this.client
      .from('profiles')
      .update({ display_name: normalizedName })
      .eq('user_id', session.user.id)
      .select('user_id, display_name, avatar_path')
      .single()
    if (error) throw error
    return mapProfile(data as ProfileRow, session.user)
  }

  async getActiveCouple(): Promise<CoupleContext | null> {
    const session = await this.getSession()
    if (!session) return null

    const { data: membership, error: membershipError } = await this.client
      .from('couple_members')
      .select('couple_id, user_id, role, member_slot, joined_at, left_at')
      .eq('user_id', session.user.id)
      .is('left_at', null)
      .maybeSingle()
    if (membershipError) throw membershipError
    if (!membership) return null

    const memberRow = membership as MemberRow
    const [{ data: couple, error: coupleError }, { data: members, error: membersError }] = await Promise.all([
      this.client
        .from('couples')
        .select('id, name, greeting, status, created_by, created_at, updated_at')
        .eq('id', memberRow.couple_id)
        .single(),
      this.client
        .from('couple_members')
        .select('couple_id, user_id, role, member_slot, joined_at, left_at')
        .eq('couple_id', memberRow.couple_id)
        .is('left_at', null)
        .order('member_slot'),
    ])
    if (coupleError) throw coupleError
    if (membersError) throw membersError

    const memberRows = (members ?? []) as MemberRow[]
    const memberIds = memberRows.map((member) => member.user_id)
    const { data: profiles, error: profilesError } = memberIds.length
      ? await this.client.from('profiles').select('user_id, display_name, avatar_path').in('user_id', memberIds)
      : { data: [], error: null }
    if (profilesError) throw profilesError
    const names = new Map(((profiles ?? []) as ProfileRow[]).map((profile) => [profile.user_id, profile.display_name]))

    return {
      couple: mapCouple(couple as CoupleRow),
      members: memberRows.map((member) => mapMember(member, names.get(member.user_id))),
    }
  }

  async createCouple(input: CreateCoupleInput): Promise<CoupleContext> {
    const { error } = await this.client.rpc('create_couple_space', {
      space_name: input.name.trim(),
      space_greeting: input.greeting.trim(),
    })
    if (error) throw error
    const context = await this.getActiveCouple()
    if (!context) throw new Error('The couple space was created but could not be loaded.')
    return context
  }

  async createInvite(coupleId: string) {
    const { data, error } = await this.client.rpc('create_couple_invite', {
      target_couple_id: coupleId,
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (!row || typeof row.code !== 'string' || typeof row.expires_at !== 'string') {
      throw new Error('The invite response is incomplete.')
    }
    return { code: row.code, expiresAt: row.expires_at }
  }

  async joinWithInvite(code: string): Promise<CoupleContext> {
    const { error } = await this.client.rpc('join_couple_by_code', { invite_code: code.trim().toUpperCase() })
    if (error) throw error
    const context = await this.getActiveCouple()
    if (!context) throw new Error('The invitation was accepted but the couple space could not be loaded.')
    return context
  }

  async leaveCouple(coupleId: string): Promise<void> {
    const { error } = await this.client.rpc('leave_couple_space', { target_couple_id: coupleId })
    if (error) throw error
  }
}
