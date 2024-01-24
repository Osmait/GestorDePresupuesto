import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "../../../components/ui/tabs";
import { CategorySection } from "@/components/CategorySection";
import { CategoryRepository } from "@/app/repository/categoryRepository";

export default async function Category() {
  const categoryRepositiory = new CategoryRepository();
  const categorys = await categoryRepositiory.findAll();

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsContent value="overview" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="col-span-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Category List
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
              <CategorySection categoryList={categorys} />
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:grid grid-cols-2 lg:grid-cols-7"></div>
      </TabsContent>
    </Tabs>
  );
}
