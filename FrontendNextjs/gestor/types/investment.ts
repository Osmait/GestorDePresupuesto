export enum InvestmentType {
    STOCK = "stock",
    CRYPTO = "crypto",
    FIXED_INCOME = "fixed_income",
}

export interface Investment {
    id: string;
    name: string;
    symbol: string;
    type: InvestmentType;
    quantity: number;
    purchase_price: number;
    current_price: number;
    source_account_id?: string;
    source_amount?: number;
    settlement_currency?: string;
    exchange_rate?: number;
    created_at: string;
    updated_at?: string;
    user_id: string;
}

export interface InvestmentFilters {
    user_id?: string;
    type?: InvestmentType | string;
}

export interface CreateInvestmentDTO {
    name: string;
    symbol: string;
    type: InvestmentType;
    quantity: number;
    purchase_price: number;
    current_price: number;
    settlement_currency?: string;
}

export interface FundingBalance {
    currency: string;
    available: number;
}

export interface FundBrokerDTO {
    source_account_id: string;
    source_amount: number;
    target_currency: string;
    exchange_rate?: number;
    fee_amount?: number;
    notes?: string;
}

export interface UpdateInvestmentDTO extends Partial<CreateInvestmentDTO> {
    id: string;
}
