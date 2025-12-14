import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInvestmentRepository } from '@/lib/repositoryConfig';
import { CreateInvestmentDTO, InvestmentFilters, UpdateInvestmentDTO } from '@/types/investment';

export const INVESTMENT_KEYS = {
    all: ['investments'] as const,
    lists: () => [...INVESTMENT_KEYS.all, 'list'] as const,
    list: (filters: InvestmentFilters) => [...INVESTMENT_KEYS.lists(), filters] as const,
    details: () => [...INVESTMENT_KEYS.all, 'detail'] as const,
    detail: (id: string) => [...INVESTMENT_KEYS.details(), id] as const,
};

export function useGetInvestments(filters?: InvestmentFilters) {
    return useQuery({
        queryKey: INVESTMENT_KEYS.list(filters || {}),
        queryFn: async () => {
            const repo = await getInvestmentRepository();
            return repo.findAll(filters);
        },
    });
}

export function useCreateInvestmentMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateInvestmentDTO) => {
            const repo = await getInvestmentRepository();
            return repo.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: INVESTMENT_KEYS.lists() });
        },
    });
}

export function useUpdateInvestmentMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: UpdateInvestmentDTO) => {
            const repo = await getInvestmentRepository();
            return repo.update(data);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: INVESTMENT_KEYS.lists() });
            queryClient.invalidateQueries({ queryKey: INVESTMENT_KEYS.detail(variables.id) });
        },
    });
}

export function useDeleteInvestmentMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const repo = await getInvestmentRepository();
            return repo.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: INVESTMENT_KEYS.lists() });
        },
    });
}
