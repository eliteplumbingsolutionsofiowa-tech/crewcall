'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
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

type NoticeTone = 'error' | 'success' | 'info'

function normalizeConversationRow(row: any): Conversation {
  return {
    ...row,
    jobs: Array.isArray(row.jobs)
      ? row.jobs[0] || null
      : row.jobs || null,
  } as Conversation
}

function getDisplayName(profile: Profile | null, t: ReturnType<typeof useTranslations>) {
  return (
    profile?.company_name ||
    profile?.full_name ||
    t('user')
  )
}

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || 'C'
}

function isActuallyOnline(profile: Profile | null) {
  if (!profile?.is_online || !profile.last_seen) {
    return false
  }

  const lastSeen = new Date(profile.last_seen).getTime()

  if (Number.isNaN(lastSeen)) {
    return false
  }

  return Date.now() - lastSeen < 90_000
}

function formatRelativeTime(value: string, t: ReturnType<typeof useTranslations>) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return t('recently')
  }

  const diff = Math.max(0, Date.now() - date.getTime())
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) {
    return t('justNow')
  }

  if (minutes < 60) {
    return t('minutesAgo', { count: minutes })
  }

  if (hours < 24) {
    return t('hoursAgo', { count: hours })
  }

  if (days < 7) {
    return t('daysAgo', { count: days })
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatMessageTime(value: string | undefined) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (sameDay) {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function presenceLabel(profile: Profile | null, t: ReturnType<typeof useTranslations>) {
  if (isActuallyOnline(profile)) {
    return t('onlineNow')
  }

  if (!profile?.last_seen) {
    return t('offline')
  }

  return t('lastSeen', { time: formatRelativeTime(profile.last_seen, t) })
}

export default function MessagesPage() {
  const t = useTranslations('Messages')
  const [currentUser, setCurrentUser] =
    useState<Profile | null>(null)

  const [cards, setCards] = useState<ConversationCard[]>([])
  const [profileFiles, setProfileFiles] =
    useState<ProfileFile[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] =
    useState<NoticeTone>('info')

  const [search, setSearch] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const [archivingId, setArchivingId] =
    useState<string | null>(null)

  const loadMessages = useCallback(
    async (backgroundRefresh = false) => {
      if (backgroundRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      if (!backgroundRefresh) {
        setMessage('')
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          throw new Error(
            userError?.message ||
              t('loginRequired')
          )
        }

        const { data: profileData, error: profileError } =
          await supabase
            .from('profiles')
            .select(
              `
              id,
              role,
              full_name,
              company_name,
              is_online,
              last_seen
            `
            )
            .eq('id', user.id)
            .maybeSingle()

        if (profileError || !profileData) {
          throw new Error(
            profileError?.message || t('profileNotFound')
          )
        }

        const profile = profileData as Profile
        setCurrentUser(profile)

        const {
          data: conversationData,
          error: conversationError,
        } = await supabase
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
          .or(
            `worker_id.eq.${user.id},company_id.eq.${user.id}`
          )
          .order('created_at', {
            ascending: false,
          })

        if (conversationError) {
          throw conversationError
        }

        const conversations = (
          (conversationData || []) as any[]
        )
          .map(normalizeConversationRow)
          .filter((conversation) => {
            const archivedForMe =
              profile.role === 'company'
                ? Boolean(
                    conversation.archived_by_company
                  )
                : Boolean(
                    conversation.archived_by_worker
                  )

            return showArchived
              ? archivedForMe
              : !archivedForMe
          })

        if (conversations.length === 0) {
          setCards([])
          setProfileFiles([])

          if (backgroundRefresh) {
            setMessage(t('refreshed'))
            setMessageTone('success')
          }

          window.dispatchEvent(
            new Event('crewcall-refresh-nav')
          )

          setLoading(false)
          setRefreshing(false)
          return
        }

        const conversationIds = conversations.map(
          (conversation) => conversation.id
        )

        const otherUserIds = Array.from(
          new Set(
            conversations.map((conversation) =>
              conversation.worker_id === user.id
                ? conversation.company_id
                : conversation.worker_id
            )
          )
        )

        const {
          data: otherProfiles,
          error: otherProfilesError,
        } = await supabase
          .from('profiles')
          .select(
            `
            id,
            role,
            full_name,
            company_name,
            is_online,
            last_seen
          `
          )
          .in('id', otherUserIds)

        if (otherProfilesError) {
          throw otherProfilesError
        }

        const profiles =
          (otherProfiles as Profile[]) || []

        const {
          data: messageRows,
          error: messagesError,
        } = await supabase
          .from('messages')
          .select(
            `
            id,
            conversation_id,
            sender_id,
            recipient_id,
            body,
            is_read,
            created_at
          `
          )
          .in('conversation_id', conversationIds)
          .order('created_at', {
            ascending: false,
          })

        if (messagesError) {
          throw messagesError
        }

        const allMessages =
          (messageRows as Message[]) || []

        const messagesByConversation = new Map<
          string,
          Message[]
        >()

        allMessages.forEach((row) => {
          const existing =
            messagesByConversation.get(
              row.conversation_id
            ) || []

          existing.push(row)

          messagesByConversation.set(
            row.conversation_id,
            existing
          )
        })

        const profileById = new Map(
          profiles.map((otherProfile) => [
            otherProfile.id,
            otherProfile,
          ])
        )

        const builtCards: ConversationCard[] =
          conversations.map((conversation) => {
            const otherUserId =
              conversation.worker_id === user.id
                ? conversation.company_id
                : conversation.worker_id

            const otherUser =
              profileById.get(otherUserId) || null

            const messagesForConversation =
              messagesByConversation.get(
                conversation.id
              ) || []

            const lastMessage =
              messagesForConversation[0] || null

            const unreadCount =
              messagesForConversation.filter(
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
          if (
            a.unreadCount > 0 &&
            b.unreadCount === 0
          ) {
            return -1
          }

          if (
            a.unreadCount === 0 &&
            b.unreadCount > 0
          ) {
            return 1
          }

          const aTime = new Date(
            a.lastMessage?.created_at ||
              a.conversation.created_at
          ).getTime()

          const bTime = new Date(
            b.lastMessage?.created_at ||
              b.conversation.created_at
          ).getTime()

          return bTime - aTime
        })

        setCards(builtCards)

        const { data: files, error: filesError } =
          await supabase
            .from('profile_files')
            .select(
              `
              id,
              user_id,
              category,
              file_url,
              created_at
            `
            )
            .in('user_id', otherUserIds)
            .eq('category', 'profile_photo')
            .order('created_at', {
              ascending: false,
            })

        if (filesError) {
          throw filesError
        }

        setProfileFiles(
          (files as ProfileFile[]) || []
        )

        if (backgroundRefresh) {
          setMessage(t('refreshed'))
          setMessageTone('success')
        }

        window.dispatchEvent(
          new Event('crewcall-refresh-nav')
        )
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : t('unableToLoad')
        )
        setMessageTone('error')

        if (!backgroundRefresh) {
          setCards([])
          setProfileFiles([])
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [showArchived, t]
  )

  useEffect(() => {
    let mounted = true
    let refreshTimer: number | null = null

    const refreshEverything = async () => {
      if (!mounted) {
        return
      }

      if (refreshTimer) {
        window.clearTimeout(refreshTimer)
      }

      refreshTimer = window.setTimeout(() => {
        if (!mounted) {
          return
        }

        void loadMessages(true)
      }, 250)
    }

    void loadMessages()

    window.addEventListener(
      'focus',
      refreshEverything
    )

    window.addEventListener(
      'pageshow',
      refreshEverything
    )

    window.addEventListener(
      'crewcall-refresh-messages',
      refreshEverything
    )

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshEverything()
      }
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibility
    )

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

    const presenceChannel = supabase
      .channel('messages-page-profile-presence')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        refreshEverything
      )
      .subscribe()

    return () => {
      mounted = false

      if (refreshTimer) {
        window.clearTimeout(refreshTimer)
      }

      window.removeEventListener(
        'focus',
        refreshEverything
      )

      window.removeEventListener(
        'pageshow',
        refreshEverything
      )

      window.removeEventListener(
        'crewcall-refresh-messages',
        refreshEverything
      )

      document.removeEventListener(
        'visibilitychange',
        handleVisibility
      )

      void supabase.removeChannel(messageChannel)
      void supabase.removeChannel(conversationChannel)
      void supabase.removeChannel(presenceChannel)
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
    return cards.reduce(
      (total, card) => total + card.unreadCount,
      0
    )
  }, [cards])

  const onlineTotal = useMemo(() => {
    return cards.filter((card) =>
      isActuallyOnline(card.otherUser)
    ).length
  }, [cards])

  const filteredCards = useMemo(() => {
    const term = search.trim().toLowerCase()

    return cards.filter((card) => {
      const otherName = getDisplayName(card.otherUser, t)

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

      const matchesSearch =
        !term || searchable.includes(term)

      const matchesUnread =
        !unreadOnly || card.unreadCount > 0

      const matchesOnline =
        !onlineOnly ||
        isActuallyOnline(card.otherUser)

      return (
        matchesSearch &&
        matchesUnread &&
        matchesOnline
      )
    })
  }, [
    cards,
    search,
    unreadOnly,
    onlineOnly,
  ])

  async function archiveConversation(
    conversation: Conversation
  ) {
    if (!currentUser?.role) {
      return
    }

    const confirmed = window.confirm(
      showArchived
        ? t('restoreConfirm')
        : t('archiveConfirm')
    )

    if (!confirmed) {
      return
    }

    setArchivingId(conversation.id)
    setMessage('')

    const updatePayload =
      currentUser.role === 'company'
        ? {
            archived_by_company: !showArchived,
          }
        : {
            archived_by_worker: !showArchived,
          }

    const { error } = await supabase
      .from('conversations')
      .update(updatePayload as never)
      .eq('id', conversation.id)

    if (error) {
      setMessage(error.message)
      setMessageTone('error')
      setArchivingId(null)
      return
    }

    setMessage(
      showArchived
        ? t('restored')
        : t('archivedNotice')
    )
    setMessageTone('success')

    await loadMessages()

    window.dispatchEvent(
      new Event('crewcall-refresh-nav')
    )

    setArchivingId(null)
  }

  function resetFilters() {
    setSearch('')
    setUnreadOnly(false)
    setOnlineOnly(false)
  }

  if (loading) {
    return <MessagesLoadingState />
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8 lg:px-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-48 top-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />

        <div className="absolute -right-48 top-56 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />

        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-violet-500/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

          <div className="p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col justify-between gap-8 xl:flex-row xl:items-end">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={t('inbox')}
                    tone="cyan"
                  />

                  {unreadTotal > 0 ? (
                    <StatusBadge
                      label={t('unreadCount', { count: unreadTotal })}
                      tone="amber"
                    />
                  ) : (
                    <StatusBadge
                      label={t('allCaughtUp')}
                      tone="green"
                    />
                  )}
                </div>

                <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                  {showArchived
                    ? t('archivedMessages')
                    : t('messages')}
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-400 sm:text-base">
                  {t('description')}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <HeroStat
                  label={t('chats')}
                  value={String(cards.length)}
                  tone="cyan"
                />

                <HeroStat
                  label={t('unread')}
                  value={String(unreadTotal)}
                  tone="amber"
                />

                <HeroStat
                  label={t('online')}
                  value={String(onlineTotal)}
                  tone="green"
                />
              </div>
            </div>
          </div>
        </section>

        {message ? (
          <Notice tone={messageTone}>{message}</Notice>
        ) : null}

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/20 backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder={t('searchPlaceholder')}
                className="min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 pr-12 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/40 focus:ring-4 focus:ring-cyan-400/5"
              />

              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-xs font-black text-slate-400 transition hover:bg-white/5 hover:text-white"
                >
                  {t('clear')}
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => void loadMessages(true)}
              disabled={refreshing}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] px-5 py-3 text-sm font-black text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing
                ? t('refreshing')
                : t('refresh')}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <FilterButton
              active={unreadOnly}
              onClick={() =>
                setUnreadOnly((previous) => !previous)
              }
              activeLabel={t('unreadFilterOn')}
              inactiveLabel={t('unreadOnly')}
              tone="amber"
            />

            <FilterButton
              active={onlineOnly}
              onClick={() =>
                setOnlineOnly((previous) => !previous)
              }
              activeLabel={t('onlineFilterOn')}
              inactiveLabel={t('onlineOnly')}
              tone="green"
            />

            <FilterButton
              active={showArchived}
              onClick={() =>
                setShowArchived((previous) => !previous)
              }
              activeLabel={t('backToInbox')}
              inactiveLabel={t('archived')}
              tone="cyan"
            />

            {(search || unreadOnly || onlineOnly) ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-sm font-black text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
              >
                {t('clearFilters')}
              </button>
            ) : null}
          </div>
        </section>

        <section className="space-y-4">
          {filteredCards.length === 0 ? (
            <EmptyState
              showArchived={showArchived}
              hasFilters={
                Boolean(search) ||
                unreadOnly ||
                onlineOnly
              }
              onClear={resetFilters}
            />
          ) : (
            filteredCards.map((card) => {
              const otherName = getDisplayName(
                card.otherUser,
                t
              )

              const otherPhoto = card.otherUser?.id
                ? photoByUserId.get(
                    card.otherUser.id
                  )
                : null

              const online = isActuallyOnline(
                card.otherUser
              )

              const job = card.conversation.jobs

              const messagePreview = card.lastMessage
                ? card.lastMessage.sender_id ===
                  currentUser?.id
                  ? t('youPrefix', {
                      message:
                        card.lastMessage.body ||
                        t('attachmentEmpty'),
                    })
                  : card.lastMessage.body ||
                    t('attachmentEmpty')
                : t('noMessages')

              return (
                <article
                  key={card.conversation.id}
                  className={[
                    'group overflow-hidden rounded-[2rem] border shadow-xl shadow-black/20 transition duration-200 hover:-translate-y-0.5',
                    card.unreadCount > 0
                      ? 'border-amber-400/30 bg-amber-500/[0.08]'
                      : 'border-white/10 bg-white/[0.045] hover:border-cyan-400/20',
                  ].join(' ')}
                >
                  {card.unreadCount > 0 ? (
                    <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
                  ) : (
                    <div className="h-1 bg-gradient-to-r from-cyan-400/40 via-blue-500/40 to-violet-500/40 opacity-0 transition group-hover:opacity-100" />
                  )}

                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <Link
                        href={`/messages/${card.conversation.id}`}
                        onClick={() => {
                          window.dispatchEvent(
                            new Event(
                              'crewcall-refresh-nav'
                            )
                          )
                        }}
                        className="flex min-w-0 flex-1 gap-4 sm:gap-5"
                      >
                        <div className="relative shrink-0">
                          {otherPhoto ? (
                            <img
                              src={otherPhoto}
                              alt={otherName}
                              className="h-20 w-20 rounded-3xl border border-white/10 object-cover shadow-xl sm:h-24 sm:w-24"
                            />
                          ) : (
                            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/20 via-blue-500/20 to-violet-500/20 text-3xl font-black text-cyan-200 shadow-xl sm:h-24 sm:w-24">
                              {getInitial(otherName)}
                            </div>
                          )}

                          <span
                            className={[
                              'absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-4 border-slate-950',
                              online
                                ? 'bg-emerald-400'
                                : 'bg-slate-600',
                            ].join(' ')}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2
                              className={[
                                'truncate text-xl font-black transition sm:text-2xl',
                                card.unreadCount > 0
                                  ? 'text-white'
                                  : 'text-slate-100 group-hover:text-cyan-300',
                              ].join(' ')}
                            >
                              {otherName}
                            </h2>

                            {card.otherUser?.role ? (
                              <StatusBadge
                                label={
                                  card.otherUser.role ===
                                  'company'
                                    ? t('company')
                                    : t('worker')
                                }
                                tone="slate"
                              />
                            ) : null}

                            {card.unreadCount > 0 ? (
                              <StatusBadge
                                label={`${card.unreadCount} Unread`}
                                tone="amber"
                              />
                            ) : null}

                            {showArchived ? (
                              <StatusBadge
                                label="Archived"
                                tone="cyan"
                              />
                            ) : null}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-500">
                            <span
                              className={
                                online
                                  ? 'text-emerald-300'
                                  : ''
                              }
                            >
                              {presenceLabel(
                                card.otherUser,
                                t
                              )}
                            </span>

                            {card.lastMessage ? (
                              <span>
                                {formatMessageTime(
                                  card.lastMessage
                                    .created_at
                                )}
                              </span>
                            ) : null}
                          </div>

                          {job ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-300">
                                {job.title ||
                                  t('untitledJob')}
                              </span>

                              {job.trade ? (
                                <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-black text-violet-300">
                                  {job.trade}
                                </span>
                              ) : null}

                              {job.location ? (
                                <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-black text-slate-400">
                                  {job.location}
                                </span>
                              ) : null}
                            </div>
                          ) : null}

                          <p
                            className={[
                              'mt-4 line-clamp-2 text-sm leading-6',
                              card.unreadCount > 0
                                ? 'font-bold text-white'
                                : 'text-slate-400',
                            ].join(' ')}
                          >
                            {messagePreview}
                          </p>
                        </div>
                      </Link>

                      <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                        <Link
                          href={`/messages/${card.conversation.id}`}
                          onClick={() => {
                            window.dispatchEvent(
                              new Event(
                                'crewcall-refresh-nav'
                              )
                            )
                          }}
                          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-300"
                        >
                          {t('openChat')}
                        </Link>

                        <button
                          type="button"
                          onClick={() =>
                            void archiveConversation(
                              card.conversation
                            )
                          }
                          disabled={
                            archivingId ===
                            card.conversation.id
                          }
                          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] px-5 py-3 text-sm font-black text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {archivingId ===
                          card.conversation.id
                            ? showArchived
                              ? t('restoring')
                              : t('archiving')
                            : showArchived
                              ? t('restore')
                              : t('archive')}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </section>
      </div>
    </main>
  )
}

function MessagesLoadingState() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14">
                <span className="absolute inset-0 animate-ping rounded-2xl bg-cyan-400/20" />

                <span className="absolute inset-0 animate-pulse rounded-2xl bg-cyan-400/15" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                  CrewCall Inbox
                </p>

                <p className="mt-1 text-lg font-bold text-white">
                  Loading messages...
                </p>
              </div>
            </div>

            <div className="mt-8 h-36 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />

            <div className="mt-6 space-y-4">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-40 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function HeroStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'cyan' | 'amber' | 'green'
}) {
  const classes = {
    cyan:
      'border-cyan-400/20 bg-cyan-500/10 text-cyan-300',
    amber:
      'border-amber-400/20 bg-amber-500/10 text-amber-300',
    green:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
  }

  return (
    <div
      className={[
        'min-w-24 rounded-3xl border p-4 text-center',
        classes[tone],
      ].join(' ')}
    >
      <p className="text-3xl font-black text-white">
        {value}
      </p>

      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] opacity-75">
        {label}
      </p>
    </div>
  )
}

