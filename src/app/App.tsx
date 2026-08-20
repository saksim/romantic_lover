import { useCallback, useMemo, useState } from 'react'
import { CelebrationOverlay, type CelebrationType } from '../components/RomanceEffects'
import { CompletionModal } from '../components/CompletionModal'
import { CustomWishModal } from '../components/CustomWishModal'
import { DateRouletteModal } from '../components/DateRouletteModal'
import { MemoryModal } from '../components/MemoryModal'
import { categories, categoryMap } from '../data/categories'
import { getDateKey } from '../data/dailyQuestions'
import { dateIdeas } from '../data/dateIdeas'
import { wishes } from '../data/wishes'
import type { AppView, CompletionDetails, CustomWishInput, DateIdea, Memory, MemoryInput, Wish } from '../domain/wish'
import { CollectionScreen } from '../features/collection/CollectionScreen'
import { OpeningScreen } from '../features/opening/OpeningScreen'
import { SecretScreen } from '../features/secret/SecretScreen'
import { StoryScreen } from '../features/story/StoryScreen'
import { HomeScreen } from '../features/today/HomeScreen'
import { TogetherScreen } from '../features/together/TogetherScreen'
import { ExploreScreen } from '../features/wishes/ExploreScreen'
import { useCloudAccount } from '../hooks/useCloudAccount'
import { usePwaInstall } from '../hooks/usePwaInstall'
import { useWishProgress } from '../hooks/useWishProgress'
import { daysSince } from '../utils/date'
import { AppShell } from './AppShell'

interface CelebrationState { type: CelebrationType; nonce: number }

