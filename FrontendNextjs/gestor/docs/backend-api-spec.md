# 📚 API Documentation for Financial Management App

## 1. Autenticación y Usuario
### 1.1. POST /api/auth/login
- **Body:**
  ```json
  { "email": "string", "password": "string" }
  ```
- **Response:**
  ```json
  { "token": "string", "user": { "id": "string", "name": "string", "email": "string" } }
  ```

### 1.2. POST /api/auth/register
- **Body:**
  ```json
  { "name": "string", "email": "string", "password": "string" }
  ```
- **Response:**
  ```json
  { "user": { "id": "string", "name": "string", "email": "string" } }
  ```

---

## 2. Cuentas
### 2.1. GET /api/accounts
- **Query Params:**
  - `userId: string` (opcional, si hay multiusuario)
- **Response:**
  ```json
  [
    { "id": "string", "name_account": "string", "balance": number, "type": "string" }
  ]
  ```

### 2.2. POST /api/accounts
- **Body:**
  ```json
  { "name_account": "string", "balance": number, "type": "string" }
  ```
- **Response:**
  ```json
  { "id": "string", "name_account": "string", "balance": number, "type": "string" }
  ```

---

## 3. Categorías
### 3.1. GET /api/categories
- **Response:**
  ```json
  [
    { "id": "string", "name": "string", "emoji": "string" }
  ]
  ```

### 3.2. POST /api/categories
- **Body:**
  ```json
  { "name": "string", "emoji": "string" }
  ```
- **Response:**
  ```json
  { "id": "string", "name": "string", "emoji": "string" }
  ```

---

## 4. Transacciones
### 4.1. GET /api/transactions
- **Query Params (todos opcionales):**
  - `accountId: string`
  - `categoryId: string`
  - `type: 'INCOME' | 'BILL'`
  - `dateFrom: string (ISO date)`
  - `dateTo: string (ISO date)`
  - `minAmount: number`
  - `maxAmount: number`
  - `search: string` (busca en nombre o descripción)
  - `sortBy: 'date' | 'amount'`
  - `sortOrder: 'asc' | 'desc'`
  - `limit: number`
  - `offset: number`
- **Response:**
  ```json
  [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "amount": number,
      "type_transaction": 0 | 1,
      "account_id": "string",
      "category_id": "string",
      "created_at": "string (ISO date)"
    }
  ]
  ```

### 4.2. POST /api/transactions
- **Body:**
  ```json
  {
    "name": "string",
    "description": "string",
    "amount": number,
    "type_transaction": 0 | 1,
    "account_id": "string",
    "category_id": "string",
    "created_at": "string (ISO date)"
  }
  ```
- **Response:**
  ```json
  { "id": "string", ... }
  ```

---

## 5. Presupuestos
### 5.1. GET /api/budgets
- **Query Params (opcional):**
  - `categoryId: string`
  - `accountId: string`
  - `dateFrom: string (ISO date)`
  - `dateTo: string (ISO date)`
- **Response:**
  ```json
  [
    {
      "id": "string",
      "amount": number,
      "category_id": "string",
      "account_id": "string",
      "start_date": "string (ISO date)",
      "end_date": "string (ISO date)"
    }
  ]
  ```

### 5.2. POST /api/budgets
- **Body:**
  ```json
  {
    "amount": number,
    "category_id": "string",
    "account_id": "string",
    "start_date": "string (ISO date)",
    "end_date": "string (ISO date)"
  }
  ```
- **Response:**
  ```json
  { "id": "string", ... }
  ```

---

## 6. Analíticas y Agregaciones
### 6.1. GET /api/analytics/overview
- **Query Params (todos opcionales):**
  - `accountId: string`
  - `categoryId: string`
  - `type: 'INCOME' | 'BILL'`
  - `dateFrom: string (ISO date)`
  - `dateTo: string (ISO date)`
  - `groupBy: 'day' | 'week' | 'month' | 'year'`
