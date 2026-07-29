'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useRouter } from 'next/navigation'

type Role = 'company' | 'worker' | 'admin' | null

type CommandItem = {
  id: string
  title: string
  description: string
  href: string
  keywords: string[]
  icon: string
  roles: Array<'company' | 'worker' | 'admin' | 'authenticated'>
}

type CommandPaletteProps = {
  open: boolean
  role: Role
  authenticated: boolean
  onClose: () => void
}

const COMMANDS: CommandItem[] = [
  {
    id: 'company-dashboard',
    title: 'Company Dashboard',
    description: 'View company activity, hiring, jobs, and payments.',
    href: '/company/dashboard',
    keywords: ['dashboard', 'company', 'home', 'overview'],
    icon: '▦',
    roles: ['company', 'admin'],
  },
  {
    id: 'worker-dashboard',
    title: 'Worker Dashboard',
    description: 'View work activity, availability, jobs, and earnings.',
    href: '/worker/dashboard',
    keywords: ['dashboard', 'worker', 'home', 'overview'],
    icon: '▦',
    roles: ['worker'],
  },
  {
    id: 'operations',
    title: 'Operations Center',
    description: 'Manage active jobs, workers, schedules, and dispatch.',
    href: '/company/operations',
    keywords: ['operations', 'dispatch', 'schedule', 'active jobs'],
    icon: '◎',
    roles: ['company', 'admin'],
  },
  {
    id: 'post-job',
    title: 'Post a Job',
    description: 'Create a new job opportunity for skilled workers.',
    href: '/post-job',
    keywords: ['post', 'job', 'create', 'new opportunity', 'hire'],
    icon: '+',
    roles: ['company', 'admin'],
  },
  {
    id: 'my-jobs',
    title: 'My Jobs',
    description: 'Manage your open, assigned, and completed jobs.',
    href: '/my-jobs',
    keywords: ['jobs', 'company jobs', 'manage jobs', 'open jobs'],
    icon: '▣',
    roles: ['company', 'admin'],
  },
  {
    id: 'applicants',
    title: 'Applicants',
    description: 'Review workers who applied to your job postings.',
    href: '/company/applications',
    keywords: ['applicants', 'applications', 'candidates', 'hire'],
    icon: '✓',
    roles: ['company', 'admin'],
  },
  {
    id: 'invites',
    title: 'Worker Invites',
    description: 'Review pending, accepted, and declined worker invites.',
    href: '/company/invites',
    keywords: ['invites', 'invite workers', 'pending invitations'],
    icon: '→',
    roles: ['company', 'admin'],
  },
  {
    id: 'find-workers',
    title: 'Find Workers',
    description: 'Search available workers by trade and location.',
    href: '/workers',
    keywords: ['workers', 'find workers', 'labor', 'trade', 'map'],
    icon: '⌖',
    roles: ['company', 'admin'],
  },
  {
    id: 'worker-map',
    title: 'Worker Map',
    description: 'View available workers on the CrewCall map.',
    href: '/company/worker-map',
    keywords: ['worker map', 'location', 'nearby', 'workers'],
    icon: '◎',
    roles: ['company', 'admin'],
  },
  {
    id: 'saved-workers',
    title: 'Saved Workers',
    description: 'Open your list of saved workers.',
    href: '/saved-workers',
    keywords: ['saved', 'favorites', 'saved workers'],
    icon: '★',
    roles: ['company', 'admin'],
  },
  {
    id: 'browse-jobs',
    title: 'Browse Jobs',
    description: 'Find available CrewCall jobs.',
    href: '/jobs',
    keywords: ['browse', 'jobs', 'find work', 'open jobs'],
    icon: '⌕',
    roles: ['worker'],
  },
  {
    id: 'worker-applications',
    title: 'My Applications',
    description: 'Track your submitted job applications.',
    href: '/applications',
    keywords: ['applications', 'applied jobs', 'pending'],
    icon: '✓',
    roles: ['worker'],
  },
  {
    id: 'my-work',
    title: 'My Work',
    description: 'View assigned, active, and completed work.',
    href: '/my-work',
    keywords: ['work', 'assigned jobs', 'completed jobs'],
    icon: '▣',
    roles: ['worker'],
  },
  {
    id: 'saved-jobs',
    title: 'Saved Jobs',
    description: 'Open jobs you saved for later.',
    href: '/saved-jobs',
    keywords: ['saved jobs', 'favorites', 'bookmarks'],
    icon: '★',
    roles: ['worker'],
  },
  {
    id: 'messages',
    title: 'Messages',
    description: 'Open CrewCall conversations.',
    href: '/messages',
    keywords: ['messages', 'chat', 'conversations', 'inbox'],
    icon: '✉',
    roles: ['authenticated'],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Review account, job, application, and payment alerts.',
    href: '/notifications',
    keywords: ['notifications', 'alerts', 'updates'],
    icon: '!',
    roles: ['authenticated'],
  },
  {
    id: 'profile',
    title: 'Profile',
    description: 'View and update your CrewCall profile.',
    href: '/profile',
    keywords: ['profile', 'account', 'settings', 'company profile'],
    icon: '○',
    roles: ['authenticated'],
  },
  {
    id: 'billing',
    title: 'Billing',
    description: 'Manage subscription and billing settings.',
    href: '/billing',
    keywords: ['billing', 'subscription', 'payment', 'stripe'],
    icon: '$',
    roles: ['company', 'admin'],
  },
  {
    id: 'company-analytics',
    title: 'Company Analytics',
    description: 'Review company hiring and job performance.',
    href: '/company/analytics',
    keywords: ['analytics', 'reports', 'performance', 'statistics'],
    icon: '↗',
    roles: ['company', 'admin'],
  },
  {
    id: 'admin',
    title: 'Admin Command Center',
    description: 'Open CrewCall platform administration.',
    href: '/admin',
    keywords: ['admin', 'platform', 'users', 'jobs', 'payments'],
    icon: '◆',
    roles: ['admin'],
  },
  {
    id: 'admin-users',
    title: 'Admin Users',
    description: 'Search and manage CrewCall users.',
    href: '/admin/users',
    keywords: ['admin users', 'members', 'accounts'],
    icon: '○',
    roles: ['admin'],
  },
  {
    id: 'admin-jobs',
    title: 'Admin Jobs',
    description: 'Review jobs across the CrewCall platform.',
    href: '/admin/jobs',
    keywords: ['admin jobs', 'platform jobs'],
    icon: '▣',
    roles: ['admin'],
  },
  {
    id: 'admin-payments',
    title: 'Admin Payments',
    description: 'Review payments and payout activity.',
    href: '/admin/payments',
    keywords: ['admin payments', 'stripe', 'payouts', 'revenue'],
    icon: '$',
    roles: ['admin'],
  },
]

