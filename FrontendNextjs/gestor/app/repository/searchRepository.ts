import { BaseRepository } from "@/lib/base-repository";
import { SearchResponse } from "@/types/search";

export class SearchRepository extends BaseRepository {
    async search(query: string): Promise<SearchResponse> {
        if (!query.trim()) {
            return { transactions: [], categories: [], accounts: [], budgets: [], loans: [], certificates: [] }
        }
        const data = await this.get<SearchResponse>(`/search?q=${encodeURIComponent(query)}`)
        return data
    }
}
