'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { resolveCompanyContext } from '@/lib/company-context'

type Branch = {
  id: string
  company_id: string
  name: string
  city: string | null
  state: string | null
  address: string | null
  phone: string | null
  is_headquarters: boolean
  created_at: string
  updated_at: string
}

type TeamMember = {
  id: string
  company_id: string
  branch_id: string | null
  user_id: string | null
  email: string
  role: string
  status: string
  invited_at: string
  joined_at: string | null
}

type Job = {
  id: string
  status: string | null
}

type BranchForm = {
  name: string
  city: string
  state: string
  address: string
  phone: string
  is_headquarters: boolean
}

const emptyBranchForm: BranchForm = {
  name: '',
  city: '',
  state: '',
  address: '',
  phone: '',
  is_headquarters: false,
}

const roles = [
  'Owner',
  'Admin',
  'Branch Manager',
  'Dispatcher',
  'Recruiter',
  'Accounting',
  'Supervisor',
  'Employee',
]

export default function OrganizationPage() {

  const t = useTranslations('CompanyOrganization')
  const locale = useLocale()
  const supabaseAny = supabase as any

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState(t('companyFallback'))

  const [branches, setBranches] = useState<Branch[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [jobs, setJobs] = useState<Job[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [branchError, setBranchError] = useState<string | null>(null)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const [showBranchForm, setShowBranchForm] = useState(false)
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null)
  const [viewingBranchId, setViewingBranchId] = useState<string | null>(null)
  const [branchForm, setBranchForm] =
    useState<BranchForm>(emptyBranchForm)

  const [inviteEmail, setInviteEmail] = useState('')
  const [selectedRole, setSelectedRole] = useState('Admin')
  const [selectedBranchId, setSelectedBranchId] = useState('')

  function roleLabel(role: string) {
    const labels: Record<string, string> = {
      Owner: 'Propietario',
      Admin: 'Administrador',
      'Branch Manager': 'Gerente de Sucursal',
      Dispatcher: 'Despachador',
      Recruiter: 'Reclutador',
      Accounting: 'Contabilidad',
      Supervisor: 'Supervisor',
      Employee: 'Empleado',
    }

    if (locale !== 'es') return role
    return labels[role] || role
  }

  function memberStatusLabel(status: string) {
    const normalized = status.toLowerCase()

    if (normalized === 'invited') {
      return locale === 'es' ? 'Invitado' : 'Invited'
    }

    if (normalized === 'active') {
      return locale === 'es' ? 'Activo' : 'Active'
    }

    if (normalized === 'accepted') {
      return locale === 'es' ? 'Aceptado' : 'Accepted'
    }

    if (normalized === 'joined') {
      return locale === 'es' ? 'Se unió' : 'Joined'
    }

    if (normalized === 'disabled') {
      return locale === 'es' ? 'Deshabilitado' : 'Disabled'
    }

    return status
  }


  const loadOrganization = useCallback(async () => {
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage(t('loginRequired'))
      setLoading(false)
      return
    }

    const companyContext =
      await resolveCompanyContext(
        supabase,
        user.id
      )

    if (!companyContext.companyId) {
      setCompanyId(null)
      setMessage(
        t('companyRequired')
      )
      setLoading(false)
      return
    }

    const resolvedCompanyId =
      companyContext.companyId

    setCompanyId(resolvedCompanyId)

    const { data: profile, error: profileError } =
      await supabaseAny
        .from('profiles')
        .select('id, role, company_name, full_name')
        .eq('id', resolvedCompanyId)
        .maybeSingle()

    if (profileError) {
      setMessage(profileError.message)
      setLoading(false)
      return
    }

    setCompanyName(
      profile?.company_name ||
        profile?.full_name ||
        t('companyFallback')
    )

    const [
      branchesResult,
      teamResult,
      jobsResult,
    ] = await Promise.all([
      supabaseAny
        .from('company_branches')
        .select(
          `
          id,
          company_id,
          name,
          city,
          state,
          address,
          phone,
          is_headquarters,
          created_at,
          updated_at
          `
        )
        .eq('company_id', resolvedCompanyId)
        .order('is_headquarters', { ascending: false })
        .order('name', { ascending: true }),

      supabaseAny
        .from('company_team_members')
        .select(
          `
          id,
          company_id,
          branch_id,
          user_id,
          email,
          role,
          status,
          invited_at,
          joined_at
          `
        )
        .eq('company_id', resolvedCompanyId)
        .order('invited_at', { ascending: false }),

      supabaseAny
        .from('jobs')
        .select('id, status')
        .eq('company_id', resolvedCompanyId),
    ])

    if (branchesResult.error) {
      setMessage(branchesResult.error.message)
    }

    if (teamResult.error) {
      setMessage(teamResult.error.message)
    }

    if (jobsResult.error) {
      setMessage(jobsResult.error.message)
    }

    setBranches(
      (branchesResult.data as Branch[] | null) || []
    )

    setTeamMembers(
      (teamResult.data as TeamMember[] | null) || []
    )

    setJobs(
      (jobsResult.data as Job[] | null) || []
    )

    setLoading(false)
  }, [supabaseAny, t])

  useEffect(() => {
    void loadOrganization()
  }, [loadOrganization])

  const activeJobs = useMemo(
    () =>
      jobs.filter((job) => {
        const status = String(job.status || '')
          .trim()
          .toLowerCase()

        return (
          status !== 'completed' &&
          status !== 'cancelled' &&
          status !== 'canceled'
        )
      }).length,
    [jobs]
  )

  const pendingInvites = useMemo(
    () =>
      teamMembers.filter(
        (member) => member.status === 'invited'
      ).length,
    [teamMembers]
  )

  const stats = useMemo(
    () => [
      {
        label: t('branches'),
        value: branches.length,
      },
      {
        label: t('teamMembers'),
        value: teamMembers.length,
      },
      {
        label: t('activeJobs'),
        value: activeJobs,
      },
      {
        label: t('pendingInvites'),
        value: pendingInvites,
      },
    ],
    [
      activeJobs,
      branches.length,
      pendingInvites,
      teamMembers.length,
      t,
    ]
  )

  function membersForBranch(branchId: string) {
    return teamMembers.filter(
      (member) => member.branch_id === branchId
    )
  }

  function startAddBranch() {
    setEditingBranchId(null)
    setViewingBranchId(null)
    setBranchForm(emptyBranchForm)
    setShowBranchForm(true)
    setMessage(null)
    setBranchError(null)
  }

  function startEditBranch(branch: Branch) {
    setEditingBranchId(branch.id)
    setViewingBranchId(null)
    setBranchForm({
      name: branch.name,
      city: branch.city || '',
      state: branch.state || '',
      address: branch.address || '',
      phone: branch.phone || '',
      is_headquarters: branch.is_headquarters,
    })
    setShowBranchForm(true)
    setMessage(null)
    setBranchError(null)
  }

  function cancelBranchForm() {
    setShowBranchForm(false)
    setEditingBranchId(null)
    setBranchForm(emptyBranchForm)
    setBranchError(null)
  }

  async function saveBranch() {
    if (!companyId) return

    const name = branchForm.name.trim()

    if (!name) {
      setBranchError(t('enterBranchName'))
      return
    }

    const duplicateBranch = branches.find(
      (branch) =>
        branch.id !== editingBranchId &&
        branch.name.trim().toLowerCase() === name.toLowerCase()
    )

    if (duplicateBranch) {
      setBranchError(
        t('duplicateBranch', { name })
      )
      return
    }

    setSaving(true)
    setMessage(null)
    setBranchError(null)

    try {
      if (branchForm.is_headquarters) {
        const headquartersQuery = supabaseAny
          .from('company_branches')
          .update({
            is_headquarters: false,
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', companyId)

        if (editingBranchId) {
          await headquartersQuery.neq(
            'id',
            editingBranchId
          )
        } else {
          await headquartersQuery
        }
      }

      const payload = {
        company_id: companyId,
        name,
        city: branchForm.city.trim() || null,
        state: branchForm.state.trim() || null,
        address: branchForm.address.trim() || null,
        phone: branchForm.phone.trim() || null,
        is_headquarters:
          branchForm.is_headquarters,
        updated_at: new Date().toISOString(),
      }

      if (editingBranchId) {
        const { error } = await supabaseAny
          .from('company_branches')
          .update(payload)
          .eq('id', editingBranchId)
          .eq('company_id', companyId)

        if (error) throw error

        setMessage(t('branchUpdated'))
      } else {
        const { error } = await supabaseAny
          .from('company_branches')
          .insert(payload)

        if (error) throw error

        setMessage(t('branchAdded'))
      }

      cancelBranchForm()
      await loadOrganization()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t('branchSaveFailed')
      )
    } finally {
      setSaving(false)
    }
  }

  async function sendInvite() {
    if (!companyId) return

    const email = inviteEmail
      .trim()
      .toLowerCase()

    setInviteError(null)
    setInviteMessage(null)

    if (!email) {
      setInviteError(t('enterEmail'))
      return
    }

    const emailLooksValid =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

    if (!emailLooksValid) {
      setInviteError(t('validEmail'))
      return
    }

    const existingMember = teamMembers.find(
      (member) =>
        member.email.trim().toLowerCase() === email
    )

    if (
      existingMember &&
      existingMember.status !== 'invited'
    ) {
      setInviteError(
        t('alreadyMember', { email })
      )
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      let inviteId: string

      if (
        existingMember &&
        existingMember.status === 'invited'
      ) {
        const { data: updatedInvite, error } =
          await supabaseAny
            .from('company_team_members')
            .update({
              branch_id: selectedBranchId || null,
              role: selectedRole,
              invited_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingMember.id)
            .select('id')
            .single()

        if (error) {
          throw error
        }

        inviteId = updatedInvite.id
      } else {
        const { data: createdInvite, error } =
          await supabaseAny
            .from('company_team_members')
            .insert({
              company_id: companyId,
              branch_id: selectedBranchId || null,
              email,
              role: selectedRole,
              status: 'invited',
              invited_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select('id')
            .single()

        if (error) {
          throw error
        }

        inviteId = createdInvite.id
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error(
          t('inviteSessionError')
        )
      }

      const emailResponse = await fetch(
        '/api/company/team-invite',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            inviteId,
          }),
        }
      )

      const emailResult =
        await emailResponse.json()

      setInviteEmail('')
      setSelectedRole('Admin')
      setSelectedBranchId('')

      if (!emailResponse.ok) {
        setInviteError(
          t('inviteEmailFailed', {
            error:
              emailResult?.error ||
              t('unknownEmailError'),
          })
        )
      } else {
        setInviteMessage(
          existingMember
            ? t('inviteResent', { email })
            : t('inviteSent', { email })
        )
      }

      await loadOrganization()
    } catch (error) {
      setInviteError(
        error instanceof Error
          ? error.message
          : t('inviteCreateFailed')
      )
    } finally {
      setSaving(false)
    }
  }

  async function resendTeamInvite(member: TeamMember) {
    setSaving(true)
    setInviteError(null)
    setInviteMessage(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error(t('inviteSessionError'))
      }

      const emailResponse = await fetch(
        '/api/company/team-invite',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            inviteId: member.id,
          }),
        }
      )

      const result = await emailResponse.json()

      if (!emailResponse.ok) {
        throw new Error(
          result?.error || t('teamActionFailed')
        )
      }

      setInviteMessage(
        t('inviteResent', {
          email: member.email,
        })
      )
    } catch (error) {
      setInviteError(
        error instanceof Error
          ? error.message
          : t('teamActionFailed')
      )
    } finally {
      setSaving(false)
    }
  }

  async function removeTeamMember(
    member: TeamMember
  ) {
    if (!companyId) return

    const isPendingInvite =
      member.status === 'invited'

    const confirmed = window.confirm(
      isPendingInvite
        ? t('cancelInviteConfirm', {
            email: member.email,
          })
        : t('removeMemberConfirm', {
            email: member.email,
          })
    )

    if (!confirmed) return

    setSaving(true)
    setInviteError(null)
    setInviteMessage(null)

    try {
      const { error } = await supabaseAny
        .from('company_team_members')
        .delete()
        .eq('id', member.id)
        .eq('company_id', companyId)

      if (error) {
        throw error
      }

      setInviteMessage(
        isPendingInvite
          ? t('inviteCancelled')
          : t('memberRemoved')
      )

      await loadOrganization()
    } catch (error) {
      setInviteError(
        error instanceof Error
          ? error.message
          : t('teamActionFailed')
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
        <div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="font-black text-slate-300">
            {t('loading')}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            {t('enterprise')}
          </p>

          <h1 className="mt-3 text-4xl font-black">
            {t('title')}
          </h1>

          <p className="mt-3 max-w-3xl text-slate-400">
            {t('description', { company: companyName })}
          </p>
        </section>

        {message && (
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-4 text-sm font-bold text-cyan-100">
            {message}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <p className="text-xs font-bold uppercase text-slate-500">
                {item.label}
              </p>

              <p className="mt-2 text-3xl font-black">
                {item.value}
              </p>
            </div>
          ))}
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black">
              {t('branches')}
            </h2>

            <button
              type="button"
              onClick={startAddBranch}
              className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950"
            >
              {t('addBranch')}
            </button>
          </div>

          {showBranchForm && (
            <div className="mb-5 rounded-2xl border border-cyan-400/20 bg-white/5 p-6">
              <h3 className="text-xl font-black">
                {editingBranchId
                  ? t('editBranch')
                  : t('addBranch')}
              </h3>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <input
                  value={branchForm.name}
                  onChange={(event) => {
                    setBranchForm((previous) => ({
                      ...previous,
                      name: event.target.value,
                    }))
                    setBranchError(null)
                  }}
                  placeholder={t('branchName')}
                  className="rounded-xl bg-slate-900 px-4 py-3 outline-none"
                />

                <input
                  value={branchForm.phone}
                  onChange={(event) =>
                    setBranchForm((previous) => ({
                      ...previous,
                      phone: event.target.value,
                    }))
                  }
                  placeholder={t('phone')}
                  className="rounded-xl bg-slate-900 px-4 py-3 outline-none"
                />

                <input
                  value={branchForm.address}
                  onChange={(event) =>
                    setBranchForm((previous) => ({
                      ...previous,
                      address: event.target.value,
                    }))
                  }
                  placeholder={t('streetAddress')}
                  className="rounded-xl bg-slate-900 px-4 py-3 outline-none md:col-span-2"
                />

                <input
                  value={branchForm.city}
                  onChange={(event) =>
                    setBranchForm((previous) => ({
                      ...previous,
                      city: event.target.value,
                    }))
                  }
                  placeholder={t('city')}
                  className="rounded-xl bg-slate-900 px-4 py-3 outline-none"
                />

                <input
                  value={branchForm.state}
                  onChange={(event) =>
                    setBranchForm((previous) => ({
                      ...previous,
                      state: event.target.value,
                    }))
                  }
                  placeholder={t('state')}
                  className="rounded-xl bg-slate-900 px-4 py-3 outline-none"
                />
              </div>

              <label className="mt-4 flex items-center gap-3 text-sm font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={branchForm.is_headquarters}
                  onChange={(event) =>
                    setBranchForm((previous) => ({
                      ...previous,
                      is_headquarters:
                        event.target.checked,
                    }))
                  }
                  className="h-5 w-5 accent-cyan-400"
                />
                {t('headquarters')}
              </label>

              {branchError && (
                <div className="mt-5 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
                  ⚠ {branchError}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void saveBranch()}
                  disabled={saving}
                  className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950 disabled:opacity-60"
                >
                  {saving
                    ? t('saving')
                    : editingBranchId
                      ? t('saveChanges')
                      : t('createBranch')}
                </button>

                <button
                  type="button"
                  onClick={cancelBranchForm}
                  disabled={saving}
                  className="rounded-xl bg-white/10 px-5 py-3 font-black"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}

          {branches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">
              {t('noBranches')}
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {branches.map((branch) => {
                const branchMembers =
                  membersForBranch(branch.id)

                const viewing =
                  viewingBranchId === branch.id

                return (
                  <div
                    key={branch.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-6"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-black">
                          {branch.name}
                        </h3>

                        <p className="mt-1 text-sm font-semibold text-slate-400">
                          {[branch.city, branch.state]
                            .filter(Boolean)
                            .join(', ') ||
                            t('locationNotAdded')}
                        </p>
                      </div>

                      {branch.is_headquarters && (
                        <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-black text-cyan-300">
                          {t('headquartersShort')}
                        </span>
                      )}
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <Stat
                        label={t('teamMembers')}
                        value={branchMembers.length}
                      />
                      <Stat
                        label={t('pendingInvites')}
                        value={
                          branchMembers.filter(
                            (member) =>
                              member.status ===
                              'invited'
                          ).length
                        }
                      />
                    </div>

                    {viewing && (
                      <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/60 p-4">
                        <p className="text-xs font-bold uppercase text-slate-500">
                          {t('address')}
                        </p>

                        <p className="mt-1 font-bold text-slate-200">
                          {branch.address ||
                            t('notAdded')}
                        </p>

                        <p className="mt-4 text-xs font-bold uppercase text-slate-500">
                          {t('phone')}
                        </p>

                        <p className="mt-1 font-bold text-slate-200">
                          {branch.phone ||
                            t('notAdded')}
                        </p>

                        <p className="mt-4 text-xs font-bold uppercase text-slate-500">
                          {t('team')}
                        </p>

                        {branchMembers.length === 0 ? (
                          <p className="mt-1 text-sm font-semibold text-slate-400">
                            {t('noTeamAssigned')}
                          </p>
                        ) : (
                          <div className="mt-2 space-y-2">
                            {branchMembers.map(
                              (member) => (
                                <div
                                  key={member.id}
                                  className="rounded-lg bg-white/5 px-3 py-2 text-sm"
                                >
                                  <span className="font-black">
                                    {member.email}
                                  </span>{' '}
                                  <span className="text-slate-400">
                                    · {roleLabel(member.role)} ·{' '}
                                    {memberStatusLabel(member.status)}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-5 flex gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setViewingBranchId(
                            viewing
                              ? null
                              : branch.id
                          )
                        }
                        className="rounded-xl bg-white/10 px-4 py-2 font-bold"
                      >
                        {viewing ? t('close') : t('view')}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          startEditBranch(branch)
                        }
                        className="rounded-xl bg-white/10 px-4 py-2 font-bold"
                      >
                        {t('edit')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-black">
            {t('addTeamMember')}
          </h2>

          <p className="mt-2 text-sm font-semibold text-slate-400">
            {t('addTeamDescription')}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <input
              value={inviteEmail}
              onChange={(event) => {
                setInviteEmail(event.target.value)
                setInviteError(null)
                setInviteMessage(null)
              }}
              placeholder={t('emailAddress')}
              type="email"
              className="rounded-xl bg-slate-900 px-4 py-3 outline-none"
            />

            <select
              value={selectedRole}
              onChange={(event) =>
                setSelectedRole(event.target.value)
              }
              className="rounded-xl bg-slate-900 px-4 py-3"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>

            <select
              value={selectedBranchId}
              onChange={(event) =>
                setSelectedBranchId(
                  event.target.value
                )
              }
              className="rounded-xl bg-slate-900 px-4 py-3"
            >
              <option value="">
                {t('noBranchAssigned')}
              </option>

              {branches.map((branch) => (
                <option
                  key={branch.id}
                  value={branch.id}
                >
                  {branch.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void sendInvite()}
              disabled={saving}
              className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950 disabled:opacity-60"
            >
              {saving
                ? t('saving')
                : t('sendInvite')}
            </button>
          </div>

          {inviteError && (
            <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
              ⚠ {inviteError}
            </div>
          )}

          {inviteMessage && (
            <div className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200">
              ✓ {inviteMessage}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-black">
            {t('teamInvitations')}
          </h2>

          {teamMembers.length === 0 ? (
            <p className="mt-4 text-sm font-semibold text-slate-400">
              {t('noTeamInvites')}
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {teamMembers.map((member) => {
                const branch =
                  branches.find(
                    (item) =>
                      item.id ===
                      member.branch_id
                  )

                return (
                  <div
                    key={member.id}
                    className="flex flex-col gap-4 rounded-xl border border-white/10 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-black">
                        {member.email}
                      </p>

                      <p className="text-sm font-semibold text-slate-400">
                        {roleLabel(member.role)} ·{' '}
                        {branch?.name ||
                          t('noBranch')}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className="w-fit rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase text-cyan-300">
                        {memberStatusLabel(member.status)}
                      </span>

                      {member.status === 'invited' && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void resendTeamInvite(member)
                          }
                          className="rounded-lg bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {t('resendInvite')}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void removeTeamMember(member)
                        }
                        className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-black text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {member.status === 'invited'
                          ? t('cancelInvite')
                          : t('removeMember')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function Stat({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
      <p className="text-xs font-bold uppercase text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-black">
        {value}
      </p>
    </div>
  )
}
