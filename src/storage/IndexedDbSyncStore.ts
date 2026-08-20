import type { PendingSyncMutation, SyncCursor } from '../domain/cloud'

const DATABASE_NAME = 'future-with-you.sync.v1'
const DATABASE_VERSION = 1
const MUTATION_STORE = 'mutations'
const METADATA_STORE = 'metadata'

interface CursorRecord {
  key: string
  cursor: SyncCursor
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'))
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
  })
}

function openSyncDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in globalThis)) {
    return Promise.reject(new Error('IndexedDB is unavailable in this browser.'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(MUTATION_STORE)) {
        const store = database.createObjectStore(MUTATION_STORE, { keyPath: 'operationId' })
        store.createIndex('byScope', 'scopeKey', { unique: false })
      }
      if (!database.objectStoreNames.contains(METADATA_STORE)) {
        database.createObjectStore(METADATA_STORE, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open the sync database.'))
    request.onblocked = () => reject(new Error('The sync database upgrade is blocked by another tab.'))
  })
}

export class IndexedDbSyncStore {
  private databasePromise?: Promise<IDBDatabase>

  private database() {
    this.databasePromise ??= openSyncDatabase()
    return this.databasePromise
  }

  async enqueue(mutation: PendingSyncMutation): Promise<void> {
    const database = await this.database()
    const transaction = database.transaction(MUTATION_STORE, 'readwrite')
    const completed = transactionComplete(transaction)
    transaction.objectStore(MUTATION_STORE).put(mutation)
    await completed
  }

  async listPending(scopeKey: string, limit = 100): Promise<PendingSyncMutation[]> {
    const database = await this.database()
    const transaction = database.transaction(MUTATION_STORE, 'readonly')
    const completed = transactionComplete(transaction)
    const index = transaction.objectStore(MUTATION_STORE).index('byScope')
    const records = await requestResult(index.getAll(IDBKeyRange.only(scopeKey))) as PendingSyncMutation[]
    await completed
    return records.sort((left, right) => left.queuedAt.localeCompare(right.queuedAt)).slice(0, limit)
  }

  async recordFailure(operationId: string, message: string): Promise<void> {
    const database = await this.database()
    const transaction = database.transaction(MUTATION_STORE, 'readwrite')
    const completed = transactionComplete(transaction)
    const store = transaction.objectStore(MUTATION_STORE)
    const mutation = await requestResult(store.get(operationId)) as PendingSyncMutation | undefined
    if (mutation) {
      store.put({ ...mutation, attempts: mutation.attempts + 1, lastError: message })
    }
    await completed
  }

  async remove(operationId: string): Promise<void> {
    const database = await this.database()
    const transaction = database.transaction(MUTATION_STORE, 'readwrite')
    const completed = transactionComplete(transaction)
    transaction.objectStore(MUTATION_STORE).delete(operationId)
    await completed
  }

  async getCursor(scopeKey: string): Promise<SyncCursor | null> {
    const database = await this.database()
    const transaction = database.transaction(METADATA_STORE, 'readonly')
    const completed = transactionComplete(transaction)
    const record = await requestResult(transaction.objectStore(METADATA_STORE).get(`cursor:${scopeKey}`)) as CursorRecord | undefined
    await completed
    return record?.cursor ?? null
  }

  async setCursor(cursor: SyncCursor): Promise<void> {
    const database = await this.database()
    const transaction = database.transaction(METADATA_STORE, 'readwrite')
    const completed = transactionComplete(transaction)
    transaction.objectStore(METADATA_STORE).put({ key: `cursor:${cursor.scopeKey}`, cursor } satisfies CursorRecord)
    await completed
  }

  async clearScope(scopeKey: string): Promise<void> {
    const database = await this.database()
    const transaction = database.transaction([MUTATION_STORE, METADATA_STORE], 'readwrite')
    const completed = transactionComplete(transaction)
    const mutationStore = transaction.objectStore(MUTATION_STORE)
    const keys = await requestResult(mutationStore.index('byScope').getAllKeys(IDBKeyRange.only(scopeKey)))
    keys.forEach((key) => mutationStore.delete(key))
    transaction.objectStore(METADATA_STORE).delete(`cursor:${scopeKey}`)
    await completed
  }

  async close(): Promise<void> {
    const database = await this.databasePromise
    database?.close()
    this.databasePromise = undefined
  }
}
