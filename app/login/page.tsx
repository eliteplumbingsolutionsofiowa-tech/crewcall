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
  if (role === 'homeowner') return '/homeowner/dashboard'
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
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* Full-screen CrewCall trades background */}
      <div
        className="absolute inset-0 bg-cover bg-center lg:bg-[center_45%]"
        style={{
          backgroundImage:
            "url('/brand/crewcall-login-bg.png')",
        }}
      />

      {/* Cinematic overlays */}
      <div className="absolute inset-0 bg-slate-950/15" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/65 via-slate-950/25 to-slate-950/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-slate-950/10" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col items-center gap-8 px-5 pb-10 pt-4 sm:px-8 lg:flex-row lg:gap-12 lg:px-12 lg:pb-10">
          {/* Hero */}
          <section className="w-full max-w-3xl pt-4 lg:w-[58%] lg:flex-none lg:pt-0">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.9)]" />
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">
                Built for the skilled trades
              </span>
            </div>

            <h1 className="max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-[-0.04em] text-white drop-shadow-2xl sm:text-5xl lg:text-6xl xl:text-7xl">
              The Skilled Trades.
              <span className="block text-cyan-300">
                All In One Place.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg font-bold leading-7 text-slate-100 drop-shadow-lg sm:text-xl lg:text-xl">
              Find help. Find work. Find contractors. Fast.
            </p>

            <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-slate-300 sm:text-base">
              One network connecting the people who build,
              repair, maintain, and improve America.
            </p>

            <div className="mt-7 grid max-w-2xl grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ['⚒', 'Workers'],
                ['▣', 'Companies'],
                ['⌂', 'Contractors'],
                ['⌂', 'Homeowners'],
              ].map(([icon, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-3 text-center shadow-xl backdrop-blur-md"
                >
                  <div className="text-xl text-cyan-300">
                    {icon}
                  </div>
                  <div className="mt-1 text-xs font-black uppercase tracking-[0.08em] text-white">
                    {label}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 hidden items-center gap-3 text-xs font-black uppercase tracking-[0.14em] text-slate-300 sm:flex">
              <span>Built for the Trades</span>
              <span className="text-cyan-300">•</span>
              <span>Built in Iowa</span>
              <span className="text-cyan-300">•</span>
              <span>Built to Connect America</span>
            </div>
          </section>

          {/* Login card */}
          <section className="w-full overflow-hidden rounded-[2rem] border border-white/15 bg-slate-950/80 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl lg:w-[42%] lg:flex-none">
            <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

            <div className="p-6 sm:p-7 lg:p-8">
              <div className="mb-7">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                  CrewCall
                </p>

                <h2 className="mt-3 text-3xl font-black">
                  {resetMode
                    ? t('resetPassword')
                    : t('welcomeBack')}
                </h2>

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
                      className="text-xs font-black uppercase tracking-[0.14em] text-slate-400"
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
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60"
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
                    className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
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
                        className="text-xs font-black uppercase tracking-[0.14em] text-slate-400"
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
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="password"
                          className="text-xs font-black uppercase tracking-[0.14em] text-slate-400"
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
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 pr-12 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowPassword((value) => !value)
                          }
                          disabled={loading}
                          aria-label={
                            showPassword
                              ? 'Hide password'
                              : 'Show password'
                          }
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
                      className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading
                        ? t('loggingIn')
                        : t('logIn')}
                    </button>
                  </form>

                  <div className="my-6 flex items-center gap-4">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                      New to CrewCall?
                    </span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>

                  <Link
                    href="/signup"
                    className="flex w-full items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/15"
                  >
                    Join the Skilled Trades Network →
                  </Link>

                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
