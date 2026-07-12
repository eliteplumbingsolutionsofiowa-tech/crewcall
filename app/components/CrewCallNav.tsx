'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import CrewCallToast from '@/app/components/CrewCallToast'

type Role = 'company' | 'worker' | null

type Profile = {
  role: Role
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

export default function CrewCallNav() {
  const pathname = usePathname()
  const router = useRouter()

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [role, setRole] = useState<Role>(null)

  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [savedWorkers, setSavedWorkers] = useState(0)

  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  const [toast, setToast] = useState<ToastState>(null)
  const [notificationPulse, setNotificationPulse] = useState(false)
  const [messagePulse, setMessagePulse] = useState(false)

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
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        resetNavState()
        setLoading(false)
        return
      }

      setUserId(user.id)

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle<Profile>()

      if (profileError) {
        console.error('Failed to load profile role:', profileError)
      }

      const userRole = profile?.role ?? null

      setRole(userRole)

      const { count: messageCount, error: messageCountError } = await supabase
        .from('messages')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq('recipient_id', user.id)
        .eq('is_read', false)

      if (messageCountError) {
        console.error(
          'Failed to load unread message count:',
          messageCountError
        )
      }

      const {
        count: notificationCount,
        error: notificationCountError,
      } = await supabase
        .from('notifications')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq('user_id', user.id)
        .or('is_read.eq.false,read.eq.false')

      if (notificationCountError) {
        console.error(
          'Failed to load unread notification count:',
          notificationCountError
        )
      }

      if (userRole === 'company') {
        const {
          count: savedWorkerCount,
          error: savedWorkerCountError,
        } = await supabase
          .from('saved_workers')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('company_id', user.id)

        if (savedWorkerCountError) {
          console.error(
            'Failed to load saved worker count:',
            savedWorkerCountError
          )
        }

        setSavedWorkers(savedWorkerCount ?? 0)
      } else {
        setSavedWorkers(0)
      }

      setUnreadMessages(messageCount ?? 0)
      setUnreadNotifications(notificationCount ?? 0)
    } catch (error) {
      console.error('Failed to load navigation counts:', error)
    } finally {
      setLoading(false)
    }
  }, [resetNavState])

  const triggerNotificationPulse = useCallback(() => {
    if (pulseTimerRef.current) {
      clearTimeout(pulseTimerRef.current)
    }

    setNotificationPulse(true)

    pulseTimerRef.current = setTimeout(() => {
      setNotificationPulse(false)
    }, 900)
  }, [])

  const triggerMessagePulse = useCallback(() => {
    if (pulseTimerRef.current) {
      clearTimeout(pulseTimerRef.current)
    }

    setMessagePulse(true)

    pulseTimerRef.current = setTimeout(() => {
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
        title: notification.title || 'New CrewCall alert',
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
          new Notification(notification.title || 'CrewCall', {
            body:
              notification.body ||
              'You have a new notification in CrewCall.',
          })
        } catch (error) {
          console.error('Browser notification failed:', error)
        }
      }
    },
    [pathname]
  )

  useEffect(() => {
    void loadNavCounts()

    const refresh = () => {
      void loadNavCounts()
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    window.addEventListener('crewcall-refresh-nav', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('crewcall-refresh-nav', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)

      document.removeEventListener(
        'visibilitychange',
        handleVisibility
      )
    }
  }, [loadNavCounts])

  useEffect(() => {
    if (!userId) {
      return
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
          setUnreadMessages((current) => current + 1)
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
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Global message realtime channel failed.')
        }
      })

    const notificationChannel = supabase
      .channel(`crewcall-global-notifications-${userId}`)
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

          setUnreadNotifications((current) => current + 1)

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
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Global notification realtime channel failed.')
        }
      })

    const savedWorkersChannel = supabase
      .channel(`crewcall-global-saved-workers-${userId}`)
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
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Saved workers realtime channel failed.')
        }
      })

    return () => {
      void supabase.removeChannel(messageChannel)
      void supabase.removeChannel(notificationChannel)
      void supabase.removeChannel(savedWorkersChannel)
    }
  }, [
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

      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current)
      }
    }
  }, [])

  async function handleLogout() {
    if (loggingOut) {
      return
    }

    try {
      setLoggingOut(true)

      const { error } = await supabase.auth.signOut()

      if (error) {
        throw error
      }

      resetNavState()

      window.dispatchEvent(
        new Event('crewcall-refresh-nav')
      )

      router.replace('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout failed:', error)
      window.alert('Unable to log out. Please try again.')
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

  const alertTotal =
    unreadMessages + unreadNotifications

  return (
    <>
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
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <Link
            href={userId ? '/dashboard' : '/'}
            className="group flex items-center gap-3 no-underline"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 via-cyan-400 to-blue-500 text-lg font-black !text-slate-950 shadow-xl shadow-cyan-500/25 transition group-hover:scale-[1.04]">
              C
            </div>

            <div className="leading-tight">
              <div className="text-xl font-black tracking-tight !text-white">
                CrewCall
              </div>

              <div className="text-xs font-black uppercase tracking-wide !text-cyan-200/80">
                Skilled labor, on demand
              </div>
            </div>
          </Link>

          <div className="flex max-w-full flex-wrap items-center gap-2 text-sm font-black">
            {userId && (
              <NavLink
                href="/dashboard"
                active={
                  pathname === '/dashboard' ||
                  pathname === '/company/dashboard' ||
                  pathname === '/worker/dashboard'
                }
              >
                Dashboard
              </NavLink>
            )}

            {role === 'company' && (
              <>
                <NavLink
                  href="/post-job"
                  active={pathname.startsWith('/post-job')}
                >
                  Post Job
                </NavLink>

                <NavLink
                  href="/my-jobs"
                  active={pathname.startsWith('/my-jobs')}
                >
                  My Jobs
                </NavLink>

                <NavLink
                  href="/company/invites"
                  active={pathname.startsWith(
                    '/company/invites'
                  )}
                >
                  Invites
                </NavLink>

                <NavLink
                  href="/company/applications"
                  active={pathname.startsWith(
                    '/company/applications'
                  )}
                >
                  Applicants
                </NavLink>

                <NavLink
                  href="/workers"
                  active={pathname.startsWith('/workers')}
                >
                  Find Workers
                </NavLink>

                <NavLink
                  href="/saved-workers"
                  count={savedWorkers}
                  active={pathname.startsWith(
                    '/saved-workers'
                  )}
                >
                  Saved
                </NavLink>
              </>
            )}

            {role === 'worker' && (
              <>
                <NavLink
                  href="/jobs"
                  active={pathname.startsWith('/jobs')}
                >
                  Browse Jobs
                </NavLink>

                <NavLink
                  href="/applications"
                  active={pathname.startsWith(
                    '/applications'
                  )}
                >
                  Applications
                </NavLink>

                <NavLink
                  href="/my-work"
                  active={pathname.startsWith('/my-work')}
                >
                  My Work
                </NavLink>
              </>
            )}

            {userId && (
              <>
                <NavLink
                  href="/messages"
                  count={unreadMessages}
                  active={pathname.startsWith('/messages')}
                  pulse={messagePulse}
                >
                  Messages
                </NavLink>

                <NavLink
                  href="/notifications"
                  count={alertTotal}
                  active={pathname.startsWith(
                    '/notifications'
                  )}
                  pulse={notificationPulse}
                >
                  Alerts
                </NavLink>

                <NavLink
                  href="/profile"
                  active={pathname.startsWith('/profile')}
                >
                  Profile
                </NavLink>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="
                    inline-flex
                    items-center
                    justify-center
                    rounded-2xl
                    border
                    border-red-400/30
                    bg-red-500/15
                    px-4
                    py-2
                    text-sm
                    font-black
                    !text-red-100
                    shadow-md
                    shadow-black/20
                    transition-all
                    duration-200
                    hover:border-red-300/60
                    hover:bg-red-500/25
                    hover:!text-white
                    active:scale-[0.98]
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                  "
                >
                  {loggingOut
                    ? 'Logging Out...'
                    : 'Log Out'}
                </button>
              </>
            )}

            {!loading && !userId && (
              <NavLink
                href="/login"
                active={pathname.startsWith('/login')}
              >
                Login
              </NavLink>
            )}
          </div>
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
}: {
  href: string
  children: React.ReactNode
  count?: number
  active?: boolean
  pulse?: boolean
}) {
  return (
    <Link
      href={href}
      className={`
        relative
        inline-flex
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
        ${
          active
            ? `
              border
              border-cyan-400/50
              bg-cyan-400/15
              !text-cyan-200
              shadow-lg
              shadow-cyan-500/10
            `
            : `
              border
              border-white/10
              bg-slate-800/95
              !text-white
              shadow-md
              shadow-black/20
              hover:border-cyan-400/50
              hover:bg-slate-700
              hover:!text-cyan-200
            `
        }
      `}
    >
      <span>{children}</span>

      {count > 0 && (
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
            ${pulse ? 'scale-125 animate-pulse' : 'scale-100'}
          `}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}