import { BaseRepository } from "@/lib/base-repository";
import { SearchResponse } from "@/types/search";

export class SearchRepository extends BaseRepository {
    async search(query: string): Promise<SearchResponse> {
        try {
            if (!query.trim()) {
                return { transactions: [], categories: [], accounts: [], budgets: [] };
            }
            const data = await this.get<SearchResponse>(`/search?q=${encodeURIComponent(query)}`);
            return data;
        } catch (error) {
            console.error("Error searching:", error);
            return { transactions: [], categories: [], accounts: [], budgets: [] };
        }
    }
}
