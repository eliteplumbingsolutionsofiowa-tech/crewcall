'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Role = 'worker' | 'company'

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950" />
      }
    >
      <SignupForm />
    </Suspense>
  )
}

function SignupForm() {
  const searchParams = useSearchParams()

  const inviteCode =
    searchParams.get('invite') || null

  const invitedEmail =
    searchParams.get('email') || ''

  const [email, setEmail] =
    useState(invitedEmail)

  const [password, setPassword] =
    useState('')

  const [fullName, setFullName] =
    useState('')

  const [phone, setPhone] =
    useState('')

  const [role, setRole] =
    useState<Role>('worker')

  const [loading, setLoading] =
    useState(false)

  const [message, setMessage] =
    useState<string | null>(null)

  const [existingAccount, setExistingAccount] =
    useState(false)

  const acceptingTeamInvite =
    Boolean(inviteCode)

  const acceptTeamInvite = useCallback(
    async (
      accessToken: string,
      inviteId: string
    ) => {
      const response = await fetch(
        '/api/company/team-invite/accept',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Authorization:
              `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            inviteId,
          }),
        }
      )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result?.error ||
            'Could not accept team invitation.'
        )
      }

      return result
    },
    []
  )

  useEffect(() => {
    if (invitedEmail) {
      setEmail(invitedEmail)
    }
  }, [invitedEmail])

  useEffect(() => {
    if (!inviteCode) return

    let active = true

    async function acceptIfSignedIn() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (
        !active ||
        !session?.access_token
      ) {
        return
      }

      const sessionEmail =
        session.user.email
          ?.trim()
          .toLowerCase() || ''

      const targetEmail =
        invitedEmail
          .trim()
          .toLowerCase()

      if (
        targetEmail &&
        sessionEmail !== targetEmail
      ) {
        await supabase.auth.signOut()

        if (!active) return

        setMessage(
          `This invitation is for ${invitedEmail}. Sign in or create an account with that email to continue.`
        )
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setMessage(
          'Accepting your CrewCall team invitation...'
        )

        await acceptTeamInvite(
          session.access_token,
          inviteCode!
        )

        if (!active) return

        window.location.assign(
          '/profile?teamInvite=accepted'
        )
      } catch (error) {
        if (!active) return

        setMessage(
          error instanceof Error
            ? error.message
            : 'Could not accept team invitation.'
        )

        setLoading(false)
      }
    }

    void acceptIfSignedIn()

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (
          event !== 'SIGNED_IN' ||
          !session?.access_token ||
          !inviteCode
        ) {
          return
        }

        try {
          await acceptTeamInvite(
            session.access_token,
            inviteCode
          )

          if (active) {
            window.location.assign(
              '/profile?teamInvite=accepted'
            )
          }
        } catch (error) {
          if (active) {
            setMessage(
              error instanceof Error
                ? error.message
                : 'Could not accept team invitation.'
            )
            setLoading(false)
          }
        }
      }
    )

    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [
    acceptTeamInvite,
    inviteCode,
    invitedEmail,
  ])

  async function handleExistingUserSignIn(
    e: React.FormEvent
  ) {
    e.preventDefault()

    setLoading(true)
    setMessage(null)

    const cleanEmail =
      email.trim().toLowerCase()

    if (
      invitedEmail &&
      cleanEmail !==
        invitedEmail
          .trim()
          .toLowerCase()
    ) {
      setMessage(
        `This invitation was sent to ${invitedEmail}.`
      )
      setLoading(false)
      return
    }

    const {
      data,
      error,
    } =
      await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      })

    if (error) {
      setMessage(
        error.message ===
          'Invalid login credentials'
          ? 'Incorrect email or password. Please try again.'
          : error.message
      )
      setLoading(false)
      return
    }

    if (
      inviteCode &&
      data.session?.access_token
    ) {
      try {
        setMessage(
          'Signing in and joining your company team...'
        )

        await acceptTeamInvite(
          data.session.access_token,
          inviteCode
        )

        window.location.assign(
          '/profile?teamInvite=accepted'
        )
        return
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Signed in, but the team invitation could not be accepted.'
        )
        setLoading(false)
        return
      }
    }

    window.location.assign('/profile')
  }

  async function handleSignup(
    e: React.FormEvent
  ) {
    e.preventDefault()

    setLoading(true)
    setMessage(null)

    const cleanEmail =
      email.trim().toLowerCase()

    const cleanFullName =
      fullName.trim()

    const cleanPhone =
      phone.trim()

    if (
      invitedEmail &&
      cleanEmail !==
        invitedEmail
          .trim()
          .toLowerCase()
    ) {
      setMessage(
        `This invitation was sent to ${invitedEmail}.`
      )
      setLoading(false)
      return
    }

    const emailRedirectTo =
      inviteCode
        ? `${window.location.origin}/signup?invite=${encodeURIComponent(
            inviteCode
          )}&email=${encodeURIComponent(
            cleanEmail
          )}`
        : undefined

    const { data, error } =
      await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: cleanFullName,
            phone: cleanPhone,
            role,
            invite_code_used:
              inviteCode,
            team_invite_id:
              inviteCode,
          },
        },
      })

    if (error) {
      const errorText =
        error.message.toLowerCase()

      const userAlreadyExists =
        errorText.includes(
          'already registered'
        ) ||
        errorText.includes(
          'already been registered'
        ) ||
        errorText.includes(
          'user already exists'
        )

      if (
        acceptingTeamInvite &&
        userAlreadyExists
      ) {
        setExistingAccount(true)
        setPassword('')
        setMessage(
          'An account already exists for this email. Sign in below to accept your company invitation.'
        )
        setLoading(false)
        return
      }

      setMessage(error.message)
      setLoading(false)
      return
    }

    if (
      data.session?.access_token &&
      inviteCode
    ) {
      try {
        await acceptTeamInvite(
          data.session.access_token,
          inviteCode
        )

        window.location.assign(
          '/profile?teamInvite=accepted'
        )
        return
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Account created, but the team invitation could not be accepted.'
        )
        setLoading(false)
        return
      }
    }

    try {
      await fetch(
        '/api/email/welcome',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            email: cleanEmail,
            fullName: cleanFullName,
            role,
          }),
        }
      )
    } catch (error) {
      console.error(
        'Welcome email failed:',
        error
      )
    }

    if (inviteCode) {
      setMessage(
        'Account created. Check your email to confirm your account, then CrewCall will finish accepting your team invitation.'
      )
    } else {
      setMessage(
        'Account created. Check your email to confirm your signup.'
      )
    }

    setLoading(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
          {acceptingTeamInvite
            ? 'CrewCall Team Invitation'
            : 'Join CrewCall'}
        </p>

        <h1 className="mt-4 text-3xl font-black tracking-tight text-white">
          {existingAccount
            ? 'Sign in to join your team'
            : acceptingTeamInvite
              ? 'Join your company team'
              : 'Create your account'}
        </h1>

        <p className="mt-2 text-sm font-semibold text-slate-400">
          {existingAccount
            ? 'This email already has a CrewCall account. Sign in with your existing password to accept the invitation.'
            : acceptingTeamInvite
              ? 'Create or confirm your CrewCall account to accept this company invitation.'
              : 'Sign up as a worker or company.'}
        </p>

        {message && (
          <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm font-bold text-cyan-100">
            {message}
          </div>
        )}

        {existingAccount ? (
          <form
            onSubmit={handleExistingUserSignIn}
            className="mt-8 space-y-5"
          >
            <Field
              label="Email"
              htmlFor="existingEmail"
            >
              <input
                id="existingEmail"
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(
                    e.target.value
                  )
                }
                readOnly={
                  Boolean(invitedEmail)
                }
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400 read-only:opacity-70"
              />
            </Field>

            <Field
              label="Password"
              htmlFor="existingPassword"
            >
              <input
                id="existingPassword"
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                required
                minLength={6}
                autoFocus
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-4 text-sm font-black text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? 'Joining team...'
                : 'Sign In & Join Team'}
            </button>

            <button
              type="button"
              onClick={() => {
                setExistingAccount(false)
                setPassword('')
                setMessage(null)
              }}
              className="w-full rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/5"
            >
              Back to Create Account
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleSignup}
            className="mt-8 space-y-5"
          >
            <Field
              label="Full Name"
              htmlFor="fullName"
            >
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) =>
                  setFullName(
                    e.target.value
                  )
                }
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
              />
            </Field>

            <Field
              label="Phone"
              htmlFor="phone"
            >
              <input
                id="phone"
                type="text"
                value={phone}
                onChange={(e) =>
                  setPhone(
                    e.target.value
                  )
                }
                placeholder="515-555-1234"
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
              />
            </Field>

            {!acceptingTeamInvite && (
              <Field
                label="Role"
                htmlFor="role"
              >
                <select
                  id="role"
                  value={role}
                  onChange={(e) =>
                    setRole(
                      e.target
                        .value as Role
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
                >
                  <option value="worker">
                    Worker
                  </option>
                  <option value="company">
                    Company
                  </option>
                </select>
              </Field>
            )}

            <Field
              label="Email"
              htmlFor="email"
            >
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(
                    e.target.value
                  )
                }
                readOnly={
                  Boolean(invitedEmail)
                }
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400 read-only:opacity-70"
              />
            </Field>

            <Field
              label="Password"
              htmlFor="password"
            >
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                required
                minLength={6}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-4 text-sm font-black text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? acceptingTeamInvite
                  ? 'Joining team...'
                  : 'Creating account...'
                : acceptingTeamInvite
                  ? 'Create Account & Join Team'
                  : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-sm font-black text-slate-200"
      >
        {label}
      </label>

      {children}
    </div>
  )
}