export function App() {
  const appState = useWishProgress()
  const pwaInstall = usePwaInstall()
  const cloudAccount = useCloudAccount()
  const [view, setView] = useState<AppView>(() => appState.state.hasOpened ? 'today' : 'opening')
  const [toast, setToast] = useState('')
  const [addWishOpen, setAddWishOpen] = useState(false)
  const [rouletteOpen, setRouletteOpen] = useState(false)
  const [completionWish, setCompletionWish] = useState<Wish | null>(null)
  const [memoryEditor, setMemoryEditor] = useState<Memory | 'new' | null>(null)
  const [storyFocusId, setStoryFocusId] = useState<string>()
  const [celebration, setCelebration] = useState<CelebrationState | null>(null)

  const allWishes = useMemo(() => [...wishes, ...appState.state.customWishes], [appState.state.customWishes])
  const rouletteIdeas = useMemo<DateIdea[]>(() => [
    ...dateIdeas,
    ...appState.state.customWishes
      .filter((wish) => !appState.state.progress[wish.id]?.completed)
      .map((wish) => ({
        id: `wish:${wish.id}`,
        title: wish.title,
        description: wish.description,
        moment: wish.moment,
        category: wish.category,
        setting: wish.setting ?? 'either',
        duration: wish.duration ?? 'evening',
      })),
  ], [appState.state.customWishes, appState.state.progress])
  const completionProgress = useMemo(() => {
    if (!completionWish) return undefined
    const progress = appState.state.progress[completionWish.id]
    if (!progress) return undefined
    const memory = appState.state.memories.find((item) => item.linkedWishId === completionWish.id)
    return memory ? {
      ...progress,
      completedAt: memory.occurredAt,
      note: memory.story,
      photoDataUrl: memory.media[0]?.dataUrl,
    } : progress
  }, [appState.state.memories, appState.state.progress, completionWish])

  const notify = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2700)
  }, [])
  const navigate = useCallback((nextView: AppView) => {
    setView(nextView)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])
  const celebrate = useCallback((type: CelebrationType) => {
    setCelebration({ type, nonce: Date.now() })
  }, [])
  const clearCelebration = useCallback(() => setCelebration(null), [])
  const clearStoryFocus = useCallback(() => setStoryFocusId(undefined), [])

  const enterGift = () => { appState.markOpened(); navigate('today') }
  const saveCustomWish = (input: CustomWishInput) => {
    appState.addCustomWish(input)
    setAddWishOpen(false)
    celebrate('save')
    notify(input.createdBy === 'partner' ? '她的愿望已经写进未来' : '新的愿望已经替你们收好')
  }
  const keepDateIdea = (idea: DateIdea) => {
    if (idea.id.startsWith('wish:')) {
      setRouletteOpen(false)
      navigate('collection')
      notify('它本来就在你们亲手写下的愿望里')
      return
    }
    appState.addCustomWish({
      title: idea.title,
      description: idea.description,
      moment: idea.moment,
      category: idea.category,
      createdBy: 'me',
      setting: idea.setting,
      duration: idea.duration,
      source: 'date-idea',
    })
    setRouletteOpen(false)
    celebrate('save')
    notify('今晚的约会已经留进愿望清单')
  }
  const saveCompletion = (details: CompletionDetails) => {
    if (!completionWish) return
    const wasCompleted = Boolean(appState.state.progress[completionWish.id]?.completed)
    appState.completeWish(completionWish, details)
    setCompletionWish(null)
    if (!wasCompleted) celebrate('complete')
    notify(wasCompleted ? '这段回忆和故事宇宙已经同步更新' : '愿望实现了，一颗新星已经升起')
  }
  const saveMemory = (input: MemoryInput) => {
    if (memoryEditor && memoryEditor !== 'new') {
      appState.updateMemory(memoryEditor.id, input)
      notify('这段故事已经在三个世界里同步更新')
    } else {
      appState.addMemory(input)
      celebrate('save')
      notify('新的故事已经变成一颗星')
    }
    setMemoryEditor(null)
    navigate('story')
  }
  const openMemory = (memoryId: string) => {
    setStoryFocusId(memoryId)
    navigate('story')
  }
  const openSecret = () => {
    appState.markSecretOpened()
    navigate('secret')
    celebrate('secret')
  }

  return (
    <AppShell view={view} memoryCount={appState.stats.memoryCount}
      romanceEffects={appState.state.preferences.romanceEffects} onNavigate={navigate}>
      {view === 'opening' && <OpeningScreen returning={appState.state.hasOpened} onEnter={enterGift} />}
      {view === 'today' && <HomeScreen profile={appState.state.profile}
        dailyAnswer={appState.state.dailyAnswers[getDateKey()]} onThisDayMemory={appState.onThisDayMemory}
        savedCount={appState.stats.saved} completedCount={appState.stats.completed}
        customCount={appState.state.customWishes.length} daysTogether={daysSince(appState.state.profile.anniversaryDate)}
        onSaveDailyAnswer={appState.saveDailyAnswer} onOpenRoulette={() => setRouletteOpen(true)}
        onOpenAddWish={() => setAddWishOpen(true)} onOpenMemory={openMemory}
        onNavigate={navigate} onNotify={notify} />}
      {view === 'explore' && <ExploreScreen wishes={allWishes} categories={categories} categoryMap={categoryMap}
        profile={appState.state.profile} progress={appState.state.progress} savedCount={appState.stats.saved}
        completedCount={appState.stats.completed} onToggleSaved={appState.toggleSaved}
        onComplete={setCompletionWish} onViewed={appState.markWishViewed} onAddWish={() => setAddWishOpen(true)}
        onOpenCollection={() => navigate('collection')} onCelebrateSave={() => celebrate('save')} onNotify={notify} />}
      {view === 'collection' && <CollectionScreen wishes={allWishes} categories={categories} categoryMap={categoryMap}
        progress={appState.state.progress} memories={appState.state.memories} savedCount={appState.stats.saved} completedCount={appState.stats.completed}
        selectedCount={appState.stats.selected} secretUnlocked={appState.isSecretUnlocked}
        secretOpenedAt={appState.state.secretOpenedAt} onToggleSaved={appState.toggleSaved}
        onComplete={setCompletionWish} onUndoCompletion={appState.undoCompletion}
        onDeleteCustomWish={appState.deleteCustomWish} onOpenSecret={openSecret}
        onExplore={() => navigate('explore')} onAddWish={() => setAddWishOpen(true)} onNotify={notify} />}
      {view === 'story' && <StoryScreen memories={appState.state.memories} capsules={appState.state.capsules}
        profile={appState.state.profile} focusMemoryId={storyFocusId} onFocusHandled={clearStoryFocus}
        onAddMemory={() => setMemoryEditor('new')} onEditMemory={setMemoryEditor}
        onDeleteMemory={appState.deleteMemory} onNotify={notify} />}
      {view === 'together' && <TogetherScreen profile={appState.state.profile} capsules={appState.state.capsules}
        completedCount={appState.stats.completed} memoryCount={appState.stats.memoryCount} photoCount={appState.stats.memoriesWithPhotos}
        answerCount={Object.keys(appState.state.dailyAnswers).length} customWishCount={appState.state.customWishes.length}
        romanceEffects={appState.state.preferences.romanceEffects} secretUnlocked={appState.isSecretUnlocked}
        isStandalone={pwaInstall.isStandalone} canInstall={pwaInstall.canInstall} isIos={pwaInstall.isIos}
        cloudAccount={cloudAccount} exportData={JSON.stringify(appState.state, null, 2)} onSaveProfile={appState.saveProfile}
        onAddCapsule={appState.addCapsule} onOpenCapsule={appState.openCapsule} onDeleteCapsule={appState.deleteCapsule}
        onSetRomanceEffects={appState.setRomanceEffects} onInstall={pwaInstall.install} onImport={appState.importState}
        onOpenSecret={openSecret} onReopenGift={() => navigate('opening')} onCelebrateCapsule={() => celebrate('capsule')}
        onNotify={notify} />}
      {view === 'secret' && <SecretScreen openedAt={appState.state.secretOpenedAt} onBack={() => navigate('story')} />}

      {addWishOpen && <CustomWishModal categories={categories} profile={appState.state.profile}
        onSave={saveCustomWish} onClose={() => setAddWishOpen(false)} />}
      {completionWish && <CompletionModal wish={completionWish} progress={completionProgress}
        onSave={saveCompletion} onClose={() => setCompletionWish(null)} />}
      {memoryEditor && <MemoryModal memory={memoryEditor === 'new' ? undefined : memoryEditor}
        profile={appState.state.profile} onSave={saveMemory} onClose={() => setMemoryEditor(null)} />}
      {rouletteOpen && <DateRouletteModal ideas={rouletteIdeas} onKeep={keepDateIdea} onClose={() => setRouletteOpen(false)} />}
      {celebration && appState.state.preferences.romanceEffects && <CelebrationOverlay type={celebration.type}
        nonce={celebration.nonce} onDone={clearCelebration} />}
      <div className={`toast${toast ? ' is-visible' : ''}`} role="status" aria-live="polite"><span aria-hidden="true">♥</span>{toast}</div>
    </AppShell>
  )
}
