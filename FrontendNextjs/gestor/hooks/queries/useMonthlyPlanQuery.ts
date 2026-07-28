import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MonthlyPlanRepository } from '@/app/repository/monthlyPlanRepository'
import { MonthlyPlanItemRequest } from '@/types/monthlyPlan'

const monthlyPlanRepo = new MonthlyPlanRepository()

export const MONTHLY_PLAN_KEYS = {
	all: ['monthly-plan'] as const,
	items: () => [...MONTHLY_PLAN_KEYS.all, 'items'] as const,
	summary: () => [...MONTHLY_PLAN_KEYS.all, 'summary'] as const,
}

export function useMonthlyPlanItems() {
	return useQuery({
		queryKey: MONTHLY_PLAN_KEYS.items(),
		queryFn: () => monthlyPlanRepo.findAll(),
		staleTime: 5 * 60 * 1000,
	})
}

export function useMonthlyPlanSummary() {
	return useQuery({
		queryKey: MONTHLY_PLAN_KEYS.summary(),
		queryFn: () => monthlyPlanRepo.getSummary(),
		staleTime: 5 * 60 * 1000,
	})
}

/**
 * Any write changes the totals as well as the list, so both queries are
 * invalidated together.
 */
function useInvalidatePlan() {
	const queryClient = useQueryClient()
	return () => queryClient.invalidateQueries({ queryKey: MONTHLY_PLAN_KEYS.all })
}

export function useCreateMonthlyPlanItem() {
	const invalidate = useInvalidatePlan()
	return useMutation({
		mutationFn: (data: MonthlyPlanItemRequest) => monthlyPlanRepo.create(data),
		onSuccess: invalidate,
	})
}

export function useUpdateMonthlyPlanItem() {
	const invalidate = useInvalidatePlan()
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: MonthlyPlanItemRequest }) => monthlyPlanRepo.update(id, data),
		onSuccess: invalidate,
	})
}

export function useToggleMonthlyPlanItem() {
	const invalidate = useInvalidatePlan()
	return useMutation({
		mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => monthlyPlanRepo.setActive(id, isActive),
		onSuccess: invalidate,
	})
}

export function useDeleteMonthlyPlanItem() {
	const invalidate = useInvalidatePlan()
	return useMutation({
		mutationFn: (id: string) => monthlyPlanRepo.delete(id),
		onSuccess: invalidate,
	})
}
