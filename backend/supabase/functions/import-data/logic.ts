export const VALID_TABLES = ['customers', 'appointments', 'services', 'inventory_products'] as const
export type TableName = typeof VALID_TABLES[number]

export const ALLOWED_COLUMNS: Record<TableName, string[]> = {
  customers: ['name', 'email', 'email_alt', 'phone', 'phone_alt_1', 'phone_alt_2', 'company', 'address', 'notes', 'tags'],
  appointments: ['customer_name', 'appointment_date', 'appointment_time', 'service_name', 'cost', 'status', 'comments', 'address', 'city', 'staff_name'],
  services: ['name', 'price'],
  inventory_products: ['name', 'supplier', 'cost', 'sale_price', 'stock', 'min_stock', 'purchase_date'],
}

export const ALIASES: Record<TableName, Record<string, string[]>> = {
  customers: {
    name: ['name', 'nombre', 'cliente', 'nombre_cliente', 'nombre_completo', 'full_name', 'contacto', 'razon_social'],
    email: ['email', 'correo', 'correo_electronico', 'e_mail', 'mail', 'email_address'],
    phone: ['phone', 'telefono', 'fono', 'celular', 'movil', 'tel', 'whatsapp', 'telefono_celular', 'numero_telefono', 'numero'],
    company: ['company', 'empresa', 'negocio', 'compania', 'organizacion'],
    address: ['address', 'direccion', 'domicilio'],
    notes: ['notes', 'notas', 'observaciones', 'comentarios', 'nota', 'detalle'],
    tags: ['tags', 'etiquetas', 'categorias', 'segmento'],
  },
  appointments: {
    customer_name: ['customer_name', 'cliente', 'customer', 'nombre_cliente', 'nombre', 'paciente'],
    appointment_date: ['appointment_date', 'fecha', 'dia', 'date', 'fecha_cita', 'fecha_de_cita'],
    appointment_time: ['appointment_time', 'hora', 'time', 'horario', 'hora_cita'],
    service_name: ['service_name', 'servicio', 'service', 'tratamiento', 'prestacion', 'nombre_servicio'],
    cost: ['cost', 'costo', 'precio', 'valor', 'monto', 'total', 'importe'],
    status: ['status', 'estado', 'situacion'],
    staff_name: ['staff_name', 'staff', 'barbero', 'profesional', 'atendido_por', 'empleado', 'estilista', 'especialista'],
    comments: ['comments', 'comentarios', 'observaciones', 'notas', 'nota', 'detalle'],
    address: ['address', 'direccion'],
    city: ['city', 'ciudad', 'comuna'],
  },
  services: {
    name: ['name', 'nombre', 'servicio', 'nombre_servicio', 'tratamiento', 'prestacion'],
    price: ['price', 'precio', 'valor', 'monto', 'tarifa', 'costo'],
  },
  inventory_products: {
    name: ['name', 'nombre', 'producto', 'articulo', 'item', 'descripcion'],
    supplier: ['supplier', 'proveedor', 'marca'],
    cost: ['cost', 'costo', 'costo_unitario', 'precio_compra', 'precio_de_compra'],
    sale_price: ['sale_price', 'precio_venta', 'precio_de_venta', 'pvp', 'precio'],
    stock: ['stock', 'cantidad', 'existencias', 'inventario', 'unidades'],
    min_stock: ['min_stock', 'stock_minimo', 'minimo'],
    purchase_date: ['purchase_date', 'fecha_compra', 'fecha_de_compra'],
  },
}

export const STATUS_MAP: Record<string, string> = {
  pending: 'pending', pendiente: 'pending', agendada: 'pending', agendado: 'pending', reservada: 'pending',
  confirmed: 'confirmed', confirmada: 'confirmed', confirmado: 'confirmed',
  cancelled: 'cancelled', canceled: 'cancelled', cancelada: 'cancelled', cancelado: 'cancelled', anulada: 'cancelled',
  completed: 'completed', completada: 'completed', completado: 'completed', realizada: 'completed', realizado: 'completed', finalizada: 'completed', hecha: 'completed', atendida: 'completed', pagada: 'completed', pagado: 'completed',
  no_show: 'no_show', no_asistio: 'no_show', ausente: 'no_show', inasistencia: 'no_show',
}

export const NUMERIC_COLUMNS = new Set(['price', 'cost', 'sale_price', 'stock', 'min_stock'])
export const INT_COLUMNS = new Set(['stock', 'min_stock'])
export const DATE_COLUMNS = new Set(['appointment_date', 'purchase_date'])
export const TIME_COLUMNS = new Set(['appointment_time'])
export const EMAIL_COLUMNS = new Set(['email', 'email_alt'])
export const PHONE_COLUMNS = new Set(['phone', 'phone_alt_1', 'phone_alt_2'])

export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)
}

