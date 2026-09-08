'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'

type LoginProfile = {
  id: string
  role: string | null
  is_admin: boolean | null
}

function destinationForRole(role: string | null) {
  if (role === 'admin') return '/admin'
  if (role === 'company' || role === 'staffing_agency') {
    return '/company/dashboard'
  }
  if (role === 'worker') return '/worker/dashboard'
  return '/profile'
}

export default function LoginPage() {
  const t = useTranslations('Login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  function openResetMode() {
    setResetMode(true)
    setPassword('')
    setMessage(null)
    setSuccessMessage(null)
  }

  function closeResetMode() {
    setResetMode(false)
    setPassword('')
    setMessage(null)
    setSuccessMessage(null)
  }

  async function handleForgotPassword(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (loading || resetLoading) return

    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail) {
      setSuccessMessage(null)
      setMessage(t('enterEmail'))
      return
    }

    setResetLoading(true)
    setMessage(null)
    setSuccessMessage(null)

    try {
      const redirectTo =
        'https://usecrewcall.com/reset-password'

      const { error } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo,
          }
        )

      if (error) throw error

      setSuccessMessage(
        t('resetEmailSent')
      )
    } catch (error) {
      console.error(
        'CrewCall password recovery error:',
        error
      )

      setMessage(
        error instanceof Error
          ? error.message
          : t('resetEmailFailed')
      )
    } finally {
      setResetLoading(false)
    }
  }

  async function handleLogin(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (loading) return

    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail) {
      setMessage(t('enterEmail'))
      return
    }

    if (!password) {
      setMessage(t('enterPassword'))
      return
    }

    setLoading(true)
    setMessage(null)
    setSuccessMessage(null)

    try {
      const {
        data: loginData,
        error: loginError,
      } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      })

      if (loginError) throw loginError

      if (!loginData.user || !loginData.session) {
        throw new Error(
          t('sessionNotCreated')
        )
      }

      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError

      if (!sessionData.session) {
        throw new Error(
          t('sessionNotSaved')
        )
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select('id, role, is_admin')
        .eq('id', loginData.user.id)
        .maybeSingle<LoginProfile>()

      if (profileError) throw profileError

      console.log(
        'LOGIN PROFILE CHECK:',
        JSON.stringify(profile)
      )

      const requestedRedirect =
        new URLSearchParams(
          window.location.search
        ).get('redirect')

      const safeRedirect =
        requestedRedirect &&
        requestedRedirect.startsWith('/') &&
        !requestedRedirect.startsWith('//')
          ? requestedRedirect
          : null

      const destination =
        profile?.is_admin
          ? '/admin'
          : safeRedirect ||
            destinationForRole(
              profile?.role || null
            )

      console.log(
        'LOGIN DESTINATION:',
        destination
      )

      window.location.assign(destination)
    } catch (error) {
      console.error(
        'CrewCall login error:',
        error
      )

      setMessage(
        error instanceof Error
          ? error.message
          : t('loginFailed')
      )

      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl">
        <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

        <div className="p-6 sm:p-8">
          <div className="mb-7">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
              CrewCall
            </p>

            <h1 className="mt-3 text-3xl font-black">
              {resetMode
                ? t('resetPassword')
                : t('welcomeBack')}
            </h1>

            <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
              {resetMode
                ? t('resetDescription')
                : t('loginDescription')}
            </p>
          </div>

          {resetMode ? (
            <form
              onSubmit={handleForgotPassword}
              className="space-y-5"
            >
              <div>
                <label
                  htmlFor="reset-email"
                  className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
                >
                  {t('email')}
                </label>

                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  disabled={resetLoading}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  required
                  placeholder={t('emailPlaceholder')}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              {message ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-200">
                  {message}
                </div>
              ) : null}

              {successMessage ? (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-200">
                  {successMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resetLoading
                  ? t('sendingResetLink')
                  : t('sendResetLink')}
              </button>

              <button
                type="button"
                onClick={closeResetMode}
                disabled={resetLoading}
                className="w-full text-sm font-black text-cyan-300 transition hover:text-cyan-200 disabled:opacity-60"
              >
                ← {t('backToLogin')}
              </button>
            </form>
          ) : (
            <>
              <form
                onSubmit={handleLogin}
                className="space-y-5"
              >
                <div>
                  <label
                    htmlFor="email"
                    className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
                  >
                    {t('email')}
                  </label>

                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    disabled={loading}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    required
                    placeholder={t('emailPlaceholder')}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
                    >
                      {t('password')}
                    </label>

                    <button
                      type="button"
                      onClick={openResetMode}
                      disabled={loading}
                      className="text-xs font-black text-cyan-300 transition hover:text-cyan-200 disabled:opacity-60"
                    >
                      {t('forgotPassword')}
                    </button>
                  </div>

                  <div className="relative mt-2">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      disabled={loading}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      required
                      placeholder={t('passwordPlaceholder')}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 pr-12 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      disabled={loading}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {showPassword ? (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="h-5 w-5"
                          aria-hidden="true"
                        >
                          <path d="M3 3l18 18" />
                          <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                          <path d="M9.9 4.2A10.5 10.5 0 0112 4c5.5 0 9 5 9 5a15.4 15.4 0 01-2.1 2.6" />
                          <path d="M6.6 6.6C4.4 8 3 10 3 10s3.5 5 9 5c1 0 1.9-.2 2.8-.4" />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="h-5 w-5"
                          aria-hidden="true"
                        >
                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {message ? (
                  <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-200">
                    {message}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? t('loggingIn')
                    : t('logIn')}
                </button>
              </form>

              <p className="mt-6 text-center text-sm font-semibold text-slate-500">
                {t('dontHaveAccount')}{' '}
                <Link
                  href="/signup"
                  className="font-black text-cyan-300 hover:text-cyan-200"
                >
                  {t('signUp')}
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
