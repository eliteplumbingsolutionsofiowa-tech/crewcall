import {
  PushNotifications,
  Token,
  PermissionStatus,
} from '@capacitor/push-notifications'

export async function registerPushNotifications() {
  let permission: PermissionStatus =
    await PushNotifications.checkPermissions()

  if (permission.receive !== 'granted') {
    permission =
      await PushNotifications.requestPermissions()
  }

  if (permission.receive !== 'granted') {
    console.warn('Push notification permission denied')
    return null
  }

  await PushNotifications.register()

  return new Promise<string>((resolve, reject) => {
    PushNotifications.addListener(
      'registration',
      (token: Token) => {
        console.log('FCM Token:', token.value)
        resolve(token.value)
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
