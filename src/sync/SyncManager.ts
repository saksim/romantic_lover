import type {
  CloudEntityName,
  JsonObject,
  MutationReceipt,
  PendingSyncMutation,
  SyncChange,
  SyncMutationKind,
  SyncScope,
} from '../domain/cloud'
import { createSyncScopeKey } from '../domain/cloud'
import { IndexedDbSyncStore } from '../storage/IndexedDbSyncStore'
import type { SyncGateway } from './SyncGateway'

const PUSH_BATCH_SIZE = 50
const PULL_BATCH_SIZE = 200

export interface QueueMutationInput {
  entity: CloudEntityName
  entityId: string
  kind: SyncMutationKind
  baseRevision?: number
  payload?: JsonObject
  clientUpdatedAt?: string
}

export interface SyncManagerCallbacks {
  applyRemoteChanges(changes: SyncChange[]): Promise<void>
  onConflict?(mutation: PendingSyncMutation, receipt: MutationReceipt): void
  onError?(error: unknown): void
}

export interface SyncSummary {
  pushed: number
  pulled: number
  conflicts: number
  cursor: number
}

function operationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `operation-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Synchronization failed.'
}

export class SyncManager {
  private readonly runs = new Map<string, Promise<SyncSummary>>()

  constructor(
    private readonly gateway: SyncGateway,
    private readonly store: IndexedDbSyncStore,
    private readonly callbacks: SyncManagerCallbacks,
  ) {}

  async enqueue(scope: SyncScope, input: QueueMutationInput): Promise<PendingSyncMutation> {
    const now = new Date().toISOString()
    const mutation: PendingSyncMutation = {
      ...input,
      operationId: operationId(),
      scopeKey: createSyncScopeKey(scope),
      queuedAt: now,
      clientUpdatedAt: input.clientUpdatedAt ?? now,
      attempts: 0,
    }
    await this.store.enqueue(mutation)
    return mutation
  }

  synchronize(scope: SyncScope): Promise<SyncSummary> {
    const scopeKey = createSyncScopeKey(scope)
    const existing = this.runs.get(scopeKey)
    if (existing) return existing

    const run = this.performSync(scope, scopeKey)
      .catch((error: unknown) => {
        this.callbacks.onError?.(error)
        throw error
      })
      .finally(() => this.runs.delete(scopeKey))
    this.runs.set(scopeKey, run)
    return run
  }

  private async performSync(scope: SyncScope, scopeKey: string): Promise<SyncSummary> {
    const pending = await this.store.listPending(scopeKey, PUSH_BATCH_SIZE)
    let pushed = 0
    let conflicts = 0

    if (pending.length) {
      try {
        const result = await this.gateway.push(scope, pending)
        const mutationById = new Map(pending.map((mutation) => [mutation.operationId, mutation]))
        for (const receipt of result.receipts) {
          const mutation = mutationById.get(receipt.operationId)
          if (!mutation) continue
          if (receipt.status === 'applied' || receipt.status === 'already_applied') {
            await this.store.remove(receipt.operationId)
            pushed += 1
          } else if (receipt.status === 'conflict') {
            conflicts += 1
            await this.store.recordFailure(receipt.operationId, receipt.message ?? 'Revision conflict.')
            this.callbacks.onConflict?.(mutation, receipt)
          } else {
            await this.store.recordFailure(receipt.operationId, receipt.message ?? 'Mutation rejected.')
          }
        }
      } catch (error) {
        await Promise.all(pending.map((mutation) => this.store.recordFailure(mutation.operationId, errorMessage(error))))
        throw error
      }
    }

    let cursor = await this.store.getCursor(scopeKey)
    let pulled = 0
    let hasMore = true
    while (hasMore) {
      const previousSequence = cursor?.sequence ?? 0
      const result = await this.gateway.pull(scope, cursor, PULL_BATCH_SIZE)
      if (result.cursor.scopeKey !== scopeKey) {
        throw new Error('The sync gateway returned a cursor for a different account or couple.')
      }
      if (result.cursor.sequence < previousSequence || (result.hasMore && result.cursor.sequence === previousSequence)) {
        throw new Error('The sync cursor did not advance while more changes were reported.')
      }
      if (result.changes.length) {
        await this.callbacks.applyRemoteChanges(result.changes)
        pulled += result.changes.length
      }
      cursor = result.cursor
      await this.store.setCursor(cursor)
      hasMore = result.hasMore
    }

    return { pushed, pulled, conflicts, cursor: cursor?.sequence ?? 0 }
  }
}
