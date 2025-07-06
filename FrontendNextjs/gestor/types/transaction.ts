export enum TypeTransaction {
  BILL,
  INCOME,
}
export interface Transaction {
  id: string;
  name: string;
  description: string;
  amount: number;
  type_transaction: TypeTransaction;
  account_id: string;
  category_id: string;
  budget_id?: string;
  created_at: string;
}
