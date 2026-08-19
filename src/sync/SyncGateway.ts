import type {
  CloudSession,
  CoupleInvite,
  CoupleMember,
  CoupleSpace,
  JsonObject,
  MutationReceipt,
  PendingSyncMutation,
  SyncChange,
  SyncCursor,
  SyncScope,
} from '../domain/cloud'

export interface SignUpInput {
  identifier: string
  password: string
  displayName: string
}

export interface SignInInput {
  identifier: string
  password: string
}

export interface AuthGateway {
  getSession(): Promise<CloudSession | null>
  signUp(input: SignUpInput): Promise<CloudSession>
  signIn(input: SignInInput): Promise<CloudSession>
  signOut(): Promise<void>
  onSessionChange(listener: (session: CloudSession | null) => void): () => void
}

export interface CreateCoupleInput {
  name: string
  greeting: string
}

export interface CoupleContext {
  couple: CoupleSpace
  members: CoupleMember[]
}

export interface CoupleGateway {
  getActiveCouple(): Promise<CoupleContext | null>
  createCouple(input: CreateCoupleInput): Promise<CoupleContext>
  createInvite(coupleId: string): Promise<CoupleInvite>
  joinWithInvite(code: string): Promise<CoupleContext>
  leaveCouple(coupleId: string): Promise<void>
}

export interface PushResult {
  receipts: MutationReceipt[]
  serverTime: string
}

export interface PullResult {
  changes: SyncChange[]
  cursor: SyncCursor
  hasMore: boolean
}

export interface SyncSubscription {
  close(): void | Promise<void>
}

export interface SyncGateway {
  push(scope: SyncScope, mutations: PendingSyncMutation[]): Promise<PushResult>
  pull(scope: SyncScope, after: SyncCursor | null, limit?: number): Promise<PullResult>
  subscribe(scope: SyncScope, onChangeAvailable: () => void): Promise<SyncSubscription>
}

export interface MediaUploadInput {
  coupleId: string
  memoryId: string
  mediaId: string
  blob: Blob
  contentType: string
}

export interface StoredMedia {
  path: string
  contentType: string
  size: number
  metadata?: JsonObject
}

export interface MediaGateway {
  upload(input: MediaUploadInput): Promise<StoredMedia>
  getReadableUrl(path: string): Promise<string>
  remove(path: string): Promise<void>
}

export interface FutureWithYouBackend {
  auth: AuthGateway
  couples: CoupleGateway
  sync: SyncGateway
  media: MediaGateway
}
