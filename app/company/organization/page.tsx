'use client'

import { useMemo, useState } from 'react'

type Branch = {
  id: string
  name: string
  employees: number
  jobs: number
  payroll: string
  rating: string
}

const branches: Branch[] = [
  {
    id: '1',
    name: 'Des Moines HQ',
    employees: 42,
    jobs: 18,
    payroll: '$82,400',
    rating: '4.9',
  },
  {
    id: '2',
    name: 'Ankeny Branch',
    employees: 15,
    jobs: 7,
    payroll: '$31,200',
    rating: '4.8',
  },
]

const roles = [
  'Owner',
  'Admin',
  'Branch Manager',
  'Dispatcher',
  'Recruiter',
  'Accounting',
  'Supervisor',
]

export default function OrganizationPage() {
  const [selectedRole, setSelectedRole] = useState('Admin')

  const stats = useMemo(
    () => [
      {
        label: 'Branches',
        value: branches.length,
      },
      {
        label: 'Employees',
        value: '57',
      },
      {
        label: 'Active Jobs',
        value: '25',
      },
      {
        label: 'Monthly Spend',
        value: '$113,600',
      },
    ],
    [],
  )

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            Enterprise
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Organization Management
          </h1>

          <p className="mt-3 max-w-3xl text-slate-400">
            Manage branches, teams, permissions, and workforce operations
            across your entire company.
          </p>
        </section>

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
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-black">
              Branches
            </h2>

            <button className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">
              Add Branch
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {branches.map((branch) => (
              <div
                key={branch.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-6"
              >
                <h3 className="text-xl font-black">
                  {branch.name}
                </h3>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Stat label="Employees" value={branch.employees} />
                  <Stat label="Open Jobs" value={branch.jobs} />
                  <Stat label="Payroll" value={branch.payroll} />
                  <Stat label="Rating" value={branch.rating} />
                </div>

                <div className="mt-5 flex gap-3">
                  <button className="rounded-xl bg-white/10 px-4 py-2 font-bold">
                    View
                  </button>

                  <button className="rounded-xl bg-white/10 px-4 py-2 font-bold">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-black">
            Add Team Member
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <input
              placeholder="Email address"
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
                <option key={role}>
                  {role}
                </option>
              ))}
            </select>

            <button className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">
              Send Invite
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-green-400/20 bg-green-400/5 p-6">
          <h2 className="text-xl font-black">
            Organization Activity
          </h2>

          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li>✓ Branch manager updated</li>
            <li>✓ Worker transferred between branches</li>
            <li>✓ AI recruiter filled a position</li>
            <li>✓ New team member invited</li>
          </ul>
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
