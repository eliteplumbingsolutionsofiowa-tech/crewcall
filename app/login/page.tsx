'use client'

import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type LoginProfile = {
  id: string
  role: string | null
  is_admin: boolean | null
}

function destinationForRole(role: string | null) {
  if (role === 'admin') return '/admin'
  if (role === 'company') return '/company/dashboard'
  if (role === 'worker') return '/worker/dashboard'
  return '/profile'
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  async function handleForgotPassword() {
    if (loading || resetLoading) return

    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail) {
      setSuccessMessage(null)
      setMessage('Enter your email address first, then tap Forgot Password.')
      return
    }

    setResetLoading(true)
    setMessage(null)
    setSuccessMessage(null)

    try {
      const redirectTo = `${window.location.origin}/reset-password`

      const { error } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        {
          redirectTo,
        }
      )

      if (error) throw error

      setSuccessMessage(
        'Password reset email sent. Check your inbox and follow the link to choose a new password.'
      )
    } catch (error) {
      console.error('CrewCall password recovery error:', error)

      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to send password reset email. Please try again.'
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
      setMessage('Enter your email address.')
      return
    }

    if (!password) {
      setMessage('Enter your password.')
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
          'Login succeeded, but no authenticated session was created.'
        )
      }

      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError

      if (!sessionData.session) {
        throw new Error(
          'Your login session could not be saved. Please try again.'
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

      const destination =
        profile?.is_admin
          ? '/admin'
          : destinationForRole(profile?.role || null)

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
          : 'Login failed. Please try again.'
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
              Welcome Back
            </h1>

            <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
              Log in to your worker, company, or administrator account.
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                disabled={loading || resetLoading}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                required
                placeholder="you@example.com"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
                >
                  Password
                </label>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading || resetLoading}
                  className="text-xs font-black text-cyan-300 transition hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resetLoading
                    ? 'Sending...'
                    : 'Forgot Password?'}
                </button>
              </div>

              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                disabled={loading || resetLoading}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                required
                placeholder="Enter your password"
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
              disabled={loading || resetLoading}
              className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? 'Logging In...'
                : 'Log In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm font-semibold text-slate-500">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="font-black text-cyan-300 hover:text-cyan-200"
            >
              Sign up
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}