export function normalizePhone(raw: string): string {
  const trimmed = raw.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (!digits || digits.length < 7) return trimmed.slice(0, 50)

  let local = digits
  // Strip international prefix: +56 or 0056 → keep local part
  if (local.startsWith('56') && local.length >= 10) local = local.slice(2)
  // Strip leading 0 (some formats: 09XXXXXXXX)
  if (local.startsWith('0') && local.length >= 9) local = local.slice(1)
  // Chilean local: 8 or 9 digits. Mobile starts with 9 (8 digits after stripping 9 prefix → pad)
  if (local.length === 8 && !local.startsWith('2')) local = '9' + local

  if (local.length >= 8 && local.length <= 9) return `+56${local}`
  // Fallback: return cleaned original
  return trimmed.slice(0, 50)
}

export const normHeader = (s: string): string =>
  String(s).toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

// deno-lint-ignore no-control-regex
export const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g

export const cellToString = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString()
  return String(v).replace(CONTROL_CHARS, ' ').trim()
}

export const parseNumber = (raw: string): number | null => {
  let s = raw.replace(/[^\d.,-]/g, '')
  if (!s) return null
  const hasDot = s.includes('.'), hasComma = s.includes(',')
  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (hasComma) {
    const parts = s.split(',')
    s = (parts.length === 2 && parts[1].length <= 2) ? s.replace(',', '.') : s.replace(/,/g, '')
  } else if (hasDot) {
    const parts = s.split('.')
    if (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3) s = s.replace(/\./g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export const toIsoDate = (v: unknown): string | null => {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  const s = cellToString(v)
  if (!s) return null
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (m) {
    let d = +m[1], mo = +m[2]
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${m[3]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return null
}

export const toTime = (v: unknown): string | null => {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${String(v.getUTCHours()).padStart(2, '0')}:${String(v.getUTCMinutes()).padStart(2, '0')}`
  }
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const mins = Math.round(v * 24 * 60)
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
  }
  const s = cellToString(v)
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (m) {
    const h = +m[1]
    if (h >= 0 && h <= 23) return `${String(h).padStart(2, '0')}:${m[2]}`
  }
  return null
}

export type Mapping = Record<string, string>

export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) {
    if (obj[key] === undefined) delete obj[key]
  }
  return obj
}

export function coerceRow(
  table: TableName,
  mapping: Mapping,
  headers: string[],
  rowArr: unknown[],
  rowIndex: number,
  errors: string[],
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {}
  let hasValue = false

  for (let i = 0; i < headers.length; i++) {
    const target = mapping[headers[i]]
    if (!target) continue
    const rawVal = rowArr[i]
    const str = cellToString(rawVal)
    if (!str) continue
    hasValue = true

    if (NUMERIC_COLUMNS.has(target)) {
      const n = parseNumber(str)
      if (n === null) { errors.push(`Fila ${rowIndex}: "${str.slice(0, 30)}" no es un numero valido para ${target}`); return null }
      out[target] = INT_COLUMNS.has(target) ? Math.max(0, Math.round(n)) : Math.max(0, n)
    } else if (DATE_COLUMNS.has(target)) {
      const d = toIsoDate(rawVal)
      if (!d) { errors.push(`Fila ${rowIndex}: fecha no reconocida "${str.slice(0, 30)}"`); return null }
      out[target] = d
    } else if (TIME_COLUMNS.has(target)) {
      const t = toTime(rawVal)
      if (!t) { errors.push(`Fila ${rowIndex}: hora no reconocida "${str.slice(0, 30)}"`); return null }
      out[target] = t
    } else if (EMAIL_COLUMNS.has(target)) {
      const lower = str.toLowerCase().trim()
      // Skip fields with invalid email format — keep the row but omit the bad value
      if (isValidEmail(lower)) out[target] = lower.slice(0, 255)
    } else if (PHONE_COLUMNS.has(target)) {
      out[target] = normalizePhone(str)
    } else if (target === 'status') {
      out[target] = STATUS_MAP[normHeader(str)] ?? 'completed'
    } else if (target === 'tags') {
      out[target] = str.split(/[;,|]/).map((t) => t.trim()).filter(Boolean).slice(0, 20)
    } else {
      out[target] = str.slice(0, 2000)
    }
  }

  if (!hasValue) return null

  if (table === 'customers' && !out.name) { errors.push(`Fila ${rowIndex}: falta el nombre del cliente`); return null }
  if (table === 'services' && !out.name) { errors.push(`Fila ${rowIndex}: falta el nombre del servicio`); return null }
  if (table === 'inventory_products' && !out.name) { errors.push(`Fila ${rowIndex}: falta el nombre del producto`); return null }
  if (table === 'appointments') {
    if (!out.customer_name) { errors.push(`Fila ${rowIndex}: falta el cliente de la cita`); return null }
    if (!out.appointment_date) { errors.push(`Fila ${rowIndex}: falta la fecha de la cita`); return null }
    if (!out.appointment_time) out.appointment_time = '12:00'
    if (!out.service_name) out.service_name = 'Servicio importado'
    if (out.cost === undefined) out.cost = 0
    if (!out.status) out.status = 'completed'
  }
  if (table === 'services' && out.price === undefined) out.price = 0
  return out
}
