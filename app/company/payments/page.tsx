'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { resolveCompanyContext } from '@/lib/company-context'

type PaymentRow = {
  id: string
  title: string | null
  pay_rate: string | null
  worker_payout_cents: number | null
  platform_fee_cents: number | null
  payout_status: string | null
  payout_released_at: string | null
  stripe_transfer_id: string | null
}


function PaymentSection({
  title,
  payments,
}: {
  title: string
  payments: PaymentRow[]
}) {
  const t = useTranslations('CompanyPayments')
  const locale = useLocale()

  return (
    <section className="mt-8 space-y-5">
      <h2 className="text-2xl font-black">
        {title}
      </h2>

      {payments.length === 0 ? (
        <div className="rounded-xl bg-white/10 p-6">
          {t('none')}
        </div>
      ) : (
        payments.map((payment) => (
          <div
            key={payment.id}
            className="rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <h3 className="text-2xl font-black">
              {payment.title || t('crewCallJob')}
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-slate-400">
                  {t('workerPaid')}
                </p>
                <p className="font-bold">
                  ${((payment.worker_payout_cents || 0) / 100).toFixed(2)}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-400">
                  {t('status')}
                </p>
                <p className="font-bold">
                  {payment.payout_status === 'released'
                    ? t('releasedStatus')
                    : t('pendingStatus')}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-400">
                  {t('released')}
                </p>
                <p className="font-bold">
                  {payment.payout_released_at
                    ? new Date(payment.payout_released_at).toLocaleDateString(locale)
                    : '-'}
                </p>
              </div>
            </div>

            {payment.stripe_transfer_id && (
              <p className="mt-4 text-xs text-slate-400 break-all">
                {t('stripeTransfer')}: {payment.stripe_transfer_id}
              </p>
            )}
          </div>
        ))
      )}
    </section>
  )
}

export default function CompanyPaymentsPage() {

  const t = useTranslations('CompanyPayments')
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPayments() {
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const companyContext =
        await resolveCompanyContext(
          supabase,
          user.id
        )

      if (!companyContext.companyId) {
        setPayments([])
        setLoading(false)
        return
      }

      const companyId =
        companyContext.companyId

      const { data, error } = await supabase
        .from('jobs')
        .select(
          `
          id,
          title,
          pay_rate,
          worker_payout_cents,
          platform_fee_cents,
          payout_status,
          payout_released_at,
          stripe_transfer_id
          `
        )
        .eq('company_id', companyId)
        .eq('payment_status', 'paid')
        .order('payout_released_at', {
          ascending: false,
        })

      if (error) {
        console.error('Company payments error:', error.message)
        setPayments([])
        setLoading(false)
        return
      }

      setPayments((data || []) as PaymentRow[])
      setLoading(false)
    }

    loadPayments()
  }, [])

  const totalSpent = payments.reduce(
    (sum, item) => {
      const amount = Number(
        String(item.pay_rate || '0')
          .replace(/[^0-9.]/g, '')
      )

      return sum + (Number.isNaN(amount) ? 0 : amount)
    },
    0
  )

  const totalFees = payments.reduce(
    (sum, item) =>
      sum + (item.platform_fee_cents || 0),
    0
  )

  const releasedPayments = payments.filter(
    (payment) =>
      payment.payout_status === 'released'
  )

  const pendingPayments = payments.filter(
    (payment) =>
      payment.payout_status !== 'released'
  )

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">

      <div className="mx-auto max-w-6xl">

        <h1 className="text-4xl font-black">
          {t('paymentHistory')}
        </h1>

        <p className="mt-2 text-slate-300">
          {t('description')}
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">

          <div className="rounded-3xl bg-white/5 p-8 border border-white/10">
            <p className="text-sm text-slate-400">
              {t('totalPaid')}
            </p>
            <p className="mt-2 text-4xl font-black">
              ${totalSpent.toFixed(2)}
            </p>
          </div>

          <div className="rounded-3xl bg-white/5 p-8 border border-white/10">
            <p className="text-sm text-slate-400">
              {t('crewCallFees')}
            </p>
            <p className="mt-2 text-4xl font-black">
              ${(totalFees / 100).toFixed(2)}
            </p>
          </div>

        </div>


        <PaymentSection
          title={t('paymentHistory')}
          payments={releasedPayments}
        />

        <PaymentSection
          title={t('pendingPayments')}
          payments={pendingPayments}
        />


      </div>

    </main>
  )
}
