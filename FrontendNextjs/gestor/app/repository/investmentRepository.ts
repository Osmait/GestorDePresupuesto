import { BaseRepository } from "@/lib/base-repository";
import { CreateInvestmentDTO, FundBrokerDTO, FundingBalance, Investment, InvestmentFilters, UpdateInvestmentDTO } from "@/types/investment";

export class InvestmentRepository extends BaseRepository {
    async findAll(filters?: InvestmentFilters): Promise<Investment[]> {
        const queryParams = new URLSearchParams();
        if (filters && filters.user_id) {
            queryParams.append("user_id", filters.user_id);
        }

        const response = await this.get<Investment[]>(`/investments${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
        return response;
    }

    async findById(id: string): Promise<Investment> {
        return this.get<Investment>(`/investments/${id}`);
    }

    async create(investment: CreateInvestmentDTO): Promise<void> {
        await this.post("/investments", investment);
    }

    async fundBroker(payload: FundBrokerDTO): Promise<void> {
        await this.post('/investments/funding', payload)
    }

    async getFundingBalances(): Promise<FundingBalance[]> {
        return this.get<FundingBalance[]>('/investments/funding/balances')
    }

    async update(investment: UpdateInvestmentDTO): Promise<void> {
        const { id, ...body } = investment;
        await this.put(`/investments/${id}`, body);
    }

    async delete(id: string): Promise<void> {
        await this.deleteRequest(`/investments/${id}`);
    }

    async getQuote(symbol: string): Promise<{ regular_market_price: number; symbol: string; name?: string }> {
        return this.get<{ regular_market_price: number; symbol: string; name?: string }>(`/quotes/${symbol}`);
    }
}
