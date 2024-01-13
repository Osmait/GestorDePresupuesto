import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
const invoices = [
  {
    name: "Gym",
    paymentStatus: 500,
    totalAmount: 200.0,
  },
  {
    name: "Comida",
    paymentStatus: 500,
    totalAmount: 300.0,
  },
  {
    name: "Auto",
    paymentStatus: 500,
    totalAmount: 800.0,
  },
  {
    name: "Salidas",
    paymentStatus: 500,
    totalAmount: 340.0,
  },
];

export function BudgetSesion() {
  return (
    <Table>
      <TableCaption>A list of your recent invoices.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Name</TableHead>
          <TableHead>Current Balance</TableHead>
          <TableHead>Progress</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.name}>
            <TableCell>Gym</TableCell>

            <TableCell className="text-center">
              +${invoice.totalAmount}
            </TableCell>
            <TableCell className="w-3/6 ">
              <Progress
                className={
                  (invoice.totalAmount / invoice.paymentStatus) * 100 > 80
                    ? "bg-red-800"
                    : (invoice.totalAmount / invoice.paymentStatus) * 100 > 60
                      ? "bg-yellow-500"
                      : "bg-primary"
                }
                value={
                  (invoice.totalAmount / invoice.paymentStatus) * 100 < 100
                    ? (invoice.totalAmount / invoice.paymentStatus) * 100
                    : 100
                }
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