- **Response:**
  ```json
  {
    "labels": ["Ene 2025", "Feb 2025", ...],
    "series": [
      { "id": "Saldo", "data": [ { "x": "Ene 2025", "y": 1200 }, ... ] },
      { "id": "Ingresos", "data": [ { "x": "Ene 2025", "y": 2000 }, ... ] },
      { "id": "Gastos", "data": [ { "x": "Ene 2025", "y": 800 }, ... ] }
    ]
  }
  ```

### 6.2. GET /api/analytics/bar
- **Query Params:**
  - `dateFrom`, `dateTo`, `groupBy`, `accountId`, `categoryId`, `type` (igual que arriba)
- **Response:**
  ```json
  {
    "labels": ["Ene 2025", ...],
    "categories": ["Alimentación", "Transporte", ...],
    "data": [
      { "fecha": "Ene 2025", "Alimentación": 500, "Transporte": 300, ... }
    ]
  }
  ```

### 6.3. GET /api/analytics/pie
- **Query Params:**
  - `dateFrom`, `dateTo`, `accountId`, `categoryId`, `type`
- **Response:**
  ```json
  [
    { "id": "Cuenta 1", "label": "Cuenta 1", "value": 1200, "color": "#2563eb" },
    ...
  ]
  ```

### 6.4. GET /api/analytics/radar
- **Query Params:**
  - `dateFrom`, `dateTo`, `accountId`, `type`
- **Response:**
  ```json
  [
    { "categoria": "Alimentación", "Gastos": 500, "Ingresos": 0 },
    ...
  ]
  ```

### 6.5. GET /api/analytics/heatmap
- **Query Params:**
  - `dateFrom`, `dateTo`, `accountId`, `categoryId`, `type`
- **Response:**
  ```json
  [
    {
      "id": "Lun",
      "data": [
        { "x": "Ene", "y": 2 },
        { "x": "Feb", "y": 3 },
        ...
      ]
    },
    ...
  ]
  ```

---

## 7. Filtrado y Paginación
- Todos los endpoints de listados (`GET /api/transactions`, `/api/accounts`, etc.) deben soportar:
  - **Filtrado** por cualquier campo relevante (ver Query Params).
  - **Paginación**: `limit`, `offset`.
  - **Ordenación**: `sortBy`, `sortOrder`.

---

## 8. Tipos de Datos (TypeScript)
```ts
export interface Account {
  id: string
  name_account: string
  balance: number
  type: string
}

export interface Category {
  id: string
  name: string
  emoji: string
}

export interface Transaction {
  id: string
  name: string
  description: string
  amount: number
  type_transaction: 0 | 1 // 0 = BILL, 1 = INCOME
  account_id: string
  category_id: string
  created_at: string // ISO date
}

export interface Budget {
  id: string
  amount: number
  category_id: string
  account_id: string
  start_date: string // ISO date
  end_date: string // ISO date
}
```

---

## 9. Repository Layer (Simulación Backend)
Cada método del repository debe aceptar los mismos filtros que los endpoints y devolver los datos ya filtrados/agrupados, simulando la lógica del backend.

**Ejemplo para TransactionsRepository:**
```ts
getTransactions(filters: {
  accountId?: string
  categoryId?: string
  type?: 'INCOME' | 'BILL'
  dateFrom?: string
  dateTo?: string
  minAmount?: number
  maxAmount?: number
  search?: string
  sortBy?: 'date' | 'amount'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}): Promise<Transaction[]>
```
**Ejemplo para AnalyticsRepository:**
```ts
getOverview(params: {
  accountId?: string
  categoryId?: string
  type?: 'INCOME' | 'BILL'
  dateFrom?: string
  dateTo?: string
  groupBy?: 'day' | 'week' | 'month' | 'year'
}): Promise<{ labels: string[], series: { id: string, data: { x: string, y: number }[] }[] }>
```
Y así para cada endpoint.

---

## 10. Notas
- Todos los filtros y agregaciones que hoy haces en la UI deben moverse a los repositories/backend.
- El frontend solo envía los filtros y muestra los datos ya procesados.
- Si usas GraphQL, los tipos y filtros serían equivalentes. 