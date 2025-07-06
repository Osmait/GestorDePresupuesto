import { Category } from "@/types/category";

export class CategoryRepositoryMock {
  private mockCategories: Category[] = [
    {
      id: "category-1",
      name: "Alimentación",
      icon: "🍽️",
      color: "#FF6B6B",
      created_at: "2024-01-10T08:00:00Z",
    },
    {
      id: "category-2",
      name: "Transporte",
      icon: "🚗",
      color: "#4ECDC4",
      created_at: "2024-01-10T08:15:00Z",
    },
    {
      id: "category-3",
      name: "Entretenimiento",
      icon: "🎬",
      color: "#45B7D1",
      created_at: "2024-01-10T08:30:00Z",
    },
    {
      id: "category-4",
      name: "Salud",
      icon: "🏥",
      color: "#F9CA24",
      created_at: "2024-01-10T08:45:00Z",
    },
    {
      id: "category-5",
      name: "Educación",
      icon: "📚",
      color: "#6C5CE7",
      created_at: "2024-01-10T09:00:00Z",
    },
    {
      id: "category-6",
      name: "Hogar",
      icon: "🏠",
      color: "#A0E7E5",
      created_at: "2024-01-10T09:15:00Z",
    },
    {
      id: "category-7",
      name: "Ropa",
      icon: "👕",
      color: "#FF7675",
      created_at: "2024-01-10T09:30:00Z",
    },
    {
      id: "category-8",
      name: "Tecnología",
      icon: "💻",
      color: "#636E72",
      created_at: "2024-01-10T09:45:00Z",
    },
  ];

  findAll = async (): Promise<Category[]> => {
    // Simular delay del servidor (reducido)
    await new Promise(resolve => setTimeout(resolve, 100));
    return [...this.mockCategories];
  };

  create = async (name: string, icon: string, color: string): Promise<void> => {
    // Simular delay del servidor
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verificar si ya existe una categoría con el mismo nombre
    const existingCategory = this.mockCategories.find(c => 
      c.name.toLowerCase() === name.toLowerCase()
    );
    if (existingCategory) {
      throw new Error("Ya existe una categoría con este nombre");
    }
    
    const newCategory: Category = {
      id: `category-${Date.now()}`,
      name,
      icon,
      color,
      created_at: new Date().toISOString(),
    };

    this.mockCategories.push(newCategory);
  };

  delete = async (id: string): Promise<void> => {
    // Simular delay del servidor
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const index = this.mockCategories.findIndex(category => category.id === id);
    if (index === -1) {
      throw new Error(`Category with id ${id} not found`);
    }
    
    this.mockCategories.splice(index, 1);
  };

  // Método adicional para obtener una categoría por ID (útil para testing)
  findById = async (id: string): Promise<Category | null> => {
    // Simular delay del servidor
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const category = this.mockCategories.find(c => c.id === id);
    return category || null;
  };

  // Método adicional para obtener categorías por nombre (útil para búsquedas)
  findByName = async (name: string): Promise<Category[]> => {
    // Simular delay del servidor
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return this.mockCategories.filter(c => 
      c.name.toLowerCase().includes(name.toLowerCase())
    );
  };

  /**
   * Obtiene categorías filtradas y paginadas como lo haría el backend.
   * @param filters Filtros y opciones de paginación
   */
  async getCategories(filters: {
    name?: string
    dateFrom?: string
    dateTo?: string
    limit?: number
    offset?: number
  }): Promise<Category[]> {
    let cats = [...this.mockCategories]
    if (filters.name) {
      const s = filters.name.toLowerCase()
      cats = cats.filter(c => c.name.toLowerCase().includes(s))
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom)
      cats = cats.filter(c => new Date(c.created_at) >= from)
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo)
      cats = cats.filter(c => new Date(c.created_at) <= to)
    }
    if (filters.offset !== undefined) {
      cats = cats.slice(filters.offset)
    }
    if (filters.limit !== undefined) {
      cats = cats.slice(0, filters.limit)
    }
    return cats.map(c => ({ ...c, created_at: c.created_at }))
  }
} 