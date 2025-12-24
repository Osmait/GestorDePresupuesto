import { useQuery } from '@tanstack/react-query';
import { getSearchRepository } from '@/lib/repositoryConfig';
import { SearchResponse } from '@/types/search';

export const SEARCH_KEYS = {
    all: ['search'] as const,
    query: (q: string) => [...SEARCH_KEYS.all, q] as const,
};

export function useSearchQuery(query: string) {
    return useQuery({
        queryKey: SEARCH_KEYS.query(query),
        queryFn: async () => {
            const repo = await getSearchRepository();
            return repo.search(query);
        },
        enabled: query.length > 0,
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });
}
