export interface RecurringTransaction {
    id: string;
    user_id: string;
    name: string;
    description: string;
    amount: number;
    type: 'income' | 'bill';
    account_id: string;
    category_id: string;
    budget_id?: string;
    day_of_month: number;
    last_execution_date?: string;
    created_at: string;
}

export interface RecurringTransactionRequest {
    name: string;
    description: string;
    amount: number;
    type: 'income' | 'bill';
    account_id: string;
    category_id: string;
    budget_id?: string;
    day_of_month: number;
}
