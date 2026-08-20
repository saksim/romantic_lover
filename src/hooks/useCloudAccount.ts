import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SupabaseAccountGateway } from '../cloud/SupabaseAccountGateway'
import { friendlyCloudError } from '../cloud/friendlyCloudError'
import { getSupabaseClientState } from '../cloud/supabaseClient'
import type { AccountIdentity, CloudSession, CoupleInvite } from '../domain/cloud'
import type { CoupleContext, CreateCoupleInput, SignInInput, SignUpInput } from '../sync/SyncGateway'

export type SignUpActionResult = 'signed-in' | 'confirmation-required' | 'failed'

export interface CloudAccountController {
  enabled: boolean
  configurationIssue?: string
  loading: boolean
  busy: boolean
  session: CloudSession | null
  profile: AccountIdentity | null
  couple: CoupleContext | null
  invite: CoupleInvite | null
  confirmationEmail?: string
  error?: string
  clearError: () => void
  refresh: () => Promise<void>
  signUp: (input: SignUpInput) => Promise<SignUpActionResult>
  signIn: (input: SignInInput) => Promise<boolean>
  signOut: () => Promise<boolean>
  updateProfile: (displayName: string) => Promise<boolean>
  createCouple: (input: CreateCoupleInput) => Promise<boolean>
  joinWithInvite: (code: string) => Promise<boolean>
  createInvite: () => Promise<boolean>
  leaveCouple: () => Promise<boolean>
}

export function useCloudAccount(): CloudAccountController {
  const clientState = useMemo(getSupabaseClientState, [])
  const gateway = useMemo(
    () => clientState.client ? new SupabaseAccountGateway(clientState.client) : null,
    [clientState.client],
  )
  const mounted = useRef(true)
  const [loading, setLoading] = useState(Boolean(gateway))
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState<CloudSession | null>(null)
  const [profile, setProfile] = useState<AccountIdentity | null>(null)
  const [couple, setCouple] = useState<CoupleContext | null>(null)
  const [invite, setInvite] = useState<CoupleInvite | null>(null)
  const [confirmationEmail, setConfirmationEmail] = useState<string>()
  const [error, setError] = useState<string>()

  const clearError = useCallback(() => setError(undefined), [])

  const refresh = useCallback(async () => {
    if (!gateway) {
      setLoading(false)
      return
    }
    try {
      const nextSession = await gateway.getSession()
      if (!mounted.current) return
      setSession(nextSession)
      if (!nextSession) {
        setProfile(null)
        setCouple(null)
        setInvite(null)
        return
      }
      const [nextProfile, nextCouple] = await Promise.all([
        gateway.getProfile(),
        gateway.getActiveCouple(),
      ])
      if (!mounted.current) return
      setProfile(nextProfile)
      setCouple(nextCouple)
      if (!nextCouple) setInvite(null)
    } catch (nextError) {
      if (mounted.current) setError(friendlyCloudError(nextError))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [gateway])

  useEffect(() => {
    mounted.current = true
    if (!gateway) {
      setLoading(false)
      return () => { mounted.current = false }
    }
    void refresh()
    const unsubscribe = gateway.onSessionChange((nextSession) => {
      if (!mounted.current) return
      setSession(nextSession)
      if (!nextSession) {
        setProfile(null)
        setCouple(null)
        setInvite(null)
      } else {
        window.setTimeout(() => void refresh(), 0)
      }
    })
    return () => {
      mounted.current = false
      unsubscribe()
    }
  }, [gateway, refresh])

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true)
    setError(undefined)
    try {
      await action()
      await refresh()
      return true
    } catch (nextError) {
      setError(friendlyCloudError(nextError))
      return false
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const signUp = useCallback(async (input: SignUpInput): Promise<SignUpActionResult> => {
    if (!gateway) return 'failed'
    setBusy(true)
    setError(undefined)
    setConfirmationEmail(undefined)
    try {
      const result = await gateway.signUp(input)
      if (result.confirmationRequired) {
        setConfirmationEmail(input.identifier.trim())
        await refresh()
        return 'confirmation-required'
      }
      await refresh()
      return 'signed-in'
    } catch (nextError) {
      setError(friendlyCloudError(nextError))
      return 'failed'
    } finally {
      setBusy(false)
    }
  }, [gateway, refresh])

  const signIn = useCallback((input: SignInInput) => {
    if (!gateway) return Promise.resolve(false)
    return run(async () => { await gateway.signIn(input); setConfirmationEmail(undefined) })
  }, [gateway, run])

  const signOut = useCallback(() => {
    if (!gateway) return Promise.resolve(false)
    return run(async () => { await gateway.signOut(); setConfirmationEmail(undefined); setInvite(null) })
  }, [gateway, run])

  const updateProfile = useCallback((displayName: string) => {
    if (!gateway) return Promise.resolve(false)
    return run(async () => { await gateway.updateProfile(displayName) })
  }, [gateway, run])

  const createCouple = useCallback((input: CreateCoupleInput) => {
    if (!gateway) return Promise.resolve(false)
    return run(async () => { await gateway.createCouple(input); setInvite(null) })
  }, [gateway, run])

  const joinWithInvite = useCallback((code: string) => {
    if (!gateway) return Promise.resolve(false)
    return run(async () => { await gateway.joinWithInvite(code); setInvite(null) })
  }, [gateway, run])

  const createInvite = useCallback(async () => {
    if (!gateway || !couple) return false
    setBusy(true)
    setError(undefined)
    try {
      setInvite(await gateway.createInvite(couple.couple.id))
      return true
    } catch (nextError) {
      setError(friendlyCloudError(nextError))
      return false
    } finally {
      setBusy(false)
    }
  }, [couple, gateway])

  const leaveCouple = useCallback(() => {
    if (!gateway || !couple) return Promise.resolve(false)
    return run(async () => { await gateway.leaveCouple(couple.couple.id); setInvite(null) })
  }, [couple, gateway, run])

  return {
    enabled: clientState.enabled,
    configurationIssue: clientState.issue,
    loading,
    busy,
    session,
    profile,
    couple,
    invite,
    confirmationEmail,
    error,
    clearError,
    refresh,
    signUp,
    signIn,
    signOut,
    updateProfile,
    createCouple,
    joinWithInvite,
    createInvite,
    leaveCouple,
  }
}
