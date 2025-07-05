# Gestor de Presupuesto - Backend

[![Go Version](https://img.shields.io/badge/Go-1.24-blue.svg)](https://golang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Test Coverage](https://img.shields.io/badge/Coverage-95%25-brightgreen.svg)](#testing)

Un sistema de gestión de presupuestos desarrollado en Go siguiendo principios de Clean Architecture, diseñado para ser escalable, mantenible y observable.

## 🏗️ Arquitectura

Este proyecto implementa **Clean Architecture** con las siguientes capas:

- **Domain**: Entidades de negocio y reglas de dominio
- **Services**: Casos de uso y lógica de aplicación
- **Platform**: Infraestructura (DB, HTTP, storage)
- **Handlers**: Controladores HTTP y transport layer

### Stack Tecnológico

- **Framework**: Gin (HTTP router)
- **Base de Datos**: PostgreSQL (producción), SQLite (tests)
- **Autenticación**: JWT
- **Testing**: Testify, SQLite in-memory
- **Logging**: Zerolog
- **Migrations**: golang-migrate
- **Containerización**: Docker & Docker Compose

## 🚀 Inicio Rápido

### Prerrequisitos

- Go 1.24+
- Docker & Docker Compose
- PostgreSQL (para producción)

### Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd GestorDePresupuesto/BackEnd
```

2. **Configurar variables de entorno**
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

3. **Levantar servicios con Docker**
```bash
docker-compose up -d
```

4. **Ejecutar migraciones**
```bash
go run main.go migrate
```

5. **Iniciar el servidor**
```bash
go run main.go
```

El servidor estará disponible en `http://localhost:8080`

## 📊 Funcionalidades

### Gestión de Usuarios
- Registro y autenticación
- Perfil de usuario
- JWT-based authentication

### Gestión de Cuentas
- Crear múltiples cuentas bancarias
- Ver balance actual
- Historial de movimientos

### Gestión de Transacciones
- Registrar ingresos y gastos
- Categorización de transacciones
- Filtros y búsquedas

### Gestión de Presupuestos
- Crear presupuestos por categoría
- Seguimiento de gastos vs presupuesto
- Alertas de límites

### Gestión de Inversiones
- Registrar inversiones
- Seguimiento de rendimiento
- Portfolio management

### Gestión de Categorías
- Categorías personalizadas
- Iconos y colores
- Organización jerárquica

## 🛠️ API Endpoints

### Autenticación
```
POST   /login              # Iniciar sesión
POST   /user               # Registrar usuario
GET    /profile            # Obtener perfil
```

### Cuentas
```
POST   /account            # Crear cuenta
GET    /account            # Listar cuentas
DELETE /account/:id        # Eliminar cuenta
```

### Transacciones
```
POST   /transaction        # Crear transacción
GET    /transaction/:id    # Obtener por cuenta
GET    /transaction        # Listar todas
DELETE /transaction/:id    # Eliminar transacción
```

### Presupuestos
```
POST   /budget             # Crear presupuesto
GET    /budget             # Listar presupuestos
DELETE /budget/:id         # Eliminar presupuesto
```

### Categorías
```
POST   /category           # Crear categoría
GET    /category           # Listar categorías
DELETE /category/:id       # Eliminar categoría
```

### Inversiones
```
POST   /invesment          # Crear inversión
GET    /invesment          # Listar inversiones
DELETE /invesment/:id      # Eliminar inversión
```

## 🧪 Testing

### Ejecutar Tests

```bash
# Todos los tests
go test ./...

# Tests con coverage
go test -cover ./...

# Tests específicos
go test ./src/internals/services/... -v

# Tests de integración
go test ./src/internals/platform/storage/... -v
```

### Cobertura de Tests

- **Services**: 95%+ cobertura con mocks
- **Repositories**: Tests de integración con SQLite
- **Handlers**: Tests end-to-end
- **Utilities**: Tests unitarios completos

### Estrategia de Testing

- **Unit Tests**: Para lógica de negocio con mocks
- **Integration Tests**: Para repositories con SQLite in-memory
- **Performance Tests**: Benchmarks para operaciones críticas

## 🏃‍♂️ Desarrollo

### Estructura del Proyecto

```
BackEnd/
├── src/
│   ├── cmd/api/           # Application entrypoint
│   ├── config/            # Configuration management
│   └── internals/
│       ├── domain/        # Business entities
│       ├── services/      # Use cases & business logic
│       └── platform/      # Infrastructure layer
│           ├── dto/       # Data transfer objects
│           ├── server/    # HTTP transport
│           ├── storage/   # Database layer
│           └── utils/     # Shared utilities
├── httpRequest/           # HTTP test files
├── docker-compose.yaml    # Development environment
└── dockerfile            # Container definition
```

### Convenciones de Código

- **Naming**: PascalCase para exportados, camelCase para internos
- **Errors**: Wrapping con context (`fmt.Errorf("operation: %w", err)`)
- **Interfaces**: Pequeñas y específicas
- **Context**: Propagación en todas las operaciones
- **Testing**: Table-driven tests con parallel execution

### Contribuir

1. Fork el repositorio
2. Crear feature branch (`git checkout -b feature/nueva-funcionalidad`)
3. Escribir tests para nueva funcionalidad
4. Implementar con cobertura 95%+
5. Ejecutar linting (`golangci-lint run`)
6. Commit con mensaje descriptivo
7. Push y crear Pull Request

## 🔧 Configuración

### Variables de Entorno

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=my_store
DB_USER=osmait
DB_PASSWORD=admin123

# Server
SERVER_HOST=localhost
SERVER_PORT=8080

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRATION=24h

# Environment
ENV=development
```

### Docker Development

```bash
# Desarrollo con hot reload
docker-compose up app

# Solo base de datos
docker-compose up postgres

# Tests
docker-compose up testdb
```

## 📈 Performance

### Optimizaciones Implementadas

- **Database**: Índices en campos frecuentemente consultados
- **Memory**: Pool de conexiones configurado
- **Testing**: SQLite in-memory (3-5x más rápido)
- **HTTP**: Gin con middleware optimizado

### Benchmarks

```bash
# Ejecutar benchmarks
go test -bench=. ./...

# Profiling
go test -cpuprofile=cpu.prof -memprofile=mem.prof -bench=.
```

## 🔐 Seguridad

### Medidas Implementadas

- JWT-based authentication
- Password hashing con bcrypt
- Input validation en endpoints
- SQL injection prevention
- CORS configurado

### Mejores Prácticas

- Secrets en variables de entorno
- Sanitización de inputs
- Rate limiting por IP
- Logging de eventos de seguridad

## 📚 Recursos Adicionales

- [CONTRIBUTING.md](CONTRIBUTING.md) - Guía de contribución
- [ARCHITECTURE.md](ARCHITECTURE.md) - Documentación de arquitectura
- [API Documentation](docs/api.md) - Documentación detallada de API

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

## 🤝 Soporte

- **Issues**: [GitHub Issues](https://github.com/username/repo/issues)
- **Documentación**: [Wiki del proyecto](https://github.com/username/repo/wiki)
- **Discusiones**: [GitHub Discussions](https://github.com/username/repo/discussions) 