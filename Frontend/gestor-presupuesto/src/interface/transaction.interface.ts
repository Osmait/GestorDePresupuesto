export interface Transactions {
  id?: string;
  name: string;
  description: string;
  amount: number;
  type_transation: string;
  account_id: string;
  created_at?: string;
}
export interface PostTransaction {
  name: string;
  description: string;
  amount: number;
  type_transation: string;
  account_id: string;
}
