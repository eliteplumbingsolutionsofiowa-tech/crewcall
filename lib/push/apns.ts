import http2 from 'node:http2'
import crypto from 'node:crypto'

type SendApnsPushInput = {
  deviceToken: string
  title: string
  body: string
  url?: string | null
  badge?: number
}

type ApnsResponse = {
  status: number
  body: string
}

function base64Url(value: Buffer | string) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function getApnsConfig() {
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  const bundleId = process.env.APNS_BUNDLE_ID
  const privateKeyRaw = process.env.APNS_PRIVATE_KEY
  const environment =
    process.env.APNS_ENVIRONMENT === 'production'
      ? 'production'
      : 'sandbox'

  if (
    !keyId ||
    !teamId ||
    !bundleId ||
    !privateKeyRaw
  ) {
    throw new Error(
      'Missing required APNs environment variables.'
    )
  }

  const privateKey = privateKeyRaw.replace(
    /\\n/g,
    '\n'
  )

  return {
    keyId,
    teamId,
    bundleId,
    privateKey,
    environment,
  }
}

function createApnsJwt() {
  const {
    keyId,
    teamId,
    privateKey,
  } = getApnsConfig()

  const header = base64Url(
    JSON.stringify({
      alg: 'ES256',
      kid: keyId,
    })
  )

  const payload = base64Url(
    JSON.stringify({
      iss: teamId,
      iat: Math.floor(Date.now() / 1000),
    })
  )

  const unsignedToken = `${header}.${payload}`

  const key = crypto.createPrivateKey(privateKey)

  const signature = crypto.sign(
    'sha256',
    Buffer.from(unsignedToken),
    {
      key,
      dsaEncoding: 'ieee-p1363',
    }
  )

  return `${unsignedToken}.${base64Url(signature)}`
}

export async function sendApnsPush({
  deviceToken,
  title,
  body,
  url = null,
  badge = 1,
}: SendApnsPushInput): Promise<ApnsResponse> {
  const {
    bundleId,
    environment,
  } = getApnsConfig()

  const host =
    environment === 'production'
      ? 'https://api.push.apple.com'
      : 'https://api.sandbox.push.apple.com'

  const jwt = createApnsJwt()

  const payload = JSON.stringify({
    aps: {
      alert: {
        title,
        body,
      },
      sound: 'default',
      badge,
    },
    ...(url ? { url } : {}),
  })

  return new Promise((resolve, reject) => {
    const client = http2.connect(host)

    client.once('error', (error) => {
      client.close()
      reject(error)
    })

    const request = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    })

    let responseBody = ''
    let responseStatus = 0

    request.setEncoding('utf8')

    request.on('response', (headers) => {
      responseStatus = Number(
        headers[':status'] || 0
      )
    })

    request.on('data', (chunk) => {
      responseBody += chunk
    })

    request.on('end', () => {
      client.close()

      resolve({
        status: responseStatus,
        body: responseBody,
      })
    })

    request.on('error', (error) => {
      client.close()
      reject(error)
    })

    request.end(payload)
  })
}
