'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  role: 'worker' | 'company' | null
  full_name: string | null
  company_name: string | null
  is_online: boolean | null
  last_seen: string | null
}

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
}

type Conversation = {
  id: string
  worker_id: string
  company_id: string
  job_id: string | null
  created_at: string
  archived_by_company: boolean | null
  archived_by_worker: boolean | null
  jobs: Job | null
}

type Message = {
  id: string
  conversation_id: string
  sender_id: string
  recipient_id: string | null
  body: string | null
  is_read: boolean | null
  created_at: string
}

type ProfileFile = {
  id: string
  user_id: string
  category: string | null
  file_url: string | null
  created_at: string
}

type ConversationCard = {
  conversation: Conversation
  otherUser: Profile | null
  lastMessage: Message | null
  unreadCount: number
}

export default function MessagesPage() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [cards, setCards] = useState<ConversationCard[]>([])
  const [profileFiles, setProfileFiles] = useState<ProfileFile[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [archivingId, setArchivingId] = useState<string | null>(null)

  const loadMessages = useCallback(async () => {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in to view messages.')
      setCards([])
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name, company_name, is_online, last_seen')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profileData) {
      setMessage(profileError?.message || 'Profile not found.')
      setCards([])
      setLoading(false)
      return
    }

    const profile = profileData as Profile
    setCurrentUser(profile)

    const { data: conversationData, error: conversationError } = await supabase
      .from('conversations')
      .select(
        `
        id,
        worker_id,
        company_id,
        job_id,
        created_at,
        archived_by_company,
        archived_by_worker,
        jobs (
          id,
          title,
          trade,
          location,
          pay_rate
        )
      `
      )
      .or(`worker_id.eq.${user.id},company_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (conversationError) {
      setMessage(conversationError.message)
      setCards([])
      setLoading(false)
      return
    }

    const conversations = ((conversationData || []) as any[])
      .map((row) => ({
        ...row,
        jobs: Array.isArray(row.jobs) ? row.jobs[0] : row.jobs,
      }))
      .filter((conversation) => {
        const archivedForMe =
          profile.role === 'company'
            ? Boolean(conversation.archived_by_company)
            : Boolean(conversation.archived_by_worker)

        return showArchived ? archivedForMe : !archivedForMe
      }) as Conversation[]

    if (!conversations.length) {
      setCards([])
      setProfileFiles([])
      setLoading(false)
      window.dispatchEvent(new Event('crewcall-refresh-nav'))
      return
    }

    const conversationIds = conversations.map((c) => c.id)

    const otherUserIds = Array.from(
      new Set(
        conversations.map((conversation) =>
          conversation.worker_id === user.id
            ? conversation.company_id
            : conversation.worker_id
        )
      )
    )

    const { data: otherProfiles } = await supabase
      .from('profiles')
      .select('id, role, full_name, company_name, is_online, last_seen')
      .in('id', otherUserIds)

    const profiles = (otherProfiles as Profile[]) || []

    const { data: messageRows, error: messagesError } = await supabase
      .from('messages')
      .select(
        'id, conversation_id, sender_id, recipient_id, body, is_read, created_at'
      )
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })

    if (messagesError) {
      setMessage(messagesError.message)
      setCards([])
      setLoading(false)
      return
    }

    const allMessages = (messageRows as Message[]) || []

    const builtCards: ConversationCard[] = conversations.map((conversation) => {
      const otherUserId =
        conversation.worker_id === user.id
          ? conversation.company_id
          : conversation.worker_id

      const otherUser =
        profiles.find((profile) => profile.id === otherUserId) || null

      const messagesForConversation = allMessages.filter(
        (row) => row.conversation_id === conversation.id
      )

      const lastMessage = messagesForConversation[0] || null

      const unreadCount = messagesForConversation.filter(
        (row) =>
          row.sender_id !== user.id &&
          row.recipient_id === user.id &&
          row.is_read === false
      ).length

      return {
        conversation,
        otherUser,
        lastMessage,
        unreadCount,
      }
    })

    builtCards.sort((a, b) => {
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1

      const aTime = new Date(
        a.lastMessage?.created_at || a.conversation.created_at
      ).getTime()

      const bTime = new Date(
        b.lastMessage?.created_at || b.conversation.created_at
      ).getTime()

      return bTime - aTime
    })

    setCards(builtCards)

    const { data: files } = await supabase
      .from('profile_files')
      .select('id, user_id, category, file_url, created_at')
      .in('user_id', otherUserIds)
      .eq('category', 'profile_photo')
      .order('created_at', { ascending: false })

    setProfileFiles((files as ProfileFile[]) || [])
    setLoading(false)
    window.dispatchEvent(new Event('crewcall-refresh-nav'))
  }, [showArchived])

  useEffect(() => {
    let mounted = true

    loadMessages()

    const refreshEverything = async () => {
      if (!mounted) return
      await loadMessages()
      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    }

    window.addEventListener('focus', refreshEverything)
    window.addEventListener('pageshow', refreshEverything)
    window.addEventListener('crewcall-refresh-messages', refreshEverything)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshEverything()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    const messageChannel = supabase
      .channel('messages-page-live-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        refreshEverything
      )
      .subscribe()

    const conversationChannel = supabase
      .channel('conversations-page-live-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        refreshEverything
      )
      .subscribe()

    return () => {
      mounted = false
      window.removeEventListener('focus', refreshEverything)
      window.removeEventListener('pageshow', refreshEverything)
      window.removeEventListener('crewcall-refresh-messages', refreshEverything)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(messageChannel)
      supabase.removeChannel(conversationChannel)
    }
  }, [loadMessages])

  const photoByUserId = useMemo(() => {
    const map = new Map<string, string>()

    profileFiles.forEach((file) => {
      if (
        file.user_id &&
        file.category === 'profile_photo' &&
        file.file_url &&
        !map.has(file.user_id)
      ) {
        map.set(file.user_id, file.file_url)
      }
    })

    return map
  }, [profileFiles])

  const unreadTotal = useMemo(() => {
    return cards.reduce((total, card) => total + card.unreadCount, 0)
  }, [cards])

  const onlineTotal = useMemo(() => {
    return cards.filter((card) => isActuallyOnline(card.otherUser)).length
  }, [cards])

  const filteredCards = useMemo(() => {
    const term = search.trim().toLowerCase()

    return cards.filter((card) => {
      const otherName =
        card.otherUser?.company_name ||
        card.otherUser?.full_name ||
        'CrewCall User'

      const searchable = [
        otherName,
        card.otherUser?.role,
        card.conversation.jobs?.title,
        card.conversation.jobs?.trade,
        card.conversation.jobs?.location,
        card.conversation.jobs?.pay_rate,
        card.lastMessage?.body,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return (
        (!term || searchable.includes(term)) &&
        (!unreadOnly || card.unreadCount > 0) &&
        (!onlineOnly || isActuallyOnline(card.otherUser))
      )
    })
  }, [cards, search, unreadOnly, onlineOnly])

  async function archiveConversation(conversation: Conversation) {
    if (!currentUser?.role) return

    const confirmed = window.confirm(
      showArchived
        ? 'Restore this conversation to your inbox?'
        : 'Archive this conversation from your inbox?'
    )

    if (!confirmed) return

    setArchivingId(conversation.id)
    setMessage('')

    const updatePayload =
      currentUser.role === 'company'
        ? { archived_by_company: !showArchived }
        : { archived_by_worker: !showArchived }

    const { error } = await supabase
      .from('conversations')
      .update(updatePayload as never)
      .eq('id', conversation.id)

    if (error) {
      setMessage(error.message)
      setArchivingId(null)
      return
    }

    await loadMessages()
    window.dispatchEvent(new Event('crewcall-refresh-nav'))
    setArchivingId(null)
  }

  function isActuallyOnline(profile: Profile | null) {
    if (!profile?.is_online || !profile.last_seen) return false
    return Date.now() - new Date(profile.last_seen).getTime() < 90_000
  }

  function presenceLabel(profile: Profile | null) {
    if (isActuallyOnline(profile)) return 'Online now'
    if (!profile?.last_seen) return 'Offline'
    return `Last seen ${formatRelativeTime(profile.last_seen)}`
  }

  function resetFilters() {
    setSearch('')
    setUnreadOnly(false)
    setOnlineOnly(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/10 p-8 backdrop-blur">
          <p className="text-lg font-black">Loading messages...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  CrewCall Inbox
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  {showArchived ? 'Archived Messages' : 'Messages'}
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Real-time conversations with instant unread syncing.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Chats" value={filteredCards.length} />
                <StatCard label="Unread" value={unreadTotal} />
                <StatCard label="Online" value={onlineTotal} />
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6 md:p-8">
            {message && (
              <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-100">
                {message}
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search messages..."
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
              />

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setUnreadOnly((prev) => !prev)}
                  className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                    unreadOnly
                      ? 'bg-orange-400 text-slate-950'
                      : 'border border-white/10 bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  Unread Only
                </button>

                <button
                  type="button"
                  onClick={() => setOnlineOnly((prev) => !prev)}
                  className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                    onlineOnly
                      ? 'bg-lime-400 text-slate-950'
                      : 'border border-white/10 bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  Online Only
                </button>

                <button
                  type="button"
                  onClick={() => setShowArchived((prev) => !prev)}
                  className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                    showArchived
                      ? 'bg-cyan-400 text-slate-950'
                      : 'border border-white/10 bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {showArchived ? 'Back to Inbox' : 'Archived'}
                </button>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              {filteredCards.length === 0 ? (
                <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-8 text-center">
                  <p className="text-xl font-black text-white">
                    {showArchived
                      ? 'No archived conversations.'
                      : 'No conversations found.'}
                  </p>

                  <p className="mt-2 text-sm font-bold text-slate-400">
                    {showArchived
                      ? 'Archived chats will show up here.'
                      : 'Try clearing filters or starting a new message.'}
                  </p>
                </div>
              ) : (
                filteredCards.map((card) => {
                  const otherName =
                    card.otherUser?.company_name ||
                    card.otherUser?.full_name ||
                    'CrewCall User'

                  const otherPhoto = card.otherUser?.id
                    ? photoByUserId.get(card.otherUser.id)
                    : null

                  const online = isActuallyOnline(card.otherUser)

                  return (
                    <div
                      key={card.conversation.id}
                      className={`group rounded-[2rem] border p-5 shadow-xl transition-all duration-200 hover:scale-[1.01] ${
                        card.unreadCount > 0
                          ? 'border-orange-400/40 bg-gradient-to-r from-orange-500/20 to-orange-400/10 ring-2 ring-orange-400/20'
                          : 'border-white/10 bg-slate-950/60 hover:border-cyan-400/20'
                      }`}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <Link
                          href={`/messages/${card.conversation.id}`}
                          onClick={() => {
                            window.dispatchEvent(
                              new Event('crewcall-refresh-nav')
                            )
                          }}
                          className="flex min-w-0 flex-1 gap-4"
                        >
                          <div className="relative shrink-0">
                            {otherPhoto ? (
                              <img
                                src={otherPhoto}
                                alt={otherName}
                                className="h-20 w-20 rounded-3xl object-cover"
                              />
                            ) : (
                              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-400 text-3xl font-black text-white">
                                {otherName.charAt(0)}
                              </div>
                            )}

                            <span
                              className={`absolute -right-1 -top-1 h-5 w-5 rounded-full border-4 border-slate-950 ${
                                online ? 'bg-lime-400' : 'bg-slate-500'
                              }`}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="truncate text-2xl font-black text-white">
                                {otherName}
                              </h2>

                              {card.unreadCount > 0 && (
                                <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-black text-white shadow-lg shadow-orange-500/30">
                                  {card.unreadCount} unread
                                </span>
                              )}

                              {showArchived && (
                                <span className="rounded-full bg-cyan-500 px-3 py-1 text-xs font-black text-white">
                                  archived
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-xs font-black uppercase tracking-wide text-slate-400">
                              {presenceLabel(card.otherUser)}
                            </p>

                            <p
                              className={`mt-3 line-clamp-2 text-sm ${
                                card.unreadCount > 0
                                  ? 'font-bold text-white'
                                  : 'text-slate-300'
                              }`}
                            >
                              {card.lastMessage
                                ? card.lastMessage.sender_id === currentUser?.id
                                  ? `You: ${card.lastMessage.body || ''}`
                                  : card.lastMessage.body || ''
                                : 'No messages yet.'}
                            </p>
                          </div>
                        </Link>

                        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                          <Link
                            href={`/messages/${card.conversation.id}`}
                            onClick={() => {
                              window.dispatchEvent(
                                new Event('crewcall-refresh-nav')
                              )
                            }}
                            className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:scale-[1.02]"
                          >
                            Open Chat
                          </Link>

                          <button
                            type="button"
                            onClick={() =>
                              archiveConversation(card.conversation)
                            }
                            disabled={archivingId === card.conversation.id}
                            className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20 disabled:opacity-60"
                          >
                            {archivingId === card.conversation.id
                              ? showArchived
                                ? 'Restoring...'
                                : 'Archiving...'
                              : showArchived
                                ? 'Restore'
                                : 'Archive'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-4 text-center">
      <p className="text-3xl font-black text-cyan-100">{value}</p>
      <p className="text-xs font-black uppercase tracking-wide text-cyan-300">
        {label}
      </p>
    </div>
  )
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()

  if (Number.isNaN(date.getTime())) return 'recently'

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`

  return `${days}d ago`
}