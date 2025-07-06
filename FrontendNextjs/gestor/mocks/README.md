# Mock Repositories

Esta carpeta contiene las implementaciones mock de todos los repositorios para desarrollo y testing mientras se desarrolla el backend.

## 🎯 Propósito

Los mocks permiten:
- Desarrollo del frontend sin dependencia del backend
- Testing de componentes con datos controlados
- Prototipado rápido de funcionalidades
- Simulación de diferentes estados y escenarios

## 📁 Estructura

```
mocks/
├── accountRepositoryMock.ts     # Mock para cuentas
├── authRepositoryMock.ts        # Mock para autenticación
├── budgetRepositoryMock.ts      # Mock para presupuestos
├── categoryRepositoryMock.ts    # Mock para categorías
├── transactionRepositoryMock.ts # Mock para transacciones
└── README.md                    # Esta documentación
```

## 🔧 Configuración

El archivo `lib/repositoryConfig.ts` centraliza la configuración:

```typescript
// Cambiar a false para usar repositorios reales
const USE_MOCKS = true;
```

## 📋 Uso

### Importar repositorios configurados:

```typescript
import { 
  accountRepository, 
  authRepository, 
  budgetRepository, 
  categoryRepository, 
  transactionRepository 
} from "@/lib/repositoryConfig";

// Uso automático según configuración
const accounts = await accountRepository.findAll();
```

### Verificar modo actual:

```typescript
import { isMockMode, getRepositoryConfig } from "@/lib/repositoryConfig";

if (isMockMode()) {
  console.log("Usando datos mock");
}

console.log(getRepositoryConfig()); // { useMocks: true, mode: 'mock' }
```

## 🔍 Características de los Mocks

### ✅ Datos Realistas
- Datos de ejemplo coherentes y útiles
- Relaciones entre entidades (accounts, budgets, categories, transactions)
- Fechas y montos realistas

### ⏱️ Simulación de Latencia
- Delays simulados para replicar comportamiento real del servidor
- Diferentes tiempos según complejidad de la operación

### 🎭 Manejo de Errores
- Validaciones básicas (duplicados, elementos no encontrados)
- Errores informativos para debugging

### 📊 Métodos Adicionales
Los mocks incluyen métodos útiles para desarrollo:

```typescript
// Categorías
await categoryRepository.findById(id);
await categoryRepository.findByName(name);

// Transacciones
await transactionRepository.findByAccount(accountId);
await transactionRepository.findByCategory(categoryId);
await transactionRepository.findByType(TypeTransaction.INCOME);
await transactionRepository.findByDateRange(startDate, endDate);
await transactionRepository.getStatistics();

// Presupuestos
await budgetRepository.updateCurrentAmount(id, newAmount);
```

## 🏗️ Datos de Ejemplo

### Usuarios Mock:
- **Juan Pérez** (juan.perez@example.com)
- **María González** (maria.gonzalez@example.com)

### Categorías Mock:
- 🍽️ Alimentación
- 🚗 Transporte  
- 🎬 Entretenimiento
- 🏥 Salud
- 📚 Educación
- 🏠 Hogar
- 👕 Ropa
- 💻 Tecnología

### Cuentas Mock:
- Cuenta Principal (Banco Nacional) - $15,000.50
- Cuenta Ahorros (Banco Popular) - $8,500.25
- Cuenta Corriente (Banco Industrial) - $3,200.75

## 🔄 Transición a Producción

Para cambiar a repositorios reales:

1. Asegúrate de que el backend esté funcionando
2. Cambia `USE_MOCKS = false` en `lib/repositoryConfig.ts`
3. Verifica que todas las llamadas funcionen correctamente

## 🧪 Testing

Los mocks son ideales para testing:

```typescript
import { AccountRepositoryMock } from "@/mocks/accountRepositoryMock";

describe("Component Tests", () => {
  test("should handle account data", async () => {
    const mockRepo = new AccountRepositoryMock();
    const accounts = await mockRepo.findAll();
    expect(accounts).toHaveLength(3);
  });
});
```

## ⚡ Buenas Prácticas

1. **Mantén los mocks sincronizados** con las interfaces reales
2. **Usa datos consistentes** entre diferentes mocks
3. **Simula escenarios de error** para testing robusto
4. **Documenta cambios** en los datos mock cuando sea necesario
5. **No hagas commits** con `USE_MOCKS = false` por defecto

## 🐛 Troubleshooting

### Error: "Could not find module"
- Verifica que todos los archivos mock estén en la carpeta correcta
- Revisa las rutas de importación en `repositoryConfig.ts`

### Error: "Property does not exist"
- Asegúrate de que los mocks implementen todas las propiedades de las interfaces originales
- Verifica que los tipos sean consistentes

### Datos inconsistentes
- Revisa que los IDs relacionados entre mocks sean coherentes
- Verifica que las fechas y montos sean realistas 