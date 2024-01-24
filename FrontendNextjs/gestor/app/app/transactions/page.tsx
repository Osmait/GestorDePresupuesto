import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "../../../components/ui/tabs";
import { TransactionSection } from "@/components/transactionSection";
import { TransactionRepository } from "@/app/repository/transactionRepository";
export default async function Transaction() {
  const transactionRepostiory = new TransactionRepository();
  const transactions = await transactionRepostiory.findAll();

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsContent value="overview" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="col-span-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Tansaction List
              </CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-muted-foreground"
              >
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <path d="M2 10h20" />
              </svg>
            </CardHeader>
            <CardContent>
              <TransactionSection transactionsList={transactions} />
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:grid grid-cols-2 lg:grid-cols-7"></div>
      </TabsContent>
    </Tabs>
  );
}
