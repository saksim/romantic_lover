export type CategoryId = 'daily' | 'adventure' | 'romance' | 'growth' | 'home'
export type DateSetting = 'home' | 'out' | 'either'
export type DateDuration = 'quick' | 'evening' | 'day'
export type WishCreator = 'me' | 'partner'
export type WishSource = 'curated' | 'custom' | 'date-idea'

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

export interface AppPreferences {
  romanceEffects: boolean
}

export interface PersistedAppState {
  version: 2
  hasOpened: boolean
  progress: WishProgressMap
  customWishes: Wish[]
  viewedWishIds: string[]
  profile: CoupleProfile
  dailyAnswers: DailyAnswerMap
  capsules: TimeCapsule[]
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

export type AppView = 'opening' | 'today' | 'explore' | 'collection' | 'together' | 'secret'

