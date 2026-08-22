'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let active = true

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return

        if (
          event === 'PASSWORD_RECOVERY' &&
          session
        ) {
          setReady(true)
          setMessage(null)
        }
      }
    )

    async function prepareRecoverySession() {
      try {
        const params =
          new URLSearchParams(
            window.location.search
          )

        const tokenHash =
          params.get('token_hash')

        const type =
          params.get('type')

        const code =
          params.get('code')

        if (
          tokenHash &&
          type === 'recovery'
        ) {
          const {
            data,
            error,
          } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          })

          if (error) {
            throw error
          }

          if (!data.session) {
            throw new Error(
              'CrewCall could not open this password reset session.'
            )
          }

          window.history.replaceState(
            {},
            '',
            '/reset-password'
          )

          if (active) {
            setReady(true)
            setMessage(null)
          }

          return
        }

        if (code) {
          const { error } =
            await supabase.auth
              .exchangeCodeForSession(code)

          if (error) {
            throw error
          }
        }

        const {
          data,
          error,
        } =
          await supabase.auth.getSession()

        if (error) {
          throw error
        }

        if (data.session) {
          if (active) {
            setReady(true)
            setMessage(null)
          }
          return
        }

        if (active) {
          setMessage(
            'This password reset link is invalid or has expired. Please request a new one.'
          )
        }
      } catch (error) {
        console.error(
          'CrewCall recovery session error:',
          error
        )

        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Unable to open this password reset link.'
          )
        }
      }
    }

    void prepareRecoverySession()

    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  async function handleReset(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (loading) return

    if (password.length < 10) {
      setMessage(
        'Your new password must be at least 10 characters.'
      )
      return
    }

    if (
      password !== confirmPassword
    ) {
      setMessage(
        'The passwords do not match.'
      )
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const { error } =
        await supabase.auth.updateUser({
          password,
        })

      if (error) {
        throw error
      }

      setSuccess(true)
      setPassword('')
      setConfirmPassword('')
    } catch (error) {
      console.error(
        'CrewCall password reset error:',
        error
      )

      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update your password. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl">
        <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

        <div className="p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            CrewCall
          </p>

          <h1 className="mt-3 text-3xl font-black">
            Reset Password
          </h1>

          <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
            Choose a new password for your CrewCall account.
          </p>

          {success ? (
            <div className="mt-7">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-200">
                Your password has been updated successfully.
              </div>

              <Link
                href="/login"
                className="mt-5 block w-full rounded-2xl bg-cyan-400 px-4 py-3 text-center font-black text-slate-950 transition hover:bg-cyan-300"
              >
                Return to Login
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleReset}
              className="mt-7 space-y-5"
            >
              <div>
                <label
                  htmlFor="password"
                  className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
                >
                  New Password
                </label>

                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  disabled={!ready || loading}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  required
                  minLength={10}
                  placeholder="At least 10 characters"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
                >
                  Confirm New Password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  disabled={!ready || loading}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                  required
                  minLength={10}
                  placeholder="Enter it again"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              {message ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-200">
                  {message}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={!ready || loading}
                className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? 'Updating Password...'
                  : ready
                    ? 'Update Password'
                    : 'Opening Reset Link...'}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
