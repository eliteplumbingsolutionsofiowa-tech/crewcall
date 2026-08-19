import { Capacitor } from '@capacitor/core'

export function isNativeIOS() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
}

export function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export function isNativeApp() {
  return Capacitor.isNativePlatform()
}
