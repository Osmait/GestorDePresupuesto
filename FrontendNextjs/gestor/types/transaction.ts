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
