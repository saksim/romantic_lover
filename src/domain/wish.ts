export type CategoryId = 'daily' | 'adventure' | 'romance' | 'growth' | 'home'
export type DateSetting = 'home' | 'out' | 'either'
export type DateDuration = 'quick' | 'evening' | 'day'
export type WishCreator = 'me' | 'partner'
export type WishSource = 'curated' | 'custom' | 'date-idea'
export type MemoryKind = 'milestone' | 'date' | 'trip' | 'gift' | 'ordinary' | 'conversation'
export type MemoryCreator = WishCreator | 'together'

export interface Category {
  id: CategoryId
  name: string
  shortName: string
  eyebrow: string
  symbol: string
  color: string
  softColor: string
}

export interface Wish {
  id: string
  number: number
  category: CategoryId
  title: string
  description: string
  moment: string
  source?: WishSource
  createdBy?: WishCreator
  createdAt?: string
  plannedFor?: string
  setting?: DateSetting
  duration?: DateDuration
}

export interface CustomWishInput {
  title: string
  description: string
  moment: string
  category: CategoryId
  createdBy: WishCreator
  plannedFor?: string
  setting: DateSetting
  duration: DateDuration
  source?: 'custom' | 'date-idea'
}

export interface CompletionDetails {
  completedAt: string
  note?: string
  photoDataUrl?: string
}

export interface WishProgress {
  saved: boolean
  completed: boolean
  updatedAt: string
  completedAt?: string
  note?: string
  photoDataUrl?: string
}

export type WishProgressMap = Record<string, WishProgress>

export interface CoupleProfile {
  myName: string
  partnerName: string
  anniversaryDate?: string
  greeting: string
}

export interface DailyAnswer {
  questionId: string
  dateKey: string
  myAnswer: string
  partnerAnswer: string
  updatedAt: string
}

export type DailyAnswerMap = Record<string, DailyAnswer>

export interface TimeCapsule {
  id: string
  title: string
  message: string
  openAt: string
  createdAt: string
  openedAt?: string
}
export interface MemoryMedia {
  id: string
  type: 'image'
  dataUrl: string
  alt: string
}

export interface Memory {
  id: string
  title: string
  story: string
  occurredAt: string
  kind: MemoryKind
  createdBy: MemoryCreator
  tags: string[]
  location?: string
  media: MemoryMedia[]
  linkedWishId?: string
  featured: boolean
  createdAt: string
  updatedAt: string
}

export interface MemoryInput {
  title: string
  story: string
  occurredAt: string
  kind: MemoryKind
  createdBy: MemoryCreator
  tags: string[]
  location?: string
  photoDataUrl?: string
  featured: boolean
}


export interface AppPreferences {
  romanceEffects: boolean
}

export interface PersistedAppState {
  version: 3
  hasOpened: boolean
  progress: WishProgressMap
  customWishes: Wish[]
  viewedWishIds: string[]
  profile: CoupleProfile
  dailyAnswers: DailyAnswerMap
  capsules: TimeCapsule[]
  memories: Memory[]
  preferences: AppPreferences
  secretOpenedAt?: string
}

export interface DateIdea {
  id: string
  title: string
  description: string
  moment: string
  category: CategoryId
  setting: DateSetting
  duration: DateDuration
}

export interface DailyQuestion {
  id: string
  prompt: string
  hint: string
}

export type AppView = 'opening' | 'today' | 'explore' | 'collection' | 'story' | 'together' | 'secret'

