import { useCallback, useEffect, useMemo, useState } from 'react'
import { wishes as curatedWishes } from '../data/wishes'
import type {
  CompletionDetails,
  CoupleProfile,
  CustomWishInput,
  DailyAnswer,
  Memory,
  MemoryInput,
  MemoryKind,
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

function memoryKindForWish(wish: Wish): MemoryKind {
  if (wish.category === 'adventure') return 'trip'
  if (wish.category === 'romance') return 'date'
  if (wish.category === 'growth') return 'milestone'
  return 'ordinary'
}

function photoMedia(dataUrl: string, title: string) {
  return [{ id: createId('media'), type: 'image' as const, dataUrl, alt: `${title}的回忆照片` }]
}

function createMemoryFromWish(wish: Wish, progress: WishProgress): Memory {
  const now = progress.updatedAt || new Date().toISOString()
  return {
    id: `memory-wish-${wish.id}`,
    title: wish.title,
    story: progress.note?.trim() || wish.description,
    occurredAt: progress.completedAt || now.slice(0, 10),
    kind: memoryKindForWish(wish),
    createdBy: wish.createdBy ?? 'together',
    tags: ['愿望成真', wish.category],
    media: progress.photoDataUrl ? photoMedia(progress.photoDataUrl, wish.title) : [],
    linkedWishId: wish.id,
    featured: false,
    createdAt: now,
    updatedAt: now,
  }
}

function compactWishProgress(progress: WishProgress): WishProgress {
  return {
    saved: progress.saved,
    completed: progress.completed,
    updatedAt: progress.updatedAt,
    completedAt: progress.completedAt,
  }
}

function reconcileCompletedWishMemories(state: PersistedAppState): PersistedAppState {
  const wishMap = new Map([...curatedWishes, ...state.customWishes].map((wish) => [wish.id, wish]))
  const linkedWishIds = new Set(state.memories.map((memory) => memory.linkedWishId).filter(Boolean))
  const migrated = Object.entries(state.progress).flatMap(([wishId, progress]) => {
    if (!progress.completed || linkedWishIds.has(wishId)) return []
    const wish = wishMap.get(wishId)
    return wish ? [createMemoryFromWish(wish, progress)] : []
  })
  const memories = migrated.length ? [...state.memories, ...migrated] : state.memories
  const allLinkedWishIds = new Set(memories.map((memory) => memory.linkedWishId).filter(Boolean))
  let compacted = false
  const progress = Object.fromEntries(Object.entries(state.progress).map(([wishId, entry]) => {
    if (!entry.completed || !allLinkedWishIds.has(wishId) || (!entry.note && !entry.photoDataUrl)) return [wishId, entry]
    compacted = true
    return [wishId, compactWishProgress(entry)]
  }))
  return migrated.length || compacted ? { ...state, progress, memories } : state
}

function buildMemory(input: MemoryInput, previous?: Memory): Memory {
  const now = new Date().toISOString()
  const title = input.title.trim()
  const nextMedia = input.photoDataUrl === undefined
    ? previous?.media ?? []
    : input.photoDataUrl
      ? photoMedia(input.photoDataUrl, title)
      : []

  return {
    id: previous?.id ?? createId('memory'),
    title,
    story: input.story.trim(),
    occurredAt: input.occurredAt,
    kind: input.kind,
    createdBy: input.createdBy,
    tags: Array.from(new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 8),
    location: input.location?.trim() || undefined,
    media: nextMedia,
    linkedWishId: previous?.linkedWishId,
    featured: input.featured,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  }
}

export function useWishProgress() {
  const [state, setState] = useState<PersistedAppState>(() => reconcileCompletedWishMemories(storage.load()))

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

  const completeWish = useCallback((wish: Wish, details: CompletionDetails) => {
    setState((current) => {
      const now = new Date().toISOString()
      const previousProgress = current.progress[wish.id] ?? emptyProgress(now)
      const memorySource: WishProgress = {
        ...previousProgress,
        saved: true,
        completed: true,
        updatedAt: now,
        completedAt: details.completedAt,
        note: details.note?.trim() || undefined,
        photoDataUrl: details.photoDataUrl,
      }
      const progress = compactWishProgress(memorySource)
      const existingMemory = current.memories.find((memory) => memory.linkedWishId === wish.id)
      const generated = createMemoryFromWish(wish, memorySource)
      const memory = existingMemory ? {
        ...existingMemory,
        story: details.note?.trim() || wish.description,
        occurredAt: details.completedAt,
        media: details.photoDataUrl ? photoMedia(details.photoDataUrl, existingMemory.title) : [],
        updatedAt: now,
      } : generated

      return {
        ...current,
        progress: { ...current.progress, [wish.id]: progress },
        memories: existingMemory
          ? current.memories.map((item) => item.id === existingMemory.id ? memory : item)
          : [...current.memories, memory],
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
        memories: current.memories.filter((memory) => memory.linkedWishId !== wishId),
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
        memories: current.memories.filter((memory) => memory.linkedWishId !== wishId),
      }
    })
  }, [])

  const addMemory = useCallback((input: MemoryInput): Memory => {
    const memory = buildMemory(input)
    setState((current) => ({ ...current, memories: [...current.memories, memory] }))
    return memory
  }, [])

  const updateMemory = useCallback((memoryId: string, input: MemoryInput) => {
    setState((current) => {
      const previous = current.memories.find((memory) => memory.id === memoryId)
      if (!previous) return current
      const memory = buildMemory(input, previous)
      const linkedProgress = memory.linkedWishId ? current.progress[memory.linkedWishId] : undefined
      const progress = memory.linkedWishId && linkedProgress
        ? {
            ...current.progress,
            [memory.linkedWishId]: compactWishProgress({
              ...linkedProgress,
              completedAt: memory.occurredAt,
              updatedAt: memory.updatedAt,
            }),
          }
        : current.progress
      return {
        ...current,
        progress,
        memories: current.memories.map((item) => item.id === memoryId ? memory : item),
      }
    })
  }, [])

  const deleteMemory = useCallback((memoryId: string) => {
    setState((current) => ({
      ...current,
      memories: current.memories.filter((memory) => memory.id !== memoryId || Boolean(memory.linkedWishId)),
    }))
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
      setState(reconcileCompletedWishMemories(normalized))
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
      memoryCount: state.memories.length,
      memoriesWithPhotos: state.memories.filter((memory) => memory.media.length > 0).length,
      featuredMemories: state.memories.filter((memory) => memory.featured).length,
    }
  }, [state.memories, state.progress, state.viewedWishIds.length])

  const onThisDayMemory = useMemo(() => {
    const today = new Date()
    const matches = state.memories
      .filter((memory) => {
        const date = new Date(`${memory.occurredAt.slice(0, 10)}T12:00:00`)
        return !Number.isNaN(date.getTime()) && date.getFullYear() < today.getFullYear() &&
          date.getMonth() === today.getMonth() && date.getDate() === today.getDate()
      })
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    return matches[0]
  }, [state.memories])

  return {
    state,
    stats,
    onThisDayMemory,
    isSecretUnlocked: stats.selected >= 3,
    markOpened,
    markWishViewed,
    toggleSaved,
    completeWish,
    undoCompletion,
    addCustomWish,
    deleteCustomWish,
    addMemory,
    updateMemory,
    deleteMemory,
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
