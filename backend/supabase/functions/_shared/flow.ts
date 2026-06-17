// Flow.cl API helper — HMAC-SHA256 signed requests
// Docs: https://www.flow.cl/docs/api.html
//
// All params are signed: sort keys alphabetically, concatenate key+value (no separator),
// then HMAC-SHA256 with the secret key. Result goes in the `s` parameter.

function baseUrl(): string {
  return Deno.env.get('FLOW_SANDBOX') === 'true'
    ? 'https://sandbox.flow.cl/api'
    : 'https://www.flow.cl/api'
}

async function signParams(params: Record<string, string>, secretKey: string): Promise<string> {
  const message = Object.keys(params).sort().map(k => k + params[k]).join('')
  const keyData = new TextEncoder().encode(secretKey)
  const msgData = new TextEncoder().encode(message)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
  return [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function flowPost<T>(
  path: string,
  params: Record<string, string>,
  apiKey: string,
  secretKey: string
): Promise<T> {
  const withKey = { ...params, apiKey }
  const s = await signParams(withKey, secretKey)
  const body = new URLSearchParams({ ...withKey, s })

  const res = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })

  const json = await res.json()
  if (!res.ok) {
    const msg = (json as { message?: string }).message ?? `Flow error ${res.status}`
    throw new Error(msg)
  }
  return json as T
}

export async function flowGet<T>(
  path: string,
  params: Record<string, string>,
  apiKey: string,
  secretKey: string
): Promise<T> {
  const withKey = { ...params, apiKey }
  const s = await signParams(withKey, secretKey)
  const qs = new URLSearchParams({ ...withKey, s })

  const res = await fetch(`${baseUrl()}${path}?${qs}`)
  const json = await res.json()
  if (!res.ok) {
    const msg = (json as { message?: string }).message ?? `Flow error ${res.status}`
    throw new Error(msg)
  }
  return json as T
}
