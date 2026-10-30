# Guía de Contribución

¡Gracias por tu interés en contribuir al Gestor de Presupuesto! Esta guía te ayudará a entender nuestro proceso de desarrollo y cómo contribuir efectivamente.

## 📋 Tabla de Contenidos

- [Código de Conducta](#código-de-conducta)
- [Proceso de Contribución](#proceso-de-contribución)
- [Configuración del Entorno](#configuración-del-entorno)
- [Estándares de Código](#estándares-de-código)
- [Testing](#testing)
- [Documentación](#documentación)
- [Pull Requests](#pull-requests)
- [Issues](#issues)

## 🤝 Código de Conducta

Este proyecto adhiere a principios de respeto mutuo, inclusión y colaboración constructiva. Esperamos que todos los contribuyentes:

- Mantengan un lenguaje respetuoso
- Acepten críticas constructivas
- Se enfoquen en el beneficio del proyecto
- Muestren empatía hacia otros contribuyentes

## 🔄 Proceso de Contribución

### 1. Preparación

```bash
# 1. Fork el repositorio
# 2. Clonar tu fork
git clone https://github.com/tu-usuario/gestorDePresupuesto
cd gestorDePresupuesto/BackEnd

# 3. Configurar upstream
git remote add upstream https://github.com/original/gestorDePresupuesto
```

### 2. Desarrollo

```bash
# 1. Crear rama desde main
git checkout main
git pull upstream main
git checkout -b feature/nueva-funcionalidad

# 2. Desarrollar tu feature
# 3. Commit con mensajes descriptivos
git commit -m "feat: agregar validación de input en handlers

- Implementar validation middleware
- Agregar validaciones para todos los DTOs
- Añadir tests para casos edge
- Actualizar documentación de API

Resolves #123"
```

### 3. Antes de enviar PR

```bash
# 1. Ejecutar todos los tests
go test ./... -v

# 2. Verificar coverage (mínimo 95%)
go test -cover ./...

# 3. Ejecutar linting
golangci-lint run

# 4. Verificar formato
go fmt ./...
goimports -w .

# 5. Verificar security
gosec ./...
```

## ⚙️ Configuración del Entorno

### Prerrequisitos

```bash
# Go version
go version # debe ser 1.24+

# Herramientas requeridas
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
go install golang.org/x/tools/cmd/goimports@latest
go install github.com/securecodewarrior/gosec/v2/cmd/gosec@latest
```

### Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Configurar para desarrollo
DB_HOST=localhost
DB_PORT=5432
DB_NAME=my_store_dev
DB_USER=osmait
DB_PASSWORD=admin123

SERVER_HOST=localhost
SERVER_PORT=8080

JWT_SECRET=development-secret-key
JWT_EXPIRATION=15m

ENV=development
LOG_LEVEL=debug
```

### Base de Datos de Desarrollo

```bash
# Opción 1: Docker (recomendado)
docker-compose up -d postgres

# Opción 2: PostgreSQL local
createdb my_store_dev
```

## 📝 Estándares de Código

### Arquitectura

Seguimos **Clean Architecture** con estas capas:

```
src/
├── domain/          # Entidades de negocio
├── services/        # Casos de uso
└── platform/        # Infraestructura
    ├── dto/         # Data Transfer Objects
    ├── server/      # HTTP transport
    ├── storage/     # Database layer
    └── utils/       # Shared utilities
```

### Convenciones de Naming

```go
// ✅ Correcto
type UserService struct {}
func (s *UserService) CreateUser(ctx context.Context, req *dto.UserRequest) error

// ❌ Incorrecto
type userservice struct {}
func (s *userservice) create_user(req dto.UserRequest) error
```

### Error Handling

```go
// ✅ Correcto - wrapped errors con contexto
func (s *UserService) CreateUser(ctx context.Context, req *dto.UserRequest) error {
    if err := s.repository.Save(ctx, user); err != nil {
        return fmt.Errorf("creating user: %w", err)
    }
    return nil
}

// ❌ Incorrecto - error sin contexto
func (s *UserService) CreateUser(ctx context.Context, req *dto.UserRequest) error {
    if err := s.repository.Save(ctx, user); err != nil {
        return err
    }
    return nil
}
```

### Context Propagation

```go
// ✅ Correcto - context siempre primer parámetro
func (r *UserRepository) FindById(ctx context.Context, id string) (*User, error)

// ❌ Incorrecto - sin context
func (r *UserRepository) FindById(id string) (*User, error)
```

### Interfaces

```go
// ✅ Correcto - interface pequeña y específica
type UserRepository interface {
    Save(ctx context.Context, user *User) error
    FindById(ctx context.Context, id string) (*User, error)
}

// ❌ Incorrecto - interface demasiado grande
type Repository interface {
    SaveUser(ctx context.Context, user *User) error
    SaveAccount(ctx context.Context, account *Account) error
    SaveTransaction(ctx context.Context, tx *Transaction) error
    // ... muchos más métodos
}
```

## 🧪 Testing

### Estrategia de Testing

1. **Unit Tests**: Para lógica de negocio usando mocks
2. **Integration Tests**: Para repositories con SQLite
3. **End-to-End Tests**: Para handlers completos

### Estructura de Tests

```go
// Usar table-driven tests
func TestUserService_CreateUser(t *testing.T) {
    tests := []struct {
        name    string
        input   *dto.UserRequest
        wantErr bool
        setup   func(*MockRepository)
    }{
        {
            name: "success case",
            input: &dto.UserRequest{Name: "John", Email: "john@test.com"},
            wantErr: false,
            setup: func(m *MockRepository) {
                m.On("Save", mock.Anything, mock.Anything).Return(nil)
            },
        },
        {
            name: "repository error",
            input: &dto.UserRequest{Name: "John", Email: "john@test.com"},
            wantErr: true,
            setup: func(m *MockRepository) {
                m.On("Save", mock.Anything, mock.Anything).Return(errors.New("db error"))
            },
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation
        })
    }
}
```

### Mocking

```go
// Usar testify/mock para interfaces
type MockUserRepository struct {
    mock.Mock
}

func (m *MockUserRepository) Save(ctx context.Context, user *User) error {
    args := m.Called(ctx, user)
    return args.Error(0)
}
```

### Coverage Requirements

- **Mínimo**: 95% coverage para nuevo código
- **Servicios**: 100% coverage en lógica de negocio
- **Repositories**: Tests de integración completos
- **Handlers**: Tests end-to-end con casos edge

## 📚 Documentación

### GoDoc Comments

```go
// UserService handles user-related business operations.
// It implements business logic for user management including
// creation, authentication, and profile management.
type UserService struct {
    repository UserRepository
    hasher     PasswordHasher
}

// CreateUser creates a new user account with the provided information.
// It validates the input, hashes the password, and stores the user.
//
// Returns an error if:
// - Email already exists
// - Validation fails
// - Database operation fails
func (s *UserService) CreateUser(ctx context.Context, req *dto.UserRequest) error {
    // Implementation
}
```

### API Documentation

- Documentar todos los endpoints en README.md
- Incluir ejemplos de request/response
- Documentar códigos de error
- Mantener httpRequest/ actualizado

## 📤 Pull Requests

### Checklist antes de enviar

- [ ] Tests pasan (`go test ./...`)
- [ ] Coverage >= 95% (`go test -cover ./...`)
- [ ] Linting pasa (`golangci-lint run`)
- [ ] Security check pasa (`gosec ./...`)
- [ ] Formato correcto (`go fmt`, `goimports`)
- [ ] Documentación actualizada
- [ ] Commit messages siguiendo convención

### Plantilla de PR

```markdown
## Descripción
Breve descripción de los cambios realizados.

## Tipo de cambio
- [ ] Bug fix (cambio que arregla un issue)
- [ ] New feature (cambio que agrega funcionalidad)
- [ ] Breaking change (cambio que rompe compatibilidad)
- [ ] Documentation update

## Testing
- [ ] Tests unitarios agregados/actualizados
- [ ] Tests de integración agregados/actualizados
- [ ] Coverage mantiene >= 95%

## Checklist
- [ ] Mi código sigue los estándares del proyecto
- [ ] He realizado self-review del código
- [ ] He comentado código complejo
- [ ] He actualizado documentación
- [ ] Mis cambios no generan nuevos warnings
- [ ] Tests nuevos prueban mi feature/fix efectivamente

## Screenshots (si aplica)
```

### Proceso de Review

1. **Automated Checks**: CI debe pasar
2. **Code Review**: Al menos 1 aprobación requerida
3. **Testing**: Reviewer debe ejecutar tests localmente
4. **Integration**: Merge solo si todo está verde

## 🐛 Issues

### Reportar Bugs

```markdown
**Describe el bug**
Descripción clara del problema.

**Para Reproducir**
Pasos para reproducir:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Comportamiento Esperado**
Descripción de lo que esperabas que pasara.

**Screenshots**
Si aplica, agregar screenshots.

**Entorno:**
- OS: [e.g. Ubuntu 20.04]
- Go Version: [e.g. 1.24]
- Versión del proyecto: [e.g. v1.2.3]

**Contexto Adicional**
Cualquier contexto adicional sobre el problema.
```

### Solicitar Features

```markdown
**¿Tu feature request está relacionado a un problema?**
Descripción clara del problema. Ej: "Es frustrante cuando [...]"

**Describe la solución que te gustaría**
Descripción clara de lo que quieres que pase.

**Describe alternativas consideradas**
Descripción de soluciones alternativas.

**Contexto Adicional**
Cualquier contexto o screenshots sobre el feature request.
```

## 🎯 Tipos de Contribuciones

### Code Contributions
- Nuevas features
- Bug fixes
- Performance improvements
- Refactoring

### Documentation
- README improvements
- Code comments
- API documentation
- Tutoriales

### Testing
- Nuevos test cases
- Performance tests
- Integration tests
- Test utilities

### DevOps
- CI/CD improvements
- Docker optimizations
- Deployment scripts
- Monitoring

## 🏆 Reconocimientos

Los contribuyentes son reconocidos en:
- CONTRIBUTORS.md
- Release notes
- Documentación del proyecto

¡Gracias por contribuir al Gestor de Presupuesto! 🚀 