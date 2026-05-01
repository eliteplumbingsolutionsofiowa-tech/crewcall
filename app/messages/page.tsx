'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type ConversationRow = {
  id: string
  created_at: string
  worker_id: string
  company_id: string
  job_id?: string | null
  jobs?: {
    id?: string
    title: string | null
    location: string | null
    trade?: string | null
    pay_rate?: string | null
  } | null
}

type Profile = {
  id: string
  full_name: string | null
  company_name: string | null
  role: string | null
  primary_trade?: string | null
  insured?: boolean | null
  liability_form_url?: string | null
}

type ConversationCard = ConversationRow & {
  otherProfile: Profile | null
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<MessagesLoading />}>
      <MessagesContent />
    </Suspense>
  )
}

function MessagesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationCard[]>([])

  useEffect(() => {
    initMessages()
  }, [])

  async function initMessages() {
    setLoading(true)
    setErrorMessage(null)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    const user = session?.user

    if (sessionError || !user) {
      setErrorMessage('You must be logged in to view messages.')
      setLoading(false)
      return
    }

    setCurrentUserId(user.id)

    const targetUserId = searchParams.get('start') || searchParams.get('user')
    const targetJobId = searchParams.get('job')

    if (targetUserId) {
      await openOrCreateConversation(user.id, targetUserId, targetJobId)
      return
    }

    if (targetJobId) {
      await openConversationByJob(user.id, targetJobId)
      return
    }

    await loadConversations(user.id)
  }

  async function openOrCreateConversation(
    userId: string,
    targetUserId: string,
    targetJobId: string | null
  ) {
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    const isWorker = myProfile?.role === 'worker'

    const workerId = isWorker ? userId : targetUserId
    const companyId = isWorker ? targetUserId : userId

    let query = supabase
      .from('conversations')
      .select('id')
      .eq('worker_id', workerId)
      .eq('company_id', companyId)

    if (targetJobId) {
      query = query.eq('job_id', targetJobId)
    }

    const { data: existing } = await query.maybeSingle()

    if (existing) {
      router.push(`/messages/${existing.id}`)
      return
    }

    const { data: newConversation, error } = await supabase
      .from('conversations')
      .insert({
        worker_id: workerId,
        company_id: companyId,
        job_id: targetJobId || null,
      })
      .select('id')
      .single()

    if (error) {
      setErrorMessage(error.message)
      setLoading(false)
      return
    }

    router.push(`/messages/${newConversation.id}`)
  }

  async function openConversationByJob(userId: string, targetJobId: string) {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('job_id', targetJobId)
      .or(`worker_id.eq.${userId},company_id.eq.${userId}`)
      .maybeSingle()

    if (existing) {
      router.push(`/messages/${existing.id}`)
      return
    }

    setErrorMessage('No conversation found for this job yet.')
    setLoading(false)
  }

  async function loadConversations(userId: string) {
    const { data: conversationRows, error: conversationError } = await supabase
      .from('conversations')
      .select(`
        id,
        created_at,
        worker_id,
        company_id,
        job_id,
        jobs (
          id,
          title,
          location,
          trade,
          pay_rate
        )
      `)
      .or(`worker_id.eq.${userId},company_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (conversationError) {
      setErrorMessage(conversationError.message)
      setLoading(false)
      return
    }

    const rows = (conversationRows || []).map((conversation: any) => ({
      ...conversation,
      jobs: Array.isArray(conversation.jobs)
        ? conversation.jobs[0]
        : conversation.jobs,
    })) as ConversationRow[]

    if (rows.length === 0) {
      setConversations([])
      setLoading(false)
      return
    }

    const otherUserIds = Array.from(
      new Set(
        rows.map((row) =>
          row.worker_id === userId ? row.company_id : row.worker_id
        )
      )
    )

    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select(
        'id, full_name, company_name, role, primary_trade, insured, liability_form_url'
      )
      .in('id', otherUserIds)

    if (profileError) {
      setErrorMessage(profileError.message)
      setLoading(false)
      return
    }

    const profileMap = new Map(
      ((profileRows || []) as Profile[]).map((profile) => [
        profile.id,
        profile,
      ])
    )

    const merged: ConversationCard[] = rows.map((row) => {
      const otherId = row.worker_id === userId ? row.company_id : row.worker_id

      return {
        ...row,
        otherProfile: profileMap.get(otherId) || null,
      }
    })

    setConversations(merged)
    setLoading(false)
  }

  const stats = useMemo(() => {
    const workerChats = conversations.filter(
      (conversation) => conversation.otherProfile?.role === 'worker'
    ).length

    const companyChats = conversations.filter(
      (conversation) => conversation.otherProfile?.role === 'company'
    ).length

    return {
      total: conversations.length,
      workers: workerChats,
      companies: companyChats,
    }
  }, [conversations])

  if (loading) return <MessagesLoading />

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
          <div className="text-red-600">{errorMessage}</div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-8 py-8 text-white">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-200">
                  Manage job conversations, keep applicants moving, and stay on
                  top of hiring.
                </p>
              </div>

              <div className="grid min-w-[280px] grid-cols-3 gap-3">
                <TopStat label="Total" value={String(stats.total)} />
                <TopStat label="Workers" value={String(stats.workers)} />
                <TopStat label="Companies" value={String(stats.companies)} />
              </div>
            </div>
          </div>

          <div className="p-8">
            {conversations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                <h2 className="text-xl font-semibold text-slate-900">
                  No conversations yet
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  Once you start messaging on jobs, your inbox will show up here.
                </p>

                <div className="mt-5">
                  <Link
                    href="/jobs"
                    className="inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    Browse Jobs
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                {conversations.map((conversation) => {
                  const otherName =
                    conversation.otherProfile?.company_name ||
                    conversation.otherProfile?.full_name ||
                    'Conversation'

                  const verified = Boolean(
                    conversation.otherProfile?.insured &&
                      conversation.otherProfile?.liability_form_url
                  )

                  const isWorker = conversation.otherProfile?.role === 'worker'
                  const isMineAsWorker = conversation.worker_id === currentUserId

                  return (
                    <article
                      key={conversation.id}
                      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-semibold text-slate-900">
                              {otherName}
                            </h2>

                            {conversation.otherProfile?.role && (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                {conversation.otherProfile.role}
                              </span>
                            )}

                            {verified && (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                Verified
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-sm text-slate-500">
                            Started {formatDate(conversation.created_at)}
                          </p>
                        </div>

                        <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          {isMineAsWorker ? 'Worker Side' : 'Company Side'}
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <InfoPill
                          label="Job"
                          value={
                            conversation.jobs?.title || 'General conversation'
                          }
                        />
                        <InfoPill
                          label="Location"
                          value={conversation.jobs?.location || 'Not listed'}
                        />
                        <InfoPill
                          label="Trade"
                          value={
                            conversation.jobs?.trade ||
                            conversation.otherProfile?.primary_trade ||
                            'Not listed'
                          }
                        />
                        <InfoPill
                          label="Pay"
                          value={conversation.jobs?.pay_rate || 'Not listed'}
                        />
                      </div>

                      <div className="mt-5 rounded-xl bg-slate-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Quick Summary
                        </div>
                        <p className="mt-2 text-sm text-slate-700">
                          {isWorker
                            ? 'Message this worker about the job, pay, schedule, and next steps.'
                            : 'Stay in touch with this company and keep the application moving.'}
                        </p>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <Link
                          href={`/messages/${conversation.id}`}
                          className="inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                        >
                          Open Chat
                        </Link>

                        {conversation.jobs?.id && (
                          <Link
                            href={`/jobs/${conversation.jobs.id}`}
                            className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                          >
                            View Job
                          </Link>
                        )}

                        {conversation.otherProfile?.id && (
                          <Link
                            href={`/profile/${conversation.otherProfile.id}`}
                            className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                          >
                            View Profile
                          </Link>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function MessagesLoading() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-8 py-8 text-white">
          <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
          <p className="mt-2 text-sm text-slate-200">Loading inbox...</p>
        </div>
      </section>
    </main>
  )
}

function TopStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-200">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    </div>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  )
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}