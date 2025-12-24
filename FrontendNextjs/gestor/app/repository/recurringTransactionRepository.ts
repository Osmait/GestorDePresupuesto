import { BaseRepository } from "@/lib/base-repository";
import { RecurringTransaction, RecurringTransactionRequest } from "@/types/recurringTransaction";

export class RecurringTransactionRepository extends BaseRepository {
    async findAll(): Promise<RecurringTransaction[]> {
        try {
            const response = await this.get<RecurringTransaction[]>("/recurring-transactions");
            return response;
        } catch (error) {
            console.error("Error fetching recurring transactions:", error);
            return [];
        }
    }

    async create(data: RecurringTransactionRequest): Promise<void> {
        try {
            await this.post("/recurring-transactions", data);
        } catch (error) {
            console.error("Error creating recurring transaction:", error);
            throw error;
        }
    }

    async update(id: string, data: RecurringTransactionRequest): Promise<void> {
        try {
            await this.put(`/recurring-transactions/${id}`, data);
        } catch (error) {
            console.error("Error updating recurring transaction:", error);
            throw error;
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.deleteRequest(`/recurring-transactions/${id}`);
        } catch (error) {
            console.error("Error deleting recurring transaction:", error);
            throw error;
        }
    }

    async process(): Promise<void> {
        try {
            await this.post("/recurring-transactions/process", {});
        } catch (error) {
            console.error("Error processing recurring transactions:", error);
            throw error;
        }
    }
}
