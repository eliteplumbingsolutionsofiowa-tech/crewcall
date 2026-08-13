import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const users = [
  {
    email: 'crewcall.company.test@gmail.com',
    password: 'Companytest123'
  },
  {
    email: 'crewcall.worker.test@gmail.com',
    password: 'Workertest123'
  }
]

for (const user of users) {
  const { data, error } = await supabase.auth.admin.listUsers()

  if (error) throw error

  const found = data.users.find(
    (u) => u.email === user.email
  )

  if (!found) {
    console.log('Missing:', user.email)
    continue
  }

  const { error: updateError } =
    await supabase.auth.admin.updateUserById(
      found.id,
      {
        password: user.password
      }
    )

  if (updateError) {
    console.log('FAILED', user.email, updateError.message)
  } else {
    console.log('UPDATED', user.email)
  }
}
