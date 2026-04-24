import { supabase } from '@/lib/supabase'

export async function setOnline(userId: string) {
  await supabase.from('user_presence').upsert({
    user_id: userId,
    is_online: true,
    last_seen: new Date().toISOString(),
  })
}

export async function setOffline(userId: string) {
  await supabase.from('user_presence').upsert({
    user_id: userId,
    is_online: false,
    last_seen: new Date().toISOString(),
  })
}