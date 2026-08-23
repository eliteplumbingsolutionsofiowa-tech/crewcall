import {
  PushNotifications,
  Token,
  PermissionStatus,
} from '@capacitor/push-notifications'

import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabase'

export async function registerPushNotifications() {
  let permission: PermissionStatus =
    await PushNotifications.checkPermissions()

  if (permission.receive !== 'granted') {
    permission =
      await PushNotifications.requestPermissions()
  }

  if (permission.receive !== 'granted') {
    console.warn(
      'Push notification permission denied'
    )
    return null
  }

  await PushNotifications.register()

  return new Promise<string>((resolve, reject) => {
    PushNotifications.addListener(
      'registration',
      async (token: Token) => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (!user) {
            throw new Error(
              'Cannot save push token without a logged-in user.'
            )
          }

          const platform =
            Capacitor.getPlatform()

          const { error } = await supabase
            .from('device_tokens')
            .upsert(
              {
                user_id: user.id,
                token: token.value,
                platform,
                device_name: null,
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: 'token',
              }
            )

          if (error) {
            throw error
          }

          console.log(
            'Push token registered:',
            platform
          )

          resolve(token.value)
        } catch (error) {
          console.error(
            'Unable to save push token:',
            error
          )

          reject(error)
        }
      }
    )

    PushNotifications.addListener(
      'registrationError',
      (error) => {
        console.error(error)
        reject(error)
      }
    )
  })
}
