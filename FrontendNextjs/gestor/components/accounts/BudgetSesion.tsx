"use client";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGetBudgets } from "@/hooks/queries/useBudgetsQuery";
import { useGetCategories } from "@/hooks/queries/useCategoriesQuery";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

function getPercentage(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.min((current / total) * 100, 100);
}

function getProgressColor(percentage: number): string {
  if (percentage > 80) return "#ef4444"; // red-500
  if (percentage > 60) return "#eab308"; // yellow-500
  return "#22c55e"; // green-500
}

export function BudgetSesion() {
  const { data: budgets = [], isLoading: budgetsLoading, error: budgetsError } = useGetBudgets();
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useGetCategories();

  const isLoading = budgetsLoading || categoriesLoading;
  const hasError = budgetsError || categoriesError;

  // Create a map of category_id to category name for quick lookup
  const categoryMap = categories.reduce((map, category) => {
    map[category.id] = category.name;
    return map;
  }, {} as Record<string, string>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-muted-foreground">Loading budgets...</span>
      </div>
    );
  }

  if (hasError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Error loading budgets: {(budgetsError as Error)?.message || (categoriesError as Error)?.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (budgets.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No budgets created yet.</p>
        <p className="text-sm">Create your first budget to start tracking expenses.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableCaption>Your current budget progress</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[150px]">Category</TableHead>
          <TableHead className="text-center">Spent / Budget</TableHead>
          <TableHead>Progress</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {budgets.map((budget) => {
          const categoryName = categoryMap[budget.category_id] || "Unknown Category";
          // Convert negative current_amount to positive for display
          const spentAmount = Math.abs(budget.current_amount);
          const percentage = getPercentage(spentAmount, budget.amount);
          const progressColor = getProgressColor(percentage);

          return (
            <TableRow key={budget.id}>
              <TableCell className="font-medium">{categoryName}</TableCell>
              <TableCell className="text-center">
                <div className="font-mono">
                  ${spentAmount.toFixed(2)} / ${budget.amount.toFixed(2)}
                </div>
              </TableCell>
              <TableCell className="w-3/6">
                <div className="space-y-1">
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full transition-all duration-500 rounded-full"
                      style={{
                        width: `${Math.max(percentage, percentage > 0 ? 5 : 0)}%`,
                        minWidth: percentage > 0 ? '8px' : '0px',
                        backgroundColor: progressColor
                      }}
                    />
                  </div>
                  <div className="text-xs text-right text-muted-foreground">
                    {percentage.toFixed(1)}%
                  </div>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
