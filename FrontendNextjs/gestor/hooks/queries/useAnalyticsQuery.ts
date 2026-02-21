import { useQuery } from '@tanstack/react-query'
import { getAnalyticsRepository } from '@/lib/repositoryConfig'
import { AnalyticsQueryFilters } from '@/types/analytics'

export const ANALYTICS_KEYS = {
    all: ['analytics'] as const,
    categoryExpenses: () => [...ANALYTICS_KEYS.all, 'categoryExpenses'] as const,
    monthlySummary: () => [...ANALYTICS_KEYS.all, 'monthlySummary'] as const,
    dashboardSummary: (filters?: AnalyticsQueryFilters) => [...ANALYTICS_KEYS.all, 'dashboardSummary', filters ?? {}] as const,
}

export function useGetCategoryExpenses() {
    return useQuery({
        queryKey: ANALYTICS_KEYS.categoryExpenses(),
        queryFn: async () => {
            const repo = await getAnalyticsRepository()
            return repo.getCategoryExpenses()
        },
    })
}

export function useGetMonthlySummary() {
    return useQuery({
        queryKey: ANALYTICS_KEYS.monthlySummary(),
        queryFn: async () => {
            const repo = await getAnalyticsRepository()
            return repo.getMonthlySummary()
        },
    })
}

export function useGetDashboardSummary(filters?: AnalyticsQueryFilters) {
    return useQuery({
        queryKey: ANALYTICS_KEYS.dashboardSummary(filters),
        queryFn: async () => {
            const repo = await getAnalyticsRepository()
            return repo.getDashboardSummary(filters)
        },
    })
}