export default function CommandPalette({
  open,
  role,
  authenticated,
  onClose,
}: CommandPaletteProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const availableCommands = useMemo(() => {
    return COMMANDS.filter((command) => {
      if (authenticated && command.roles.includes('authenticated')) {
        return true
      }

      if (!role) {
        return false
      }

      return command.roles.includes(role)
    })
  }, [authenticated, role])

  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return availableCommands
    }

    return availableCommands.filter((command) => {
      const searchableText = [
        command.title,
        command.description,
        ...command.keywords,
      ]
        .join(' ')
        .toLowerCase()

      return searchableText.includes(normalizedQuery)
    })
  }, [availableCommands, query])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setSelectedIndex(0)
      return
    }

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 50)

    return () => {
      window.clearTimeout(focusTimer)
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) {
      return
    }

    const selectedItem = itemRefs.current[selectedIndex]

    selectedItem?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    })
  }, [open, selectedIndex])

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  const openCommand = useCallback(
    (command: CommandItem) => {
      onClose()
      router.push(command.href)
    },
    [onClose, router],
  )

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()

      setSelectedIndex((current) => {
        if (filteredCommands.length === 0) {
          return 0
        }

        return (current + 1) % filteredCommands.length
      })

      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()

      setSelectedIndex((current) => {
        if (filteredCommands.length === 0) {
          return 0
        }

        return (
          current -
          1 +
          filteredCommands.length
        ) % filteredCommands.length
      })

      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()

      const selectedCommand = filteredCommands[selectedIndex]

      if (selectedCommand) {
        openCommand(selectedCommand)
      }
    }
  }

  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/80 px-4 pt-[10vh] backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="CrewCall universal search"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose()
        }
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/15 bg-slate-900 shadow-2xl shadow-black/60">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-cyan-400/30 bg-slate-950/70 px-4">
            <span
              aria-hidden="true"
              className="text-xl text-cyan-300"
            >
              ⌕
            </span>

            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search CrewCall..."
              className="min-h-14 flex-1 bg-transparent text-base font-bold text-white outline-none placeholder:text-slate-500"
              aria-label="Search CrewCall"
            />

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-black text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              ESC
            </button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          {filteredCommands.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-lg font-black text-white">
                No CrewCall results
              </p>

              <p className="mt-2 text-sm text-slate-400">
                Try searching for jobs, workers, messages, billing, or profile.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredCommands.map((command, index) => {
                const selected = index === selectedIndex

                return (
                  <button
                    key={command.id}
                    ref={(element) => {
                      itemRefs.current[index] = element
                    }}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => openCommand(command)}
                    className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
                      selected
                        ? 'border-cyan-400/40 bg-cyan-400/10'
                        : 'border-transparent hover:border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 text-lg font-black text-cyan-200">
                      {command.icon}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black text-white">
                        {command.title}
                      </span>

                      <span className="mt-1 block truncate text-sm text-slate-400">
                        {command.description}
                      </span>
                    </span>

                    <span
                      className={`text-lg transition ${
                        selected
                          ? 'translate-x-0 text-cyan-300'
                          : '-translate-x-1 text-slate-600'
                      }`}
                    >
                      →
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-950/50 px-5 py-3 text-xs font-bold text-slate-500">
          <span>↑ ↓ Navigate</span>
          <span>Enter Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  )
}