import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  CompletionDetails,
  CoupleProfile,
  CustomWishInput,
  DailyAnswer,
  PersistedAppState,
  TimeCapsule,
  Wish,
  WishProgress,
} from '../domain/wish'
import { LocalStorageAdapter, normalizePersistedState } from '../storage/LocalStorageAdapter'

const storage = new LocalStorageAdapter()

function emptyProgress(now: string): WishProgress {
  return { saved: false, completed: false, updatedAt: now }
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function useWishProgress() {
  const [state, setState] = useState<PersistedAppState>(() => storage.load())

  useEffect(() => {
    storage.save(state)
  }, [state])

  const markOpened = useCallback(() => {
    setState((current) => (current.hasOpened ? current : { ...current, hasOpened: true }))
  }, [])

  const markWishViewed = useCallback((wishId: string) => {
    setState((current) => current.viewedWishIds.includes(wishId)
      ? current
      : { ...current, viewedWishIds: [...current.viewedWishIds, wishId] })
  }, [])

  const toggleSaved = useCallback((wishId: string) => {
    setState((current) => {
      const now = new Date().toISOString()
      const previous = current.progress[wishId] ?? emptyProgress(now)
      const next = { ...previous, saved: !previous.saved, updatedAt: now }
      const progress = { ...current.progress }
      if (!next.saved && !next.completed) delete progress[wishId]
      else progress[wishId] = next
      return { ...current, progress }
    })
  }, [])

  const completeWish = useCallback((wishId: string, details: CompletionDetails) => {
    setState((current) => {
      const now = new Date().toISOString()
      const previous = current.progress[wishId] ?? emptyProgress(now)
      return {
        ...current,
        progress: {
          ...current.progress,
          [wishId]: {
            ...previous,
            saved: true,
            completed: true,
            updatedAt: now,
            completedAt: details.completedAt,
            note: details.note?.trim() || undefined,
            photoDataUrl: details.photoDataUrl || previous.photoDataUrl,
          },
        },
      }
    })
  }, [])

  const undoCompletion = useCallback((wishId: string) => {
    setState((current) => {
      const previous = current.progress[wishId]
      if (!previous) return current
      return {
        ...current,
        progress: {
          ...current.progress,
          [wishId]: { ...previous, saved: true, completed: false, updatedAt: new Date().toISOString() },
        },
      }
    })
  }, [])

  const addCustomWish = useCallback((input: CustomWishInput): Wish => {
    const now = new Date().toISOString()
    const wish: Wish = {
      id: createId('custom'),
      number: 1000,
      category: input.category,
      title: input.title.trim(),
      description: input.description.trim() || '这是我们亲手写进未来的一件事。',
      moment: input.moment.trim() || '因为是你写下的，所以它已经很特别。',
      source: input.source ?? 'custom',
      createdBy: input.createdBy,
      createdAt: now,
      plannedFor: input.plannedFor || undefined,
      setting: input.setting,
      duration: input.duration,
    }

    setState((current) => ({
      ...current,
      customWishes: [...current.customWishes, wish],
      progress: {
        ...current.progress,
        [wish.id]: { saved: true, completed: false, updatedAt: now },
      },
    }))
    return wish
  }, [])

  const deleteCustomWish = useCallback((wishId: string) => {
    setState((current) => {
      const progress = { ...current.progress }
      delete progress[wishId]
      return {
        ...current,
        customWishes: current.customWishes.filter((wish) => wish.id !== wishId),
        viewedWishIds: current.viewedWishIds.filter((id) => id !== wishId),
        progress,
      }
    })
  }, [])

  const saveDailyAnswer = useCallback((answer: Omit<DailyAnswer, 'updatedAt'>) => {
    setState((current) => ({
      ...current,
      dailyAnswers: {
        ...current.dailyAnswers,
        [answer.dateKey]: { ...answer, updatedAt: new Date().toISOString() },
      },
    }))
  }, [])

  const saveProfile = useCallback((profile: CoupleProfile) => {
    setState((current) => ({ ...current, profile }))
  }, [])

  const addCapsule = useCallback((input: Pick<TimeCapsule, 'title' | 'message' | 'openAt'>) => {
    const capsule: TimeCapsule = {
      ...input,
      id: createId('capsule'),
      createdAt: new Date().toISOString(),
    }
    setState((current) => ({ ...current, capsules: [...current.capsules, capsule] }))
  }, [])

  const openCapsule = useCallback((capsuleId: string) => {
    setState((current) => ({
      ...current,
      capsules: current.capsules.map((capsule) => capsule.id === capsuleId && !capsule.openedAt
        ? { ...capsule, openedAt: new Date().toISOString() }
        : capsule),
    }))
  }, [])

  const deleteCapsule = useCallback((capsuleId: string) => {
    setState((current) => ({
      ...current,
      capsules: current.capsules.filter((capsule) => capsule.id !== capsuleId),
    }))
  }, [])

  const setRomanceEffects = useCallback((enabled: boolean) => {
    setState((current) => ({
      ...current,
      preferences: { ...current.preferences, romanceEffects: enabled },
    }))
  }, [])

  const markSecretOpened = useCallback(() => {
    setState((current) => current.secretOpenedAt
      ? current
      : { ...current, secretOpenedAt: new Date().toISOString() })
  }, [])

  const importState = useCallback((raw: string) => {
    try {
      const normalized = normalizePersistedState(JSON.parse(raw))
      if (!normalized) return false
      setState(normalized)
      return true
    } catch {
      return false
    }
  }, [])

  const stats = useMemo(() => {
    const entries = Object.values(state.progress)
    return {
      saved: entries.filter((entry) => entry.saved).length,
      completed: entries.filter((entry) => entry.completed).length,
      selected: entries.filter((entry) => entry.saved || entry.completed).length,
      viewed: state.viewedWishIds.length,
      memoriesWithPhotos: entries.filter((entry) => entry.completed && entry.photoDataUrl).length,
    }
  }, [state.progress, state.viewedWishIds.length])

  return {
    state,
    stats,
    isSecretUnlocked: stats.selected >= 3,
    markOpened,
    markWishViewed,
    toggleSaved,
    completeWish,
    undoCompletion,
    addCustomWish,
    deleteCustomWish,
    saveDailyAnswer,
    saveProfile,
    addCapsule,
    openCapsule,
    deleteCapsule,
    setRomanceEffects,
    markSecretOpened,
    importState,
  }
}

