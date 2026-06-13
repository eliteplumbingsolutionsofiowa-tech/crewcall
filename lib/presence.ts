import { supabase } from '@/lib/supabase'

type PresenceUpsert = {
  user_id: string
  is_online: boolean
  last_seen: string
}

type QueryError = {
  message: string
}

type UpsertTable<TUpsert> = {
  upsert: (
    value: TUpsert,
    options: { onConflict: string }
  ) => Promise<{ data: null; error: QueryError | null }>
}

function userPresenceTable() {
  return supabase
    .from('user_presence') as unknown as UpsertTable<PresenceUpsert>
}

export async function setOnline(userId: string) {
  await userPresenceTable().upsert(
    {
      user_id: userId,
      is_online: true,
      last_seen: new Date().toISOString(),
    },
    {
      onConflict: 'user_id',
    }
  )
}

export async function setOffline(userId: string) {
  await userPresenceTable().upsert(
    {
      user_id: userId,
      is_online: false,
      last_seen: new Date().toISOString(),
    },
    {
      onConflict: 'user_id',
    }
  )
}