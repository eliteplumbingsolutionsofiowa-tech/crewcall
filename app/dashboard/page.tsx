'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DashboardPage() {
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRole()
  }, [])

  const fetchRole = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error loading role:', error.message)
    } else {
      setRole(data?.role || null)
    }

    setLoading(false)
  }

  const workerCards = [
    {
      href: '/jobs',
      title: 'Browse Jobs',
      text: 'Find available work near you.',
    },
    {
      href: '/my-applications',
      title: 'My Applications',
      text: 'Track jobs you applied for.',
    },
    {
      href: '/messages',
      title: 'Messages',
      text: 'Chat with companies about jobs.',
    },
  ]

  const companyCards = [
    {
      href: '/my-jobs',
      title: 'My Jobs',
      text: 'View and manage jobs you posted.',
    },
    {
      href: '/jobs/create',
      title: 'Post a Job',
      text: 'Create a new job listing.',
    },
    {
      href: '/messages',
      title: 'Messages',
      text: 'Chat with workers about applications.',
    },
  ]

  const cards = role === 'company' ? companyCards : workerCards

  if (loading) {
    return <div style={{ padding: '24px' }}>Loading dashboard...</div>
  }

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>CrewCall Dashboard</h1>
      <p style={{ marginBottom: '24px', color: '#555' }}>
        Welcome to CrewCall. Choose what you want to do.
      </p>

      <div style={{ display: 'grid', gap: '16px' }}>
        {cards.map((card) => (
          <Link key={card.href} href={card.href} style={cardStyle}>
            <h2 style={{ margin: '0 0 8px 0' }}>{card.title}</h2>
            <p style={{ margin: 0, color: '#666' }}>{card.text}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  display: 'block',
  border: '1px solid #ddd',
  borderRadius: '12px',
  padding: '20px',
  backgroundColor: '#fff',
  textDecoration: 'none',
  color: 'black',
}