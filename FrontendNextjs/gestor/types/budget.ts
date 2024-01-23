export interface Budget {
  id: string;
  category_id: string;
  user_id: string;
  amount: number;
  current_amount: number;
  created_at: Date;
}
