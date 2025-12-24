import { Transaction } from "@/types/transaction";
import { Category } from "@/types/category";
import { Account } from "@/types/account";
import { Budget } from "@/types/budget";

export interface SearchResponse {
    transactions: Transaction[];
    categories: Category[];
    accounts: Account[];
    budgets: Budget[];
}