function FilterButton({
  active,
  onClick,
  activeLabel,
  inactiveLabel,
  tone,
}: {
  active: boolean
  onClick: () => void
  activeLabel: string
  inactiveLabel: string
  tone: 'cyan' | 'amber' | 'green'
}) {
  const activeClasses = {
    cyan:
      'border-cyan-400 bg-cyan-400 text-slate-950',
    amber:
      'border-amber-400 bg-amber-400 text-slate-950',
    green:
      'border-emerald-400 bg-emerald-400 text-slate-950',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex min-h-11 items-center justify-center rounded-2xl border px-4 py-2 text-sm font-black transition',
        active
          ? activeClasses[tone]
          : 'border-white/10 bg-white/[0.055] text-white hover:bg-white/[0.1]',
      ].join(' ')}
    >
      {active ? activeLabel : inactiveLabel}
    </button>
  )
}

function StatusBadge({
  label,
  tone,
}: {
  label: string
  tone:
    | 'cyan'
    | 'green'
    | 'amber'
    | 'slate'
}) {
  const classes = {
    cyan:
      'border-cyan-400/20 bg-cyan-500/10 text-cyan-300',
    green:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
    amber:
      'border-amber-400/20 bg-amber-500/10 text-amber-300',
    slate:
      'border-white/10 bg-white/[0.055] text-slate-300',
  }

  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-wider',
        classes[tone],
      ].join(' ')}
    >
      <span
        className={[
          'h-2 w-2 rounded-full',
          tone === 'cyan'
            ? 'bg-cyan-400'
            : tone === 'green'
              ? 'bg-emerald-400'
              : tone === 'amber'
                ? 'bg-amber-400'
                : 'bg-slate-400',
        ].join(' ')}
      />

      {label}
    </span>
  )
}

