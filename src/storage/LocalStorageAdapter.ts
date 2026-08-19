import type {
  CoupleProfile,
  DailyAnswer,
  DailyAnswerMap,
  Memory,
  MemoryCreator,
  MemoryKind,
  MemoryMedia,
  PersistedAppState,
  TimeCapsule,
  Wish,
  WishProgress,
  WishProgressMap,
} from '../domain/wish'
import { createDefaultState, type StorageAdapter } from './StorageAdapter'

const STORAGE_KEY = 'future-with-you.app-state.v3'
const V2_STORAGE_KEY = 'future-with-you.app-state.v2'
const V1_STORAGE_KEY = 'future-with-you.app-state.v1'
const MEMORY_KINDS: MemoryKind[] = ['milestone', 'date', 'trip', 'gift', 'ordinary', 'conversation']
const MEMORY_CREATORS: MemoryCreator[] = ['me', 'partner', 'together']

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isWishProgress(value: unknown): value is WishProgress {
  return isRecord(value) && typeof value.saved === 'boolean' && typeof value.completed === 'boolean'
}

function sanitizeProgress(value: unknown): WishProgressMap {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, WishProgress] => isWishProgress(entry[1]))
      .map(([id, progress]) => [id, {
        saved: progress.saved,
        completed: progress.completed,
        updatedAt: typeof progress.updatedAt === 'string' ? progress.updatedAt : new Date().toISOString(),
        completedAt: typeof progress.completedAt === 'string' ? progress.completedAt : undefined,
        note: typeof progress.note === 'string' ? progress.note : undefined,
        photoDataUrl: typeof progress.photoDataUrl === 'string' ? progress.photoDataUrl : undefined,
      }]),
  )
}

function isWish(value: unknown): value is Wish {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && typeof value.number === 'number' &&
    typeof value.category === 'string' && typeof value.title === 'string' &&
    typeof value.description === 'string' && typeof value.moment === 'string'
}

function sanitizeProfile(value: unknown): CoupleProfile {
  const fallback = createDefaultState().profile
  if (!isRecord(value)) return fallback
  return {
    myName: typeof value.myName === 'string' && value.myName.trim() ? value.myName.trim() : fallback.myName,
    partnerName: typeof value.partnerName === 'string' && value.partnerName.trim() ? value.partnerName.trim() : fallback.partnerName,
    anniversaryDate: typeof value.anniversaryDate === 'string' ? value.anniversaryDate : undefined,
    greeting: typeof value.greeting === 'string' && value.greeting.trim() ? value.greeting : fallback.greeting,
  }
}

function isDailyAnswer(value: unknown): value is DailyAnswer {
  return isRecord(value) && typeof value.questionId === 'string' && typeof value.dateKey === 'string' &&
    typeof value.myAnswer === 'string' && typeof value.partnerAnswer === 'string'
}

function sanitizeDailyAnswers(value: unknown): DailyAnswerMap {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, DailyAnswer] => isDailyAnswer(entry[1])),
  )
}

function isTimeCapsule(value: unknown): value is TimeCapsule {
  return isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string' &&
    typeof value.message === 'string' && typeof value.openAt === 'string' && typeof value.createdAt === 'string'
}

function sanitizeMedia(value: unknown, title: string): MemoryMedia[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): MemoryMedia[] => {
    if (!isRecord(item) || item.type !== 'image' || typeof item.dataUrl !== 'string' || !item.dataUrl) return []
    return [{
      id: typeof item.id === 'string' ? item.id : `media-${Date.now()}`,
      type: 'image',
      dataUrl: item.dataUrl,
      alt: typeof item.alt === 'string' && item.alt.trim() ? item.alt.trim() : `${title}的回忆照片`,
    }]
  }).slice(0, 4)
}

function sanitizeMemories(value: unknown): Memory[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): Memory[] => {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.title !== 'string' ||
      typeof item.story !== 'string' || typeof item.occurredAt !== 'string') return []

    const now = new Date().toISOString()
    const kind = MEMORY_KINDS.includes(item.kind as MemoryKind) ? item.kind as MemoryKind : 'ordinary'
    const createdBy = MEMORY_CREATORS.includes(item.createdBy as MemoryCreator)
      ? item.createdBy as MemoryCreator
      : 'together'

    return [{
      id: item.id,
      title: item.title.trim() || '没有标题的回忆',
      story: item.story.trim(),
      occurredAt: item.occurredAt,
      kind,
      createdBy,
      tags: Array.isArray(item.tags)
        ? Array.from(new Set(item.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean))).slice(0, 8)
        : [],
      location: typeof item.location === 'string' && item.location.trim() ? item.location.trim() : undefined,
      media: sanitizeMedia(item.media, item.title),
      linkedWishId: typeof item.linkedWishId === 'string' ? item.linkedWishId : undefined,
      featured: Boolean(item.featured),
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : now,
    }]
  })
}

function normalizeSharedState(value: Record<string, unknown>, memories: Memory[]): PersistedAppState {
  return {
    version: 3,
    hasOpened: Boolean(value.hasOpened),
    progress: sanitizeProgress(value.progress),
    customWishes: Array.isArray(value.customWishes) ? value.customWishes.filter(isWish) : [],
    viewedWishIds: Array.isArray(value.viewedWishIds)
      ? Array.from(new Set(value.viewedWishIds.filter((id): id is string => typeof id === 'string')))
      : [],
    profile: sanitizeProfile(value.profile),
    dailyAnswers: sanitizeDailyAnswers(value.dailyAnswers),
    capsules: Array.isArray(value.capsules) ? value.capsules.filter(isTimeCapsule) : [],
    memories,
    preferences: {
      romanceEffects: isRecord(value.preferences) && typeof value.preferences.romanceEffects === 'boolean'
        ? value.preferences.romanceEffects
        : true,
    },
    secretOpenedAt: typeof value.secretOpenedAt === 'string' ? value.secretOpenedAt : undefined,
  }
}

export function normalizePersistedState(value: unknown): PersistedAppState | null {
  if (!isRecord(value)) return null
  const fallback = createDefaultState()

  if (value.version === 1) {
    return {
      ...fallback,
      hasOpened: Boolean(value.hasOpened),
      progress: sanitizeProgress(value.progress),
      secretOpenedAt: typeof value.secretOpenedAt === 'string' ? value.secretOpenedAt : undefined,
    }
  }

  if (value.version === 2) return normalizeSharedState(value, [])
  if (value.version === 3) return normalizeSharedState(value, sanitizeMemories(value.memories))
  return null
}

export class LocalStorageAdapter implements StorageAdapter {
  load(): PersistedAppState {
    if (typeof window === 'undefined') return createDefaultState()
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY) ??
        window.localStorage.getItem(V2_STORAGE_KEY) ??
        window.localStorage.getItem(V1_STORAGE_KEY)
      if (!raw) return createDefaultState()
      return normalizePersistedState(JSON.parse(raw)) ?? createDefaultState()
    } catch {
      return createDefaultState()
    }
  }

  save(state: PersistedAppState): void {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // The app still works in memory when browser storage is unavailable or full.
    }
  }
}
