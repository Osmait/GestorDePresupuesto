import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Transaction } from "@/types/transaction";
interface Props {
  transactionsList: Transaction[];
}

export function TransactionSection({ transactionsList }: Props) {
  return (
    <>
      {transactionsList.length > 1 ? (
        <Table>
          <TableCaption>A list of your recent invoices.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactionsList.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>{transaction.name}</TableCell>
                <TableCell className="font-medium flex gap-x-4 items-center sticky left-0.5 ">
                  {transaction.description}
                </TableCell>
                <TableCell className="text-right">
                  {transaction.amount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Total</TableCell>
              <TableCell className="text-right">$2,500.00</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      ) : (
        <p>No has Transaction</p>
      )}
    </>
  );
}
