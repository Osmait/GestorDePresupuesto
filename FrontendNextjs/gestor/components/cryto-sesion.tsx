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
import { Avatar, AvatarImage } from "@/components/ui/avatar";
const invoices = [
  {
    invoice: "https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png",
    paymentStatus: 500,
    totalAmount: 300.0,
    paymentMethod: 200,
  },
  {
    invoice: "https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png",
    paymentStatus: 500,
    totalAmount: 300.0,
    paymentMethod: 200,
  },
  {
    invoice: "https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png",
    paymentStatus: 500,
    totalAmount: 300.0,
    paymentMethod: 200,
  },
  {
    invoice: "https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png",
    paymentStatus: 500,
    totalAmount: 300.0,
    paymentMethod: 200,
  },
  {
    invoice: "https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png",
    paymentStatus: 500,
    totalAmount: 300.0,
    paymentMethod: 200,
  },
  {
    invoice: "https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png",
    paymentStatus: 500,
    totalAmount: 300.0,
    paymentMethod: 200,
  },
  {
    invoice: "https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png",
    paymentStatus: 500,
    totalAmount: 300.0,
    paymentMethod: 200,
  },
];

export function CrytoSeccion() {
  return (
    <Table>
      <TableCaption>A list of your recent invoices.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Name</TableHead>
          <TableHead>Prices</TableHead>
          <TableHead>Avg. Buy Price</TableHead>
          <TableHead className="text-right">Profit/Loss</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.invoice}>
            <TableCell className="font-medium flex gap-x-4 items-center sticky left-0.5 ">
              <Avatar>
                <AvatarImage src={invoice.invoice} />
              </Avatar>
              <p className="flex gap-x-2">
                solana <span>SOL</span>
              </p>
            </TableCell>
            <TableCell>{invoice.paymentStatus}</TableCell>
            <TableCell>{invoice.paymentMethod}</TableCell>
            <TableCell className="text-right">{invoice.totalAmount}</TableCell>
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
  );
}
