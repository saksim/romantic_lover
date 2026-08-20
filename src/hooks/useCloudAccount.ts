import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAccountGatewayBootstrapState, loadAccountGateway, type AccountGateway } from '../cloud/accountGatewayFactory'
import { friendlyCloudError } from '../cloud/friendlyCloudError'
import type { BackendProvider } from '../config/backend'
import type { AccountIdentity, CloudSession, CoupleInvite } from '../domain/cloud'
import type { CoupleContext, CreateCoupleInput, SignInInput, SignUpInput } from '../sync/SyncGateway'

export type SignUpActionResult = 'signed-in' | 'confirmation-required' | 'verification-required' | 'failed'

export interface CloudAccountController {
  provider: BackendProvider
  enabled: boolean
  ready: boolean
  configurationIssue?: string
  loading: boolean
  busy: boolean
  session: CloudSession | null
  profile: AccountIdentity | null
  couple: CoupleContext | null
  invite: CoupleInvite | null
  confirmationEmail?: string
  signUpVerification?: {
    kind: 'email-otp'
    destination: string
  }
  error?: string
  clearError: () => void
  clearSignUpVerification: () => void
  refresh: () => Promise<void>
  signUp: (input: SignUpInput) => Promise<SignUpActionResult>
  verifySignUp: (code: string) => Promise<boolean>
  signIn: (input: SignInInput) => Promise<boolean>
  signOut: () => Promise<boolean>
  updateProfile: (displayName: string) => Promise<boolean>
  createCouple: (input: CreateCoupleInput) => Promise<boolean>
  joinWithInvite: (code: string) => Promise<boolean>
  createInvite: () => Promise<boolean>
  leaveCouple: () => Promise<boolean>
}

export function useCloudAccount(): CloudAccountController {
  const gatewayBootstrap = useMemo(getAccountGatewayBootstrapState, [])
  const [gateway, setGateway] = useState<AccountGateway | null>(null)
  const mounted = useRef(true)
  const operationInFlight = useRef(false)
  const [loading, setLoading] = useState(gatewayBootstrap.enabled && !gatewayBootstrap.issue)
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState<CloudSession | null>(null)
  const [profile, setProfile] = useState<AccountIdentity | null>(null)
  const [couple, setCouple] = useState<CoupleContext | null>(null)
  const [invite, setInvite] = useState<CoupleInvite | null>(null)
  const [confirmationEmail, setConfirmationEmail] = useState<string>()
  const [signUpVerification, setSignUpVerification] = useState<CloudAccountController['signUpVerification']>()
  const [error, setError] = useState<string>()

  const clearError = useCallback(() => setError(undefined), [])
  const clearSignUpVerification = useCallback(() => {
    gateway?.cancelSignUpVerification?.()
    setSignUpVerification(undefined)
  }, [gateway])
  const markGatewayUnavailable = useCallback(() => {
    setError(friendlyCloudError({ code: 'gateway_unavailable' }))
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!gatewayBootstrap.enabled || gatewayBootstrap.issue) {
      setLoading(false)
      return
    }

    void loadAccountGateway()
      .then((nextGateway) => {
        if (cancelled) return
        setGateway(nextGateway)
        if (!nextGateway) setLoading(false)
      })
      .catch((nextError) => {
        if (cancelled) return
        setError(friendlyCloudError(nextError))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [gatewayBootstrap.enabled, gatewayBootstrap.issue])

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
      if (!gatewayBootstrap.enabled || gatewayBootstrap.issue) setLoading(false)
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
  }, [gateway, gatewayBootstrap.enabled, gatewayBootstrap.issue, refresh])

  const run = useCallback(async (action: () => Promise<void>) => {
    if (operationInFlight.current) return false
    operationInFlight.current = true
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
      operationInFlight.current = false
    }
  }, [refresh])

  const signUp = useCallback(async (input: SignUpInput): Promise<SignUpActionResult> => {
    if (!gateway) {
      markGatewayUnavailable()
      return 'failed'
    }
    setBusy(true)
    setError(undefined)
    setConfirmationEmail(undefined)
    try {
      const result = await gateway.signUp(input)
      if (result.verification?.kind === 'email-otp') {
        setSignUpVerification({
          kind: 'email-otp',
          destination: result.verification.destination,
        })
        return 'verification-required'
      }
      if (result.confirmationRequired) {
        setConfirmationEmail(input.identifier.trim())
        setSignUpVerification(undefined)
        await refresh()
        return 'confirmation-required'
      }
      setSignUpVerification(undefined)
      await refresh()
      return 'signed-in'
    } catch (nextError) {
      setError(friendlyCloudError(nextError))
      return 'failed'
    } finally {
      setBusy(false)
    }
  }, [gateway, markGatewayUnavailable, refresh])

  const verifySignUp = useCallback(async (code: string) => {
    if (!gateway?.verifySignUp) {
      markGatewayUnavailable()
      return false
    }
    setBusy(true)
    setError(undefined)
    try {
      await gateway.verifySignUp(code)
      setSignUpVerification(undefined)
      setConfirmationEmail(undefined)
      await refresh()
      return true
    } catch (nextError) {
      setError(friendlyCloudError(nextError))
      return false
    } finally {
      setBusy(false)
    }
  }, [gateway, markGatewayUnavailable, refresh])

  const signIn = useCallback((input: SignInInput) => {
    if (!gateway) {
      markGatewayUnavailable()
      return Promise.resolve(false)
    }
    return run(async () => {
      await gateway.signIn(input)
      setConfirmationEmail(undefined)
      setSignUpVerification(undefined)
    })
  }, [gateway, markGatewayUnavailable, run])

  const signOut = useCallback(() => {
    if (!gateway) return Promise.resolve(false)
    return run(async () => {
      await gateway.signOut()
      setConfirmationEmail(undefined)
      setSignUpVerification(undefined)
      setInvite(null)
    })
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
    provider: gatewayBootstrap.provider,
    enabled: gatewayBootstrap.enabled,
    ready: Boolean(gateway),
    configurationIssue: gatewayBootstrap.issue,
    loading,
    busy,
    session,
    profile,
    couple,
    invite,
    confirmationEmail,
    signUpVerification,
    error,
    clearError,
    clearSignUpVerification,
    refresh,
    signUp,
    verifySignUp,
    signIn,
    signOut,
    updateProfile,
    createCouple,
    joinWithInvite,
    createInvite,
    leaveCouple,
  }
}
