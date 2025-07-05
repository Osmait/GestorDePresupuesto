# Arquitectura del Sistema

Este documento describe la arquitectura del Gestor de Presupuesto, incluyendo principios de diseño, patrones utilizados, y decisiones arquitectónicas.

## 📋 Tabla de Contenidos

- [Principios Arquitectónicos](#principios-arquitectónicos)
- [Clean Architecture](#clean-architecture)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Capas de la Aplicación](#capas-de-la-aplicación)
- [Flujo de Datos](#flujo-de-datos)
- [Patrones de Diseño](#patrones-de-diseño)
- [Gestión de Dependencias](#gestión-de-dependencias)
- [Base de Datos](#base-de-datos)
- [API Design](#api-design)
- [Seguridad](#seguridad)
- [Testing Strategy](#testing-strategy)
- [Deployment](#deployment)
- [Decisiones Arquitectónicas](#decisiones-arquitectónicas)

## 🏛️ Principios Arquitectónicos

### 1. Clean Architecture
- **Separación de responsabilidades** por capas bien definidas
- **Independencia de frameworks** - lógica de negocio no depende de Gin
- **Independencia de UI** - la API puede cambiar sin afectar el core
- **Independencia de base de datos** - PostgreSQL/SQLite intercambiables
- **Testeable** - lógica de negocio testeable sin dependencies externas

### 2. SOLID Principles
- **Single Responsibility**: Cada struct/función tiene una responsabilidad
- **Open/Closed**: Extensible sin modificar código existente
- **Liskov Substitution**: Interfaces intercambiables
- **Interface Segregation**: Interfaces pequeñas y específicas
- **Dependency Inversion**: Dependencia de abstracciones, no concreciones

### 3. Domain-Driven Design
- **Entities**: Objetos con identidad (User, Account, Transaction)
- **Value Objects**: Objetos inmutables (Money, Email)
- **Services**: Lógica de dominio que no pertenece a entities
- **Repositories**: Abstracción para persistencia

## 🏗️ Clean Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Framework & Drivers                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ HTTP Server │  │ PostgreSQL  │  │ File System │    │
│  │    (Gin)    │  │  Database   │  │   Logger    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│               Interface Adapters                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Handlers   │  │Repositories │  │ Presenters  │    │
│  │(Controllers)│  │ (Database)  │  │    (DTOs)   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                 Application Business Rules              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Services  │  │ Use Cases   │  │ Interactors │    │
│  │ (Business   │  │ (App Logic) │  │             │    │
│  │   Logic)    │  │             │  │             │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│               Enterprise Business Rules                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Entities   │  │ Value Objects│  │  Policies   │    │
│  │ (User, Acct)│  │  (Money)    │  │   (Rules)   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Dependency Rule
- **Dependencias apuntan hacia adentro**
- Capas internas no conocen capas externas
- Interfaces en capas internas, implementaciones en externas

## 📁 Estructura del Proyecto

```
BackEnd/
├── src/
│   ├── cmd/api/                 # Application entrypoint
│   │   ├── bootstrap/           # App initialization
│   │   └── db/migrations/       # Database migrations
│   │
│   ├── config/                  # Configuration management
│   │   └── config.go
│   │
│   └── internals/
│       ├── domain/              # Enterprise Business Rules
│       │   ├── user/           # User entity
│       │   ├── account/        # Account entity
│       │   ├── transaction/    # Transaction entity
│       │   ├── budget/         # Budget entity
│       │   ├── category/       # Category entity
│       │   └── investment/     # Investment entity
│       │
│       ├── services/           # Application Business Rules
│       │   ├── user/          # User use cases
│       │   ├── account/       # Account use cases
│       │   ├── transaction/   # Transaction use cases
│       │   ├── budget/        # Budget use cases
│       │   ├── category/      # Category use cases
│       │   ├── investment/    # Investment use cases
│       │   ├── auth/          # Authentication use cases
│       │   └── errorhttp/     # Error handling
│       │
│       └── platform/          # Interface Adapters
│           ├── dto/           # Data Transfer Objects
│           │   ├── user/
│           │   ├── account/
│           │   ├── transaction/
│           │   ├── budget/
│           │   ├── category/
│           │   └── investment/
│           │
│           ├── server/        # HTTP Transport
│           │   ├── handler/   # HTTP Handlers
│           │   ├── middleware/# HTTP Middleware
│           │   ├── routes/    # Route definitions
│           │   └── server.go
│           │
│           ├── storage/       # Data Access
│           │   └── postgres/
│           │       ├── user/
│           │       ├── account/
│           │       ├── transaction/
│           │       ├── budget/
│           │       ├── category/
│           │       ├── investment/
│           │       └── test/
│           │
│           └── utils/         # Shared Utilities
│               ├── jwt.go
│               ├── migrations.go
│               └── randomData.go
│
├── httpRequest/              # API testing files
├── docker-compose.yaml      # Development environment
└── dockerfile              # Container definition
```

## 🔄 Capas de la Aplicación

### 1. Domain Layer (Entities)
```go
// Entities - Core business objects
type User struct {
    Id        string
    Name      string
    LastName  string
    Email     string
    Password  string
    Token     string
    CreatedAt time.Time
}

// Constructor functions
func NewUser(id, name, lastName, email, password string) *User {
    return &User{
        Id:        id,
        Name:      name,
        LastName:  lastName,
        Email:     email,
        Password:  password,
        CreatedAt: time.Now(),
    }
}
```

### 2. Application Layer (Services)
```go
// Use Cases - Application business logic
type UserService struct {
    repository UserRepository  // Interface dependency
    hasher     PasswordHasher  // Interface dependency
}

func (s *UserService) CreateUser(ctx context.Context, req *dto.UserRequest) error {
    // Business logic validation
    if err := s.validateUser(req); err != nil {
        return fmt.Errorf("validation failed: %w", err)
    }
    
    // Create domain entity
    user := user.NewUser(id, req.Name, req.LastName, req.Email, hashedPassword)
    
    // Persist through repository interface
    if err := s.repository.Save(ctx, user); err != nil {
        return fmt.Errorf("saving user: %w", err)
    }
    
    return nil
}
```

### 3. Interface Adapters (Platform)

#### Handlers (Controllers)
```go
func CreateUser(userService *user.UserService) gin.HandlerFunc {
    return func(c *gin.Context) {
        var request dto.UserRequest
        if err := c.ShouldBindJSON(&request); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
            return
        }

        if err := userService.CreateUser(c, &request); err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }

        c.JSON(http.StatusCreated, gin.H{"message": "User created successfully"})
    }
}
```

#### Repositories (Data Access)
```go
type UserRepository struct {
    db *sql.DB
}

func (r *UserRepository) Save(ctx context.Context, user *user.User) error {
    query := `INSERT INTO users (id, name, last_name, email, password, token) 
              VALUES ($1, $2, $3, $4, $5, $6)`
    
    _, err := r.db.ExecContext(ctx, query, 
        user.Id, user.Name, user.LastName, user.Email, user.Password, user.Token)
    
    if err != nil {
        return fmt.Errorf("inserting user: %w", err)
    }
    
    return nil
}
```

### 4. Framework & Drivers
- **HTTP Server**: Gin framework
- **Database**: PostgreSQL/SQLite drivers
- **Configuration**: Environment variables
- **Logging**: Zerolog structured logger

## 🌊 Flujo de Datos

### Request Flow
```
HTTP Request → Handler → Service → Repository → Database
                ↓         ↓         ↓
              Validation  Business  Data
              & Binding   Logic     Access
```

### Response Flow
```
Database → Repository → Service → Handler → HTTP Response
            ↓           ↓         ↓
          Entity      DTO       JSON
         Mapping    Creation   Serialization
```

### Ejemplo: Crear Usuario
1. **Handler** recibe HTTP POST `/user`
2. **Handler** valida y bindea JSON a `UserRequest` DTO
3. **Handler** llama `UserService.CreateUser()`
4. **Service** valida business rules
5. **Service** crea entity `User`
6. **Service** llama `UserRepository.Save()`
7. **Repository** ejecuta INSERT en database
8. **Response** retorna por la cadena

## 🎨 Patrones de Diseño

### 1. Repository Pattern
```go
// Interface en layer de Application
type UserRepository interface {
    Save(ctx context.Context, user *User) error
    FindById(ctx context.Context, id string) (*User, error)
    FindByEmail(ctx context.Context, email string) (*User, error)
    Delete(ctx context.Context, id string) error
}

// Implementación en layer de Infrastructure
type PostgresUserRepository struct {
    db *sql.DB
}
```

### 2. Dependency Injection
```go
// Constructor injection
func NewUserService(repo UserRepository, hasher PasswordHasher) *UserService {
    return &UserService{
        repository: repo,
        hasher:     hasher,
    }
}

// Bootstrap wiring
func Bootstrap() {
    db := setupDatabase()
    userRepo := postgres.NewUserRepository(db)
    userService := user.NewUserService(userRepo, hasher)
    userHandler := handler.NewUserHandler(userService)
}
```

### 3. DTO Pattern
```go
// Request DTOs - Input validation
type UserRequest struct {
    Name     string `json:"name" validate:"required,min=2"`
    LastName string `json:"last_name" validate:"required,min=2"`
    Email    string `json:"email" validate:"required,email"`
    Password string `json:"password" validate:"required,min=8"`
}

// Response DTOs - Output formatting
type UserResponse struct {
    Id        string    `json:"id"`
    Name      string    `json:"name"`
    LastName  string    `json:"last_name"`
    Email     string    `json:"email"`
    CreatedAt time.Time `json:"created_at"`
}
```

### 4. Factory Pattern
```go
// Entity factory functions
func NewUser(id, name, lastName, email, password string) *User
func NewAccount(balance float64, userId, name, bank string) *Account
func NewTransaction(id, name, desc, txType, accountId, categoryId string, amount float64) *Transaction
```

## 🔗 Gestión de Dependencias

### Interface-First Design
```go
// Define interface in business layer
type UserRepository interface {
    Save(ctx context.Context, user *User) error
}

// Implement in infrastructure layer
type PostgresUserRepository struct { ... }
func (r *PostgresUserRepository) Save(ctx context.Context, user *User) error { ... }

// Inject dependency
userService := user.NewUserService(postgresRepo)
```

### Dependency Inversion
- **High-level modules** (Services) no dependen de **low-level modules** (Repositories)
- Ambos dependen de **abstractions** (Interfaces)
- **Abstractions** no dependen de **details**

## 🗄️ Base de Datos

### Schema Design
```sql
-- Core entities
CREATE TABLE users (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    last_name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    password VARCHAR NOT NULL,
    token VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE accounts (
    id VARCHAR PRIMARY KEY,
    name_account VARCHAR NOT NULL,
    bank VARCHAR NOT NULL,
    balance FLOAT NOT NULL,
    user_id VARCHAR REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relationships and constraints
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
```

### Migration Strategy
- **Version-controlled** migrations con golang-migrate
- **Up/Down** migrations para rollbacks
- **Environment-specific** configurations
- **Testing** con SQLite in-memory

## 🌐 API Design

### RESTful Principles
```
GET    /users           # List users
POST   /users           # Create user
GET    /users/:id       # Get user by ID
PUT    /users/:id       # Update user
DELETE /users/:id       # Delete user

GET    /accounts        # List user accounts
POST   /accounts        # Create account
DELETE /accounts/:id    # Delete account
```

### Request/Response Format
```json
// Request
{
    "name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "password": "secure123"
}

// Response
{
    "id": "user123",
    "name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "created_at": "2024-01-01T00:00:00Z"
}

// Error Response
{
    "error": "validation failed",
    "details": {
        "field": "email",
        "message": "invalid email format"
    }
}
```

## 🔐 Seguridad

### Authentication
- **JWT-based** authentication
- **Stateless** tokens
- **Configurable** secret key
- **Expiration** time management

### Authorization
- **User-scoped** resources
- **Middleware** for protected routes
- **Context propagation** for user ID

### Data Protection
- **Password hashing** con bcrypt
- **SQL injection** prevention con prepared statements
- **Input validation** en todas las capas
- **CORS** configuration

## 🧪 Testing Strategy

### Test Pyramid
```
         /\
        /  \  E2E Tests (Few)
       /____\
      /      \  Integration Tests (Some)
     /        \
    /__________\ Unit Tests (Many)
```

### Testing Layers
- **Unit Tests**: Services con mocks
- **Integration Tests**: Repositories con SQLite
- **E2E Tests**: Handlers con test server

### Test Database
- **SQLite in-memory** para tests
- **Isolated** per test
- **Fast** execution (3-5x PostgreSQL)
- **Automated** cleanup

## 🚀 Deployment

### Containerization
```dockerfile
FROM golang:alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o app src/cmd/main.go

FROM alpine:latest
COPY --from=builder /app/app /app
EXPOSE 8080
CMD ["/app"]
```

### Environment Configuration
- **Development**: Docker Compose
- **Testing**: In-memory databases
- **Production**: Managed databases

## 📋 Decisiones Arquitectónicas

### ADR-001: Clean Architecture
**Decisión**: Implementar Clean Architecture con capas bien definidas

**Razones**:
- Mantenibilidad a largo plazo
- Testabilidad mejorada
- Independencia de frameworks
- Escalabilidad del equipo

**Consecuencias**:
- Mayor complejidad inicial
- Más archivos y directorios
- Curva de aprendizaje para el equipo

### ADR-002: Repository Pattern
**Decisión**: Usar Repository Pattern para abstracción de datos

**Razones**:
- Testabilidad con mocks
- Intercambiabilidad de storage
- Separación de responsabilidades

**Consecuencias**:
- Interfaces adicionales
- Posible over-engineering para casos simples

### ADR-003: SQLite para Tests
**Decisión**: SQLite in-memory para testing

**Razones**:
- 3-5x más rápido que PostgreSQL
- Sin dependencias externas
- Aislamiento por test

**Consecuencias**:
- Diferencias menores en SQL dialect
- Schemas separados para mantener

### ADR-004: Gin Framework
**Decisión**: Gin para HTTP routing

**Razones**:
- Performance excelente
- Middleware ecosystem
- JSON binding automático
- Comunidad activa

**Consecuencias**:
- Vendor lock-in mínimo por abstracción
- Aprendizaje de framework específico

## 🔄 Evolución de la Arquitectura

### Futuras Mejoras
- **OpenTelemetry** para observability
- **Circuit Breakers** para resilience
- **Rate Limiting** para protection
- **gRPC** para service-to-service
- **Event Sourcing** para audit trail
- **CQRS** para read/write separation

### Scaling Considerations
- **Microservices** decomposition
- **Database sharding** por user
- **Caching** layer con Redis
- **Message queues** para async processing

Esta arquitectura proporciona una base sólida, mantenible y escalable para el Gestor de Presupuesto, siguiendo principios probados de ingeniería de software y patrones de la industria. 