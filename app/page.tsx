'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  full_name: string | null
  company_name: string | null
  role: 'worker' | 'company' | null
}

type FeaturedJob = {
  id: string
  title: string
  trade: string
  location: string
  pay_rate: string | null
  is_featured: boolean | null
  featured_until: string | null
  company: {
    company_name: string | null
    full_name: string | null
  } | null
}

export default function HomePage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [openJobsCount, setOpenJobsCount] = useState(0)
  const [myApplicationsCount, setMyApplicationsCount] = useState(0)
  const [myJobsCount, setMyJobsCount] = useState(0)
  const [featuredJobs, setFeaturedJobs] = useState<FeaturedJob[]>([])

  useEffect(() => {
    loadHome()
  }, [])

  async function loadHome() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Open jobs count
    const { count: jobsCount } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open')

    setOpenJobsCount(jobsCount || 0)

    // Featured jobs
    const { data: featuredData } = await supabase
      .from('jobs')
      .select(`
        id,
        title,
        trade,
        location,
        pay_rate,
        is_featured,
        featured_until,
        company:company_id (
          company_name,
          full_name
        )
      `)
      .eq('status', 'open')
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(6)

    // 🔥 FIX: normalize company array
    const activeFeatured = (featuredData || [])
      .map((job: any) => ({
        ...job,
        company: Array.isArray(job.company)
          ? job.company[0]
          : job.company,
      }))
      .filter((job) => isFeatured(job)) as FeaturedJob[]

    setFeaturedJobs(activeFeatured)

    if (!user) {
      setLoading(false)
      return
    }

    // Profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, company_name, role')
      .eq('id', user.id)
      .maybeSingle()

    const loadedProfile = profileData as Profile | null
    setProfile(loadedProfile)

    if (loadedProfile?.role === 'worker') {
      const { count } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('worker_id', user.id)

      setMyApplicationsCount(count || 0)
    }

    if (loadedProfile?.role === 'company') {
      const { count } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', user.id)

      setMyJobsCount(count || 0)
    }

    setLoading(false)
  }

  if (loading) return <main className="p-6">Loading CrewCall...</main>

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <h1 className="text-3xl font-bold mb-6">CrewCall Dashboard</h1>

      <p>Open Jobs: {openJobsCount}</p>

      {featuredJobs.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-bold mb-4">Featured Jobs</h2>

          {featuredJobs.map((job) => (
            <div key={job.id} className="border p-4 mb-3 rounded">
              <h3 className="font-bold">{job.title}</h3>
              <p>
                {job.company?.company_name || job.company?.full_name || 'Company'}
              </p>
              <p>
                {job.trade} - {job.location}
              </p>
              <p>Pay: {job.pay_rate || 'Not listed'}</p>

              <Link href={`/jobs/${job.id}`} className="text-blue-600">
                View Job
              </Link>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

function isFeatured(job: FeaturedJob) {
  if (!job.is_featured || !job.featured_until) return false
  return new Date(job.featured_until).getTime() > Date.now()
}