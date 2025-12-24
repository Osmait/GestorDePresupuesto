export interface Account {
  id: string;
  name: string;
  bank: string;
  initial_balance: number;
  current_balance?: number; // Balance actual calculado por el backend
  user_id: string;
  created_at: string;
}
