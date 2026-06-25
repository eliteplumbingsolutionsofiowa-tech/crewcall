'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Role = 'worker' | 'company'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<Role>('worker')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const cleanEmail = email.trim().toLowerCase()
    const cleanFullName = fullName.trim()
    const cleanPhone = phone.trim()

    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanFullName,
          phone: cleanPhone,
          role,
        },
      },
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    try {
      await fetch('/api/email/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          fullName: cleanFullName,
          role,
        }),
      })
    } catch (error) {
      console.error('Welcome email failed:', error)
    }

    alert('Account created. Check your email to confirm your signup.')

    setEmail('')
    setPassword('')
    setFullName('')
    setPhone('')
    setRole('worker')
    setLoading(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
          Join CrewCall
        </p>

        <h1 className="mt-4 text-3xl font-black tracking-tight text-white">
          Create your account
        </h1>

        <p className="mt-2 text-sm font-semibold text-slate-400">
          Sign up as a worker or company.
        </p>

        <form onSubmit={handleSignup} className="mt-8 space-y-5">
          <Field label="Full Name" htmlFor="fullName">
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
            />
          </Field>

          <Field label="Phone" htmlFor="phone">
            <input
              id="phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="515-555-1234"
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
            />
          </Field>

          <Field label="Role" htmlFor="role">
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
            >
              <option value="worker">Worker</option>
              <option value="company">Company</option>
            </select>
          </Field>

          <Field label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
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
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-black text-slate-200">
        {label}
      </label>
      {children}
    </div>
  )
}