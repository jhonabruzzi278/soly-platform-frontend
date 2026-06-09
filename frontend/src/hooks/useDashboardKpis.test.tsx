import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDashboardKpis } from './useDashboardKpis'
import { fetchDashboardKpis } from '../lib/api'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { PropsWithChildren } from 'react'

vi.mock('../lib/api', () => ({
  fetchDashboardKpis: vi.fn()
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useDashboardKpis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch and return KPI data', async () => {
    const mockKpis = {
      appointments_today: 5,
      appointments_week: 20,
      appointments_month: 80,
      revenue_month: 150000,
      avg_ticket: 25000,
      occupancy: 75,
      new_customers: 10,
      recurring_customers: 15
    }

    vi.mocked(fetchDashboardKpis).mockResolvedValue(mockKpis)

    const { result } = renderHook(() => useDashboardKpis(), {
      wrapper: createWrapper()
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockKpis)
    expect(fetchDashboardKpis).toHaveBeenCalledTimes(1)
  })

  it('should handle errors', async () => {
    vi.mocked(fetchDashboardKpis).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useDashboardKpis(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toBe('Network error')
  })
})
