import type { PersistedAppState } from '../domain/wish'

export interface V040MigrationInventory {
  wishStates: number
  customWishes: number
  memories: number
  photos: number
  estimatedPhotoBytes: number
  dailyQuestionSessions: number
  partnerAnswerAttributions: number
  timeCapsules: number
  anniversaries: number
}

export interface V040MigrationPlan {
  migrationId: string
  sourceVersion: 3
  sourceHash: string
  createdAt: string
  inventory: V040MigrationInventory
  warnings: string[]
  retainLocalUntilVerified: true
}

function dataUrlBytes(dataUrl: string) {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return 0
  const header = dataUrl.slice(0, comma)
  const body = dataUrl.slice(comma + 1)
  if (header.includes(';base64')) {
    const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0
    return Math.max(0, Math.floor(body.length * 3 / 4) - padding)
  }
  try {
    return new TextEncoder().encode(decodeURIComponent(body)).byteLength
  } catch {
    return new TextEncoder().encode(body).byteLength
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value

  const stable: Record<string, unknown> = {}
  Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([key, entry]) => { stable[key] = stableValue(entry) })
  return stable
}

function fallbackHash(text: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

async function hashState(state: PersistedAppState) {
  const serialized = JSON.stringify(stableValue(state))
  if (!globalThis.crypto?.subtle) return fallbackHash(serialized)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function inspectV040State(state: PersistedAppState): V040MigrationInventory {
  const memoryPhotos = state.memories.flatMap((memory) => memory.media.map((media) => media.dataUrl))
  const legacyProgressPhotos = Object.values(state.progress)
    .map((progress) => progress.photoDataUrl)
    .filter((photo): photo is string => Boolean(photo))
  const photos = [...memoryPhotos, ...legacyProgressPhotos]

  return {
    wishStates: Object.keys(state.progress).length,
    customWishes: state.customWishes.length,
    memories: state.memories.length,
    photos: photos.length,
    estimatedPhotoBytes: photos.reduce((total, photo) => total + dataUrlBytes(photo), 0),
    dailyQuestionSessions: Object.keys(state.dailyAnswers).length,
    partnerAnswerAttributions: Object.values(state.dailyAnswers)
      .filter((answer) => answer.partnerAnswer.trim()).length,
    timeCapsules: state.capsules.length,
    anniversaries: state.profile.anniversaryDate ? 1 : 0,
  }
}

export async function createV040MigrationPlan(state: PersistedAppState): Promise<V040MigrationPlan> {
  const inventory = inspectV040State(state)
  const sourceHash = await hashState(state)
  const warnings: string[] = []

  if (inventory.partnerAnswerAttributions > 0) {
    warnings.push('Partner answers must be mapped to the second account after the couple is bound.')
  }
  if (inventory.photos > 0) {
    warnings.push('Photos must be uploaded before local Data URLs are replaced with cloud object paths.')
  }
  if (inventory.estimatedPhotoBytes > 20 * 1024 * 1024) {
    warnings.push('The photo migration is larger than 20 MB and should run in resumable batches.')
  }

  return {
    migrationId: `v040-${sourceHash.slice(0, 24)}`,
    sourceVersion: 3,
    sourceHash,
    createdAt: new Date().toISOString(),
    inventory,
    warnings,
    retainLocalUntilVerified: true,
  }
}
