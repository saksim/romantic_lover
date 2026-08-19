import type {
  CoupleProfile,
  DailyAnswer,
  DailyAnswerMap,
  PersistedAppState,
  TimeCapsule,
  Wish,
  WishProgress,
  WishProgressMap,
} from '../domain/wish'
import { createDefaultState, type StorageAdapter } from './StorageAdapter'

const STORAGE_KEY = 'future-with-you.app-state.v2'
const LEGACY_STORAGE_KEY = 'future-with-you.app-state.v1'

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

  if (value.version !== 2) return null
  return {
    version: 2,
    hasOpened: Boolean(value.hasOpened),
    progress: sanitizeProgress(value.progress),
    customWishes: Array.isArray(value.customWishes) ? value.customWishes.filter(isWish) : [],
    viewedWishIds: Array.isArray(value.viewedWishIds)
      ? Array.from(new Set(value.viewedWishIds.filter((id): id is string => typeof id === 'string')))
      : [],
    profile: sanitizeProfile(value.profile),
    dailyAnswers: sanitizeDailyAnswers(value.dailyAnswers),
    capsules: Array.isArray(value.capsules) ? value.capsules.filter(isTimeCapsule) : [],
    preferences: {
      romanceEffects: isRecord(value.preferences) && typeof value.preferences.romanceEffects === 'boolean'
        ? value.preferences.romanceEffects
        : true,
    },
    secretOpenedAt: typeof value.secretOpenedAt === 'string' ? value.secretOpenedAt : undefined,
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  load(): PersistedAppState {
    if (typeof window === 'undefined') return createDefaultState()
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY)
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

