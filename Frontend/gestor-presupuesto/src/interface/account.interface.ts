export interface AccoutInfoInterface {
  AccountInfo: AccountInterface;
  CurrentBalance: number;
}
export interface AccountInterface {
  id: string;
  name: string;
  bank: string;
  initialBalance: number;
}
