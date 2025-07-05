# Test Database Setup

## Overview

Los tests de API ahora utilizan SQLite en memoria en lugar de PostgreSQL para mejorar el rendimiento y eliminar la dependencia de una base de datos externa.

## Configuración

### SQLite en Memoria

Los tests ahora usan SQLite en memoria (`":memory:"`) que ofrece las siguientes ventajas:

- **Velocidad**: Significativamente más rápido que PostgreSQL
- **Aislamiento**: Cada test tiene su propia base de datos limpia
- **Sin dependencias**: No requiere PostgreSQL ejecutándose
- **Configuración automática**: El esquema se crea automáticamente

### Uso

```go
// Setup básico
db := SetUpTest()

// Setup con cleanup automático
db, cleanup := SetUpTestWithCleanup()
defer cleanup()
```

## Diferencias con PostgreSQL

### Tipos de Datos

- `timestamptz` → `DATETIME`
- `float` → `REAL`
- `ENUM` → `VARCHAR` with `CHECK` constraint

### Formatos de Fecha

SQLite requiere formato de fecha específico:

```go
// ❌ Incorrecto (formato PostgreSQL)
date := fmt.Sprintf("%d/%d/%d", year, month, day)

// ✅ Correcto (formato SQLite)
date := fmt.Sprintf("%04d-%02d-%02d", year, month, day)
```

## Archivos Modificados

1. **`setup_test.go`** - Configuración de base de datos de prueba
2. **`internal/config/config.go`** - Soporte para SQLite
3. **`internal/platform/utils/migratios.go`** - Utilidades SQLite
4. **`cmd/api/db/migrations/`** - Migraciones SQLite

## Ejecutar Tests

```bash
# Todos los tests de almacenamiento
go test ./internal/platform/storage/postgress/test/ -v

# Todos los tests de servicios
go test ./internal/services/... -v

# Test específico
go test ./internal/platform/storage/postgress/test/ -run TestAccountRepository -v
```

## Notas

- Los tests de producción aún usan PostgreSQL
- SQLite solo se usa para tests unitarios/integración
- El esquema se mantiene sincronizado entre PostgreSQL y SQLite
- La configuración es completamente automática 