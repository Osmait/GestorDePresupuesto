export enum TypeTransaction {
  BILL = "bill",
  INCOME = "income",
}

export interface Transaction {
  id: string;
  name: string;
  description: string;
  amount: number;
  type_transation: TypeTransaction;
  account_id: string;
  category_id: string;
  budget_id?: string;
  created_at: string;
}

export interface PaginationMeta {
  current_page: number;
  has_next_page: boolean;
  has_prev_page: boolean;
  next_page: number;
  per_page: number;
  prev_page: number;
  total_pages: number;
  total_records: number;
}

export interface PaginatedTransactionResponse {
  data: Transaction[];
  pagination: PaginationMeta;
}

export interface TransactionFilters {
  page?: number;
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'amount' | 'name' | 'type_transation';
  sort_order?: 'asc' | 'desc';
  type?: 'income' | 'bill' | 'all';
  category_id?: string;
  categories?: string;
  account_id?: string;
  budget_id?: string;
  date_from?: string;
  date_to?: string;
  period?: 'today' | 'this_week' | 'this_month' | 'this_year' | 'last_week' | 'last_month' | 'last_year';
  amount_min?: number;
  amount_max?: number;
  search?: string;
  include_summary?: boolean;
}
