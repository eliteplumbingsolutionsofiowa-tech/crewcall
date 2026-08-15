'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import CrewCallToast from '@/app/components/CrewCallToast'
import CommandPalette from '@/app/components/search/CommandPalette'
import { supabase } from '@/lib/supabase'
import { resolveCompanyContext } from '@/lib/company-context'

type Role = 'company' | 'worker' | 'admin' | null

type Profile = {
  role: Role
  is_admin: boolean | null
}

type RealtimeNotification = {
  id: string
  user_id: string
  title: string | null
  body: string | null
  link_url: string | null
  is_read: boolean | null
  read: boolean | null
  created_at: string
}

type ToastState = {
  title: string
  body: string | null
  linkUrl: string | null
} | null

const FALLBACK_REFRESH_INTERVAL = 30_000

export default function CrewCallNav() {
  const pathname = usePathname()
  const router = useRouter()
  const tNav = useTranslations('Nav')

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  const notificationPulseTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null)

  const messagePulseTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadRequestRef = useRef(0)

  const [userId, setUserId] = useState<string | null>(null)
  const [role, setRole] = useState<Role>(null)

  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [savedWorkers, setSavedWorkers] = useState(0)

  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] =
    useState(false)

  const [toast, setToast] = useState<ToastState>(null)
  const [notificationPulse, setNotificationPulse] = useState(false)
  const [messagePulse, setMessagePulse] = useState(false)

  const isCompanyAccount =
    role === 'company' || role === 'admin'

  const resetNavState = useCallback(() => {
    setUserId(null)
    setRole(null)
    setUnreadMessages(0)
    setUnreadNotifications(0)
    setSavedWorkers(0)
    setToast(null)
    setNotificationPulse(false)
    setMessagePulse(false)
  }, [])

  const loadNavCounts = useCallback(async () => {
    const requestId = ++loadRequestRef.current

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (requestId !== loadRequestRef.current) {
        return
      }

      if (sessionError) {
        console.error(
          'Unable to restore CrewCall session:',
          sessionError
        )

        resetNavState()
        return
      }

      if (!session?.user) {
        resetNavState()
        return
      }

      const user = session.user

      setUserId(user.id)

      const { data: profile, error: profileError } =
        await supabase
          .from('profiles')
          .select('role, is_admin')
          .eq('id', user.id)
          .maybeSingle<Profile>()

      if (requestId !== loadRequestRef.current) {
        return
      }

      if (profileError) {
        console.error(
          'Unable to load CrewCall profile role:',
          profileError
        )
      }

      console.log('CREWCALL NAV PROFILE', profile)

      const companyContext =
        await resolveCompanyContext(
          supabase,
          user.id
        )

      if (
        requestId !== loadRequestRef.current
      ) {
        return
      }

      const isCompanyWorkspace =
        pathname.startsWith('/company/') ||
        pathname === '/company' ||
        pathname.startsWith('/post-job') ||
        pathname.startsWith('/my-jobs') ||
        pathname.startsWith('/completed-jobs')

      const userRole: Role =
        companyContext.isPlatformAdmin
          ? 'admin'
          : companyContext.isCompanyOwner
            ? 'company'
            : companyContext.isTeamMember &&
                isCompanyWorkspace
              ? 'company'
              : profile?.role ?? null

      console.log(
        'CREWCALL NAV COMPANY CONTEXT',
        companyContext
      )

      console.log(
        'CREWCALL NAV ROLE',
        userRole
      )

      setRole(userRole)

      const [messageResult, notificationResult] =
        await Promise.all([
          supabase
            .from('messages')
            .select('id', {
              count: 'exact',
              head: true,
            })
            .eq('recipient_id', user.id)
            .eq('is_read', false),

          supabase
            .from('notifications')
            .select('id', {
              count: 'exact',
              head: true,
            })
            .eq('user_id', user.id)
            .or('is_read.eq.false,read.eq.false'),
        ])

      if (requestId !== loadRequestRef.current) {
        return
      }

      if (!messageResult.error) {
        setUnreadMessages(messageResult.count ?? 0)
      }

      if (!notificationResult.error) {
        setUnreadNotifications(
          notificationResult.count ?? 0
        )
      }

      if (
        userRole === 'company' ||
        userRole === 'admin'
      ) {
        const savedWorkerResult = await supabase
          .from('saved_workers')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq(
            'company_id',
            companyContext.companyId ||
              user.id
          )

        if (requestId !== loadRequestRef.current) {
          return
        }

        if (!savedWorkerResult.error) {
          setSavedWorkers(
            savedWorkerResult.count ?? 0
          )
        }
      } else {
        setSavedWorkers(0)
      }
    } catch (error) {
      console.error(
        'Unable to refresh CrewCall navigation:',
        error
      )
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false)
      }
    }
  }, [pathname, resetNavState])

  const triggerNotificationPulse = useCallback(() => {
    if (notificationPulseTimerRef.current) {
      clearTimeout(notificationPulseTimerRef.current)
    }

    setNotificationPulse(true)

    notificationPulseTimerRef.current = setTimeout(() => {
      setNotificationPulse(false)
    }, 900)
  }, [])

  const triggerMessagePulse = useCallback(() => {
    if (messagePulseTimerRef.current) {
      clearTimeout(messagePulseTimerRef.current)
    }

    setMessagePulse(true)

    messagePulseTimerRef.current = setTimeout(() => {
      setMessagePulse(false)
    }, 900)
  }, [])

  const showToast = useCallback(
    (notification: RealtimeNotification) => {
      if (pathname.startsWith('/notifications')) {
        return
      }

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
      }

      setToast({
        title:
          notification.title || 'New CrewCall alert',
        body: notification.body,
        linkUrl: notification.link_url,
      })

      toastTimerRef.current = setTimeout(() => {
        setToast(null)
      }, 6000)

      if (
        typeof window !== 'undefined' &&
        document.visibilityState !== 'visible' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(
            notification.title || 'CrewCall',
            {
              body:
                notification.body ||
                'You have a new notification in CrewCall.',
            }
          )
        } catch {
          // Browser notifications are optional.
        }
      }
    },
    [pathname]
  )

  useEffect(() => {
    let mounted = true

    const refresh = () => {
      if (!mounted) {
        return
      }

      void loadNavCounts()
    }

    refresh()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) {
          return
        }

        if (!session?.user) {
          loadRequestRef.current += 1
          resetNavState()
          setLoading(false)
          setMobileMenuOpen(false)
          return
        }

        window.setTimeout(() => {
          if (mounted) {
            void loadNavCounts()
          }
        }, 0)
      }
    )

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    const intervalId = window.setInterval(
      refresh,
      FALLBACK_REFRESH_INTERVAL
    )

    window.addEventListener(
      'crewcall-refresh-nav',
      refresh
    )
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)

    document.addEventListener(
      'visibilitychange',
      handleVisibility
    )

    return () => {
      mounted = false

      subscription.unsubscribe()
      window.clearInterval(intervalId)

      window.removeEventListener(
        'crewcall-refresh-nav',
        refresh
      )
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)

      document.removeEventListener(
        'visibilitychange',
        handleVisibility
      )
    }
  }, [loadNavCounts, resetNavState])

  useEffect(() => {
    setMobileMenuOpen(false)
    setCommandPaletteOpen(false)
  }, [pathname])

  useEffect(() => {
    const handleCommandShortcut = (
      event: KeyboardEvent,
    ) => {
      const isCommandShortcut =
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k'

      if (!isCommandShortcut || !userId) {
        return
      }

      event.preventDefault()

      setCommandPaletteOpen(
        (current) => !current,
      )
    }

    window.addEventListener(
      'keydown',
      handleCommandShortcut,
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleCommandShortcut,
      )
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      return
    }

    let channelRefreshTimer:
      | ReturnType<typeof setTimeout>
      | null = null

    const scheduleFallbackRefresh = () => {
      if (channelRefreshTimer) {
        clearTimeout(channelRefreshTimer)
      }

      channelRefreshTimer = setTimeout(() => {
        void loadNavCounts()
      }, 1500)
    }

    const handleChannelStatus = (status: string) => {
      if (
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT' ||
        status === 'CLOSED'
      ) {
        scheduleFallbackRefresh()
      }
    }

    const messageChannel = supabase
      .channel(`crewcall-global-messages-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          setUnreadMessages(
            (current) => current + 1
          )
          triggerMessagePulse()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          void loadNavCounts()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          void loadNavCounts()
        }
      )
      .subscribe(handleChannelStatus)

    const notificationChannel = supabase
      .channel(
        `crewcall-global-notifications-${userId}`
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification =
            payload.new as RealtimeNotification

          setUnreadNotifications(
            (current) => current + 1
          )
          triggerNotificationPulse()
          showToast(notification)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadNavCounts()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          void loadNavCounts()
        }
      )
      .subscribe(handleChannelStatus)

    const savedWorkersChannel = isCompanyAccount
      ? supabase
          .channel(
            `crewcall-global-saved-workers-${userId}`
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'saved_workers',
              filter: `company_id=eq.${userId}`,
            },
            () => {
              void loadNavCounts()
            }
          )
          .subscribe(handleChannelStatus)
      : null

    return () => {
      if (channelRefreshTimer) {
        clearTimeout(channelRefreshTimer)
      }

      void supabase.removeChannel(messageChannel)
      void supabase.removeChannel(notificationChannel)

      if (savedWorkersChannel) {
        void supabase.removeChannel(
          savedWorkersChannel
        )
      }
    }
  }, [
    isCompanyAccount,
    loadNavCounts,
    showToast,
    triggerMessagePulse,
    triggerNotificationPulse,
    userId,
  ])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
      }

      if (notificationPulseTimerRef.current) {
        clearTimeout(
          notificationPulseTimerRef.current
        )
      }

      if (messagePulseTimerRef.current) {
        clearTimeout(messagePulseTimerRef.current)
      }
    }
  }, [])

  async function handleLogout() {
    if (loggingOut) {
      return
    }

    setLoggingOut(true)
    setMobileMenuOpen(false)

    try {
      const { error } =
        await supabase.auth.signOut()

      if (error) {
        throw error
      }

      loadRequestRef.current += 1
      resetNavState()

      window.dispatchEvent(
        new Event('crewcall-refresh-nav')
      )

      window.location.href = '/login'
    } catch (error) {
      console.error('Unable to log out:', error)
      setLoggingOut(false)
    }
  }

  function handleToastAction() {
    const destination = toast?.linkUrl

    if (!destination) {
      return
    }

    setToast(null)
    router.push(destination)
  }

  const dashboardHref =
    role === 'admin'
      ? '/admin'
      : role === 'company'
        ? '/company/dashboard'
        : role === 'worker'
          ? '/worker/dashboard'
          : '/dashboard'

  const logoHref = userId ? dashboardHref : '/'

  const alertTotal =
    unreadMessages + unreadNotifications

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  function renderNavigation(
    onNavigate?: () => void
  ) {
    return (
      <>
        {userId ? (
          <NavLink
            href={dashboardHref}
            onClick={onNavigate}
            active={
              pathname === dashboardHref ||
              pathname === '/dashboard' ||
              pathname === '/company/dashboard' ||
              pathname === '/worker/dashboard' ||
              pathname === '/worker/dashboard'
            }
          >
            Dashboard
          </NavLink>
        ) : null}

        {isCompanyAccount ? (
          <>
            <NavLink
              href="/company/operations"
              onClick={onNavigate}
              active={pathname.startsWith(
                '/company/operations'
              )}
            >
              Operations
            </NavLink>

            <NavLink
              href="/company/payments"
              onClick={onNavigate}
              active={pathname.startsWith(
                '/company/payments'
              )}
            >
              Payments
            </NavLink>


            <NavLink
              href="/company/organization"
              onClick={onNavigate}
              active={pathname.startsWith(
                '/company/organization'
              )}
            >
              Organization
            </NavLink>

            <NavLink
              href="/company/schedule"
              onClick={onNavigate}
              active={pathname.startsWith(
                '/company/schedule'
              )}
            >
              Schedule
            </NavLink>

            <NavLink
              href="/company/recruiting"
              onClick={onNavigate}
              active={pathname.startsWith(
                '/company/recruiting'
              )}
            >
              AI Recruiting
            </NavLink>

            <NavLink
              href="/post-job"
              onClick={onNavigate}
              active={pathname.startsWith(
                '/post-job'
              )}
            >
              Post Job
            </NavLink>

            <NavLink
              href="/my-jobs"
              onClick={onNavigate}
              active={pathname.startsWith(
                '/my-jobs'
              )}
            >
              My Jobs
            </NavLink>

            <NavLink
              href="/company/invites"
              onClick={onNavigate}
              active={pathname.startsWith(
                '/company/invites'
              )}
            >
              Invites
            </NavLink>

            <NavLink
              href="/company/applications"
              onClick={onNavigate}
              active={pathname.startsWith(
                '/company/applications'
              )}
            >
              Applicants
            </NavLink>

            <NavLink
              href="/company/worker-map"
              onClick={onNavigate}
              active={pathname.startsWith(
                '/company/worker-map'
              )}
            >
              Find Workers
            </NavLink>

            <NavLink
              href="/saved-workers"
              count={savedWorkers}
              onClick={onNavigate}
              active={pathname.startsWith(
                '/saved-workers'
              )}
            >
              Saved
            </NavLink>
          </>
        ) : null}

        {role === 'worker' ? (
          <>
            <NavLink
              href="/jobs"
              onClick={onNavigate}
              active={pathname.startsWith('/jobs')}
            >
              Browse Jobs
            </NavLink>

            <NavLink
              href="/worker/applications"
              onClick={onNavigate}
              active={pathname.startsWith('/worker/applications')}
            >
              Applications
            </NavLink>

            <NavLink
              href="/my-work"
              onClick={onNavigate}
              active={pathname.startsWith(
                '/my-work'
              )}
            >
              My Work
            </NavLink>

            <NavLink
              href="/worker/payments"
              onClick={onNavigate}
              active={pathname.startsWith(
                '/worker/payments'
              )}
            >
              Payments
            </NavLink>
          </>
        ) : null}

        {role === 'admin' ? (
          <>
            <NavLink
              href="/admin"
              onClick={onNavigate}
              active={
                pathname === '/admin' ||
                pathname.startsWith('/admin/')
              }
              accent="admin"
            >
              Admin
            </NavLink>

            <NavLink
              href="/admin/release"
              onClick={onNavigate}
              active={pathname.startsWith('/admin/release')}
              accent="admin"
            >
              🚀 Release Center
            </NavLink>
          </>
        ) : null}

        {userId ? (
          <>
            <NavLink
              href="/messages"
              count={unreadMessages}
              onClick={onNavigate}
              active={pathname.startsWith(
                '/messages'
              )}
              pulse={messagePulse}
            >
              Messages
            </NavLink>

            <NavLink
              href="/notifications"
              count={alertTotal}
              onClick={onNavigate}
              active={pathname.startsWith(
                '/notifications'
              )}
              pulse={notificationPulse}
            >
              Notifications
            </NavLink>

            <NavLink
              href="/profile"
              onClick={onNavigate}
              active={pathname.startsWith(
                '/profile'
              )}
            >
              Profile
            </NavLink>

            <button
              type="button"
              onClick={() => {
                onNavigate?.()
                void handleLogout()
              }}
              disabled={loggingOut}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-2 text-sm font-black !text-red-100 shadow-md shadow-black/20 transition-all duration-200 hover:border-red-300/60 hover:bg-red-500/25 hover:!text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loggingOut
                ? tNav('loggingOut')
                : tNav('logOut')}
            </button>
          </>
        ) : null}

        {!loading && !userId ? (
          <NavLink
            href="/login"
            onClick={onNavigate}
            active={pathname.startsWith('/login')}
          >
            Login
          </NavLink>
        ) : null}
      </>
    )
  }

  return (
    <>
      <CommandPalette
        open={commandPaletteOpen}
        role={role}
        authenticated={Boolean(userId)}
        onClose={() => setCommandPaletteOpen(false)}
      />

      <CrewCallToast
        open={toast !== null}
        title={toast?.title ?? ''}
        body={toast?.body ?? null}
        actionLabel="Open"
        onAction={
          toast?.linkUrl
            ? handleToastAction
            : undefined
        }
        onDismiss={() => setToast(null)}
      />

      <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <Link
              href={logoHref}
              onClick={closeMobileMenu}
              className="group flex min-w-0 items-center gap-3 no-underline"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#081328] shadow-xl shadow-blue-900/20 transition group-hover:scale-105"><img src="/brand/crewcall-icon.png" alt="CrewCall" className="h-8 w-8 rounded-lg object-cover" /></div>

              <div className="min-w-0 leading-tight">
                <div className="truncate text-xl font-black tracking-tight !text-white">
                  CrewCall
                </div>

                <div className="truncate text-xs font-black uppercase tracking-wide !text-blue-100/80">
                  The Skilled Trades Network
                </div>
              </div>
            </Link>

            <div className="hidden flex-wrap items-center justify-end gap-2 text-sm font-black lg:flex">
              {userId ? (
                <button
                  type="button"
                  onClick={() =>
                    setCommandPaletteOpen(true)
                  }
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-2 text-sm font-black text-white shadow-md shadow-black/20 transition hover:border-blue-600/50 hover:bg-slate-700 hover:text-blue-100"
                  aria-label="Open CrewCall search"
                >
                  <span aria-hidden="true">⌕</span>
                  <span>Search</span>
                  <span className="rounded-md border border-white/10 bg-slate-950/60 px-1.5 py-0.5 text-[10px] text-slate-400">
                    ⌘K
                  </span>
                </button>
              ) : null}

              {renderNavigation()}
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              {userId ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    setCommandPaletteOpen(true)
                  }}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-slate-800 text-lg font-black text-white shadow-md shadow-black/20 transition hover:border-blue-600/50 hover:bg-slate-700 hover:text-blue-100"
                  aria-label="Open CrewCall search"
                >
                  ⌕
                </button>
              ) : null}

              {userId && alertTotal > 0 ? (
                <Link
                  href="/notifications"
                  onClick={closeMobileMenu}
                  className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-400/40 bg-orange-500/15 text-lg !text-orange-100 no-underline"
                  aria-label={`${alertTotal} unread alerts`}
                >
                  <span aria-hidden="true">!</span>

                  <span className="absolute -right-2 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-xs font-black !text-white shadow-lg shadow-orange-500/30">
                    {alertTotal > 99
                      ? '99+'
                      : alertTotal}
                  </span>
                </Link>
              ) : null}

              <button
                type="button"
                onClick={() =>
                  setMobileMenuOpen(
                    (current) => !current
                  )
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-slate-800 px-4 text-sm font-black !text-white shadow-md shadow-black/20 transition hover:border-blue-600/50 hover:bg-slate-700 hover:!text-blue-100"
                aria-expanded={mobileMenuOpen}
                aria-controls="crewcall-mobile-menu"
                aria-label={
                  mobileMenuOpen
                    ? 'Close navigation menu'
                    : 'Open navigation menu'
                }
              >
                <span className="text-lg leading-none">
                  {mobileMenuOpen ? '×' : '☰'}
                </span>

                <span>
                  {mobileMenuOpen ? 'Close' : 'Menu'}
                </span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="mt-3 flex items-center gap-2 text-xs font-bold !text-slate-400 lg:hidden">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
              Restoring your CrewCall session...
            </div>
          ) : null}

          {mobileMenuOpen ? (
            <div
              id="crewcall-mobile-menu"
              className="mt-3 border-t border-white/10 pt-3 lg:hidden"
            >
              <div className="grid max-h-[calc(100vh-110px)] grid-cols-1 gap-2 overflow-y-auto pb-3 text-sm font-black sm:grid-cols-2">
                {renderNavigation(closeMobileMenu)}
              </div>
            </div>
          ) : null}
        </div>
      </nav>
    </>
  )
}

function NavLink({
  href,
  children,
  count = 0,
  active = false,
  pulse = false,
  accent = 'default',
  onClick,
}: {
  href: string
  children: ReactNode
  count?: number
  active?: boolean
  pulse?: boolean
  accent?: 'default' | 'admin'
  onClick?: () => void
}) {
  const activeClasses =
    accent === 'admin'
      ? `
        border
        border-violet-400/60
        bg-violet-500/20
        !text-violet-100
        shadow-lg
        shadow-violet-500/15
      `
      : `
        border
        border-blue-600/50
        bg-blue-600/15
        !text-blue-100
        shadow-lg
        shadow-blue-700/10
      `

  const inactiveClasses =
    accent === 'admin'
      ? `
        border
        border-violet-400/30
        bg-violet-500/10
        !text-violet-200
        shadow-md
        shadow-black/20
        hover:border-violet-300/60
        hover:bg-violet-500/20
        hover:!text-white
      `
      : `
        border
        border-white/10
        bg-slate-800/95
        !text-white
        shadow-md
        shadow-black/20
        hover:border-blue-600/50
        hover:bg-slate-700
        hover:!text-blue-100
      `

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        relative
        inline-flex
        min-h-11
        items-center
        justify-center
        rounded-2xl
        px-4
        py-2
        text-sm
        font-black
        no-underline
        transition-all
        duration-200
        active:scale-[0.98]
        ${active ? activeClasses : inactiveClasses}
      `}
    >
      <span>{children}</span>

      {count > 0 ? (
        <span
          className={`
            absolute
            -right-2
            -top-2
            inline-flex
            min-w-5
            items-center
            justify-center
            rounded-full
            bg-orange-500
            px-1.5
            py-0.5
            text-xs
            font-black
            !text-white
            shadow-lg
            shadow-orange-500/30
            transition-transform
            duration-300
            ${
              pulse
                ? 'scale-125 animate-pulse'
                : 'scale-100'
            }
          `}
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  )
}