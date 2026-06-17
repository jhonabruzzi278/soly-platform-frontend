// Flow.cl REST API client
// OpenAPI spec: https://developers.flow.cl/es-openApiFlow.yaml (saved in backend/docs/flow-openapi.yaml)
//
// Authentication: all params signed with HMAC-SHA256 using secretKey.
// Params sorted alphabetically, concatenated as key+value (no separator), then HMAC-SHA256.
// Signature goes in the `s` parameter.
//
// Base URLs:
//   Production: https://www.flow.cl/api
//   Sandbox:    https://sandbox.flow.cl/api

// ─── Response Types (from OpenAPI spec) ──────────────────────────────────────

export type FlowError = {
  code: string
  message: string
}

/** Returned by /payment/create and /payment/createEmail */
export type FlowPayResponse = {
  url: string
  token: string
  flowOrder: number
}

/**
 * Returned by /payment/getStatus, /payment/getStatusByCommerceId, /payment/getStatusByFlowOrder
 * status: 1=pending, 2=paid, 3=rejected, 4=cancelled
 */
export type FlowPaymentStatus = {
  flowOrder: number
  commerceOrder: string
  requestDate: string
  status: 1 | 2 | 3 | 4
  subject: string
  currency: string
  amount: number
  payer: string
  optional: Record<string, string> | null
  pending_info: { media: string | null; date: string | null }
  paymentData: {
    date: string | null
    media: string | null
    conversionDate: string | null
    conversionRate: number | null
    amount: number | null
    currency: string | null
    fee: number | null
    balance: number | null
    transferDate: string | null
  } | null
  merchantId: string | null
}

/** Extended payment status — includes card info and last error */
export type FlowPaymentStatusExtended = FlowPaymentStatus & {
  paymentData: (FlowPaymentStatus['paymentData'] & {
    mediaType: string | null
    cardLast4Numbers: string | null
    cardNumber: string | null
    taxes: number | null
    installments: number | null
    autorizationCode: string | null
  }) | null
  lastError: {
    code: string | null
    message: string | null
    medioCode: string | null
  } | null
}

/**
 * Returned by /customer/create, /customer/edit, /customer/get
 * pay_mode: 'auto' (automatic charge) | 'manual' (manual payment link)
 * status: '0'=deleted, '1'=active
 */
export type FlowCustomer = {
  customerId: string
  created: string
  email: string
  name: string
  pay_mode: 'auto' | 'manual'
  creditCardType: string | null
  last4CardDigits: string | null
  externalId: string | null
  status: '0' | '1'
  registerDate: string | null
}

/** Returned by /customer/register — redirect user to url+"?token="+token */
export type FlowRegisterResponse = {
  url: string
  token: string
}

/** Returned by /customer/getRegisterStatus */
export type FlowRegisterStatus = {
  status: '1' | '0'
  customerId: string
  creditCardType: string
  last4CardDigits: string
  cardNumber: string | null
  issuerBank: string | null
}

/**
 * Returned by /subscription/create, /subscription/get, /subscription/cancel, etc.
 * status: 0=inactive, 1=active, 2=trialing, 4=cancelled
 */
export type FlowSubscription = {
  subscriptionId: string
  planId: string
  plan_name: string
  customerId: string
  created: string
  subscription_start: string
  subscription_end: string | null
  period_start: string
  period_end: string
  next_invoice_date: string
  trial_period_days: number
  trial_start: string | null
  trial_end: string | null
  cancel_at_period_end: 0 | 1
  cancel_at: string | null
  periods_number: number | null
  days_until_due: number
  status: 0 | 1 | 2 | 4
  discount_balance: string | null
  morose: 0 | 1 | 2
}

/**
 * Returned by /plans/create, /plans/get, /plans/edit
 * interval: 1=month, 2=year
 * status: 1=active, 0=deleted
 */
export type FlowPlan = {
  planId: string
  name: string
  amount: number
  currency: string
  interval: 1 | 2
  interval_count: number
  trial_period_days: number
  days_until_due: number
  status: 0 | 1
  created: string
}

/**
 * Returned by /refund/create, /refund/getStatus, /refund/cancel
 * status: created | accepted | rejected | refunded | canceled
 */
export type FlowRefundStatus = {
  token: string
  flowRefundOrder: string
  date: string
  status: 'created' | 'accepted' | 'rejected' | 'refunded' | 'canceled'
  amount: number
  fee: number
}

/** Generic paginated list response */
export type FlowList<T> = {
  total: number
  hasMore: 0 | 1
  data: T[]
}

/** /customer/collect response */
export type FlowCollectResponse = {
  type: 1 | 2 | 3
  commerceOrder: string
  flowOrder: number
  url: string | null
  token: string | null
  status: 0 | 1
  paymentResult: FlowPaymentStatus | null
}

// ─── Client ──────────────────────────────────────────────────────────────────

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

function extractFlowError(json: unknown, status: number): string {
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.code === 'string' && typeof obj.message === 'string') {
      return `[${obj.code}] ${obj.message}`
    }
  }
  return `Flow error ${status}`
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
    body: body.toString(),
  })

  const json = await res.json()
  if (!res.ok) throw new Error(extractFlowError(json, res.status))
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
  if (!res.ok) throw new Error(extractFlowError(json, res.status))
  return json as T
}
