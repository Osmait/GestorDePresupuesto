export type AccountType = 'bank' | 'credit_card'

export interface Account {
  id: string;
  name: string;
  bank: string;
  initial_balance: number;
  current_balance?: number;
  user_id: string;
  type?: AccountType;
  currency?: string;
  created_at: string;
}
