import { Account } from "@/types/account";
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
interface Props {
  accouts: Account[];
}

export function AccountSection({ accouts }: Props) {
  console.log(accouts);
  return (
    <>
      {accouts.length > 1 ? (
        <Table>
          <TableCaption>A list of your recent invoices.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Name</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead>Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accouts.map((account) => (
              <TableRow key={account.id}>
                <TableCell>{account.name}</TableCell>
                <TableCell className="font-medium flex gap-x-4 items-center sticky left-0.5 ">
                  {account.bank}
                </TableCell>
                <TableCell className="text-right">{account.initial_balance}</TableCell>
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
        <p>No has accounts </p>
      )}
    </>
  );
}