function EmptyState({
  showArchived,
  hasFilters,
  onClear,
}: {
  showArchived: boolean
  hasFilters: boolean
  onClear: () => void
}) {
  return (
    <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.035] px-6 py-14 text-center shadow-xl shadow-black/20">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-400/20 bg-cyan-500/10 text-2xl font-black text-cyan-300">
        M
      </div>

      <h2 className="mt-5 text-2xl font-black text-white">
        {showArchived
          ? 'No archived conversations'
          : hasFilters
            ? 'No conversations match'
            : 'No conversations yet'}
      </h2>

      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">
        {showArchived
          ? 'Conversations you archive will appear here.'
          : hasFilters
            ? 'Try clearing your search or filters.'
            : 'Your CrewCall job conversations will appear here after you connect with a worker or company.'}
      </p>

      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
        >
          Clear Filters
        </button>
      ) : null}
    </div>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: NoticeTone
  children: React.ReactNode
}) {
  const classes = {
    error:
      'border-red-400/20 bg-red-500/10 text-red-200',
    success:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    info:
      'border-blue-400/20 bg-blue-500/10 text-blue-200',
  }

  return (
    <div
      className={[
        'rounded-2xl border p-4 text-sm font-bold',
        classes[tone],
      ].join(' ')}
    >
      {children}
    </div>
  )
}