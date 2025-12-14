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
    created_at: string;
    updated_at?: string;
    user_id: string;
}

export interface InvestmentFilters {
    user_id?: string;
}

export interface CreateInvestmentDTO {
    name: string;
    symbol: string;
    type: InvestmentType;
    quantity: number;
    purchase_price: number;
    current_price: number;
}

export interface UpdateInvestmentDTO extends Partial<CreateInvestmentDTO> {
    id: string;
}
