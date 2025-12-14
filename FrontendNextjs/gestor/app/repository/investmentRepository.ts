import { BaseRepository } from "@/lib/base-repository";
import { CreateInvestmentDTO, Investment, InvestmentFilters, UpdateInvestmentDTO } from "@/types/investment";

export class InvestmentRepository extends BaseRepository {
    async findAll(filters?: InvestmentFilters): Promise<Investment[]> {
        try {
            const queryParams = new URLSearchParams();
            if (filters && filters.user_id) {
                queryParams.append("user_id", filters.user_id);
            }

            const response = await this.get<Investment[]>(`/investments${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
            return response;
        } catch (error) {
            console.error("Error fetching investments:", error);
            return [];
        }
    }

    async findById(id: string): Promise<Investment | null> {
        try {
            return await this.get<Investment>(`/investments/${id}`);
        } catch (error) {
            console.error("Error fetching investment by id:", error);
            return null;
        }
    }

    async create(investment: CreateInvestmentDTO): Promise<void> {
        try {
            await this.post("/investments", investment);
        } catch (error) {
            console.error("Error creating investment:", error);
            throw error;
        }
    }

    async update(investment: UpdateInvestmentDTO): Promise<void> {
        try {
            const { id, ...body } = investment;
            await this.put(`/investments/${id}`, body);
        } catch (error) {
            console.error("Error updating investment:", error);
            throw error;
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.deleteRequest(`/investments/${id}`);
        } catch (error) {
            console.error("Error deleting investment:", error);
            throw error;
        }
    }
}
