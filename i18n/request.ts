import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()

  const savedLocale =
    cookieStore.get('CREWCALL_LOCALE')?.value

  const locale =
    savedLocale === 'es' ? 'es' : 'en'

  return {
    locale,
    messages: (
      await import(`../messages/${locale}.json`)
    ).default,
  }
})
