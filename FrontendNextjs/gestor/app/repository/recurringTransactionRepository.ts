import { BaseRepository } from "@/lib/base-repository";
import { RecurringTransaction, RecurringTransactionRequest } from "@/types/recurringTransaction";

export class RecurringTransactionRepository extends BaseRepository {
    async findAll(): Promise<RecurringTransaction[]> {
        const response = await this.get<RecurringTransaction[]>("/recurring-transactions");
        return response;
    }

    async create(data: RecurringTransactionRequest): Promise<void> {
        await this.post("/recurring-transactions", data);
    }

    async update(id: string, data: RecurringTransactionRequest): Promise<void> {
        await this.put(`/recurring-transactions/${id}`, data);
    }

    async delete(id: string): Promise<void> {
        await this.deleteRequest(`/recurring-transactions/${id}`);
    }

    async process(): Promise<void> {
        await this.post("/recurring-transactions/process", {});
    }
}
