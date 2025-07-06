import { Budget } from "@/types/budget";

export class BudgetRepositoryMock {
  private mockBudgets: Budget[] = [
    {
      id: "budget-1",
      category_id: "category-1",
      user_id: "user-123",
      amount: 5000.00,
      current_amount: 2800.50,
      created_at: new Date("2024-01-15T10:30:00Z"),
    },
    {
      id: "budget-2",
      category_id: "category-2",
      user_id: "user-123",
      amount: 3000.00,
      current_amount: 1500.75,
      created_at: new Date("2024-01-20T14:15:00Z"),
    },
    {
      id: "budget-3",
      category_id: "category-3",
      user_id: "user-123",
      amount: 2000.00,
      current_amount: 1850.25,
      created_at: new Date("2024-02-01T09:00:00Z"),
    },
    {
      id: "budget-4",
      category_id: "category-4",
      user_id: "user-123",
      amount: 1500.00,
      current_amount: 750.00,
      created_at: new Date("2024-02-05T16:30:00Z"),
    },
  ];

  findAll = async (): Promise<Budget[]> => {
    // Simular delay del servidor (reducido)
    await new Promise(resolve => setTimeout(resolve, 100));
    return [...this.mockBudgets];
  };

  create = async (category_id: string, amount: number): Promise<void> => {
    // Simular delay del servidor
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Verificar si ya existe un presupuesto para esta categoría
    const existingBudget = this.mockBudgets.find(b => b.category_id === category_id);
    if (existingBudget) {
      throw new Error("Ya existe un presupuesto para esta categoría");
    }
    
    const newBudget: Budget = {
      id: `budget-${Date.now()}`,
      category_id,
      user_id: "user-123", // En producción vendría del token
      amount,
      current_amount: 0,
      created_at: new Date(),
    };

    this.mockBudgets.push(newBudget);
  };

  delete = async (id: string): Promise<void> => {
    // Simular delay del servidor
    await new Promise(resolve => setTimeout(resolve, 450));
    
    const index = this.mockBudgets.findIndex(budget => budget.id === id);
    if (index === -1) {
      throw new Error(`Budget with id ${id} not found`);
    }
    
    this.mockBudgets.splice(index, 1);
  };

  // Método adicional para actualizar el current_amount (útil para testing)
  updateCurrentAmount = async (id: string, newAmount: number): Promise<void> => {
    // Simular delay del servidor
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const budget = this.mockBudgets.find(b => b.id === id);
    if (!budget) {
      throw new Error(`Budget with id ${id} not found`);
    }
    
    budget.current_amount = newAmount;
  };
} 