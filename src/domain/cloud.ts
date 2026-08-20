export type JsonPrimitive = boolean | number | string | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

export type CloudEntityName =
  | 'profile'
  | 'wish'
  | 'memory'
  | 'memory_media'
  | 'daily_answer'
  | 'anniversary'
  | 'time_capsule'
  | 'notification'

export type CoupleRole = 'owner' | 'partner'
export type CoupleStatus = 'active' | 'archived'

export interface AccountIdentity {
  id: string
  displayName: string
  email?: string
  phone?: string
  avatarPath?: string
}

export interface CloudSession {
  accessToken: string
  expiresAt: string
  user: AccountIdentity
}

export interface CoupleSpace {
  id: string
  name: string
  greeting: string
  status: CoupleStatus
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CoupleMember {
  coupleId: string
  userId: string
  role: CoupleRole
  memberSlot: 1 | 2
  joinedAt: string
  leftAt?: string
  displayName?: string
}

export interface CoupleInvite {
  code: string
  expiresAt: string
}

export interface SyncScope {
  userId: string
  coupleId: string
}

export interface EntityRevision {
  coupleId: string
  entity: CloudEntityName
  entityId: string
  revision: number
  updatedAt: string
  updatedBy: string
  deletedAt?: string
}

export type SyncMutationKind = 'upsert' | 'delete'

export interface PendingSyncMutation {
  operationId: string
  scopeKey: string
  entity: CloudEntityName
  entityId: string
  kind: SyncMutationKind
  baseRevision?: number
  payload?: JsonObject
  queuedAt: string
  clientUpdatedAt: string
  attempts: number
  lastError?: string
}

export interface SyncChange {
  sequence: number
  entity: CloudEntityName
  entityId: string
  kind: SyncMutationKind
  revision: number
  payload?: JsonObject
  serverUpdatedAt: string
  actorId: string
}

export interface SyncCursor {
  scopeKey: string
  sequence: number
  pulledAt: string
}

export interface MutationReceipt {
  operationId: string
  status: 'applied' | 'already_applied' | 'conflict' | 'rejected'
  revision?: number
  serverValue?: JsonObject
  message?: string
}

export interface SyncConflict {
  operation: PendingSyncMutation
  serverRevision: number
  serverValue: JsonObject
  detectedAt: string
}

export function createSyncScopeKey(scope: SyncScope) {
  return `${scope.userId}:${scope.coupleId}`
}
