import type { PersistedAppState } from '../domain/wish'

export interface StorageAdapter {
  load(): PersistedAppState
  save(state: PersistedAppState): void
}

export function createDefaultState(): PersistedAppState {
  return {
    version: 3,
    hasOpened: false,
    progress: {},
    customWishes: [],
    viewedWishIds: [],
    profile: {
      myName: '我',
      partnerName: '她',
      greeting: '今天也想和你，创造一点新的故事。',
    },
    dailyAnswers: {},
    capsules: [],
    memories: [],
    preferences: { romanceEffects: true },
  }
}

