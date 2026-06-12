import { describe, expect, it } from 'vitest'

import { coerceRow, parseNumber, toIsoDate, toTime } from '../../../../backend/supabase/functions/import-data/logic'

describe('import-data helpers', () => {
  it('parses Chilean and US number formats correctly', () => {
    expect(parseNumber('1.234,56')).toBe(1234.56)
    expect(parseNumber('1,234.56')).toBe(1234.56)
    expect(parseNumber('12')).toBe(12)
  })

  it('normalizes dates in common formats', () => {
    expect(toIsoDate('12/06/2026')).toBe('2026-06-12')
    expect(toIsoDate('2026-06-12')).toBe('2026-06-12')
    expect(toIsoDate('')).toBeNull()
  })

  it('normalizes time values', () => {
    expect(toTime('14:30')).toBe('14:30')
    expect(toTime(0.625)).toBe('15:00')
  })

  it('coerces a valid appointment row and rejects invalid numeric values', () => {
    const errors: string[] = []
    const row = coerceRow(
      'appointments',
      {
        cliente: 'customer_name',
        fecha: 'appointment_date',
        hora: 'appointment_time',
        servicio: 'service_name',
        precio: 'cost',
        estado: 'status',
      },
      ['cliente', 'fecha', 'hora', 'servicio', 'precio', 'estado'],
      ['Juan Perez', '12/06/2026', '14:30', 'Corte', '25000', 'confirmada'],
      2,
      errors,
    )

    expect(errors).toEqual([])
    expect(row).toEqual({
      customer_name: 'Juan Perez',
      appointment_date: '2026-06-12',
      appointment_time: '14:30',
      service_name: 'Corte',
      cost: 25000,
      status: 'confirmed',
    })

    const bad = coerceRow(
      'appointments',
      { cliente: 'customer_name', fecha: 'appointment_date', precio: 'cost' },
      ['cliente', 'fecha', 'precio'],
      ['Juan Perez', '12/06/2026', 'abc'],
      3,
      errors,
    )

    expect(bad).toBeNull()
    expect(errors.some((m) => m.includes('no es un numero valido'))).toBe(true)
  })
})
