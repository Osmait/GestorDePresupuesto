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
POST   /investment          # Crear inversión
GET    /investment          # Listar inversiones
DELETE /investment/:id      # Eliminar inversión
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
SERVER_READ_HEADER_TIMEOUT=10s   # slowloris protection
SERVER_READ_TIMEOUT=60s          # headers + body (AI uploads)
SERVER_WRITE_TIMEOUT=120s        # SSE endpoints clear their own deadline
SERVER_IDLE_TIMEOUT=120s

# Client IP / reverse proxy (default: trust nobody -> TCP peer IP is the client IP)
TRUSTED_PROXIES=                 # comma-separated IPs/CIDRs whose X-Forwarded-For is trusted
TRUSTED_PLATFORM_HEADER=         # header set by the platform edge, e.g. X-Real-IP (Railway)
PROXY_SHARED_SECRET=             # >= 32 chars in production; same value on the frontend (see below)

# CORS (Bearer-token API: credentials not needed)
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4321,http://localhost:8080
CORS_ALLOW_CREDENTIALS=false

# JWT
JWT_SECRET=your-secret-key       # >= 32 chars, required outside development/test
JWT_EXPIRATION=15m               # access token lifetime (also used by legacy /login)
JWT_REFRESH_EXPIRATION=168h
JWT_ISSUER=gestor-de-presupuesto
JWT_AUDIENCE=gestor-de-presupuesto-api
JWT_REFRESH_REUSE_GRACE=30s      # re-presenting a just-rotated refresh token -> 401 without revoking all sessions

# Login brute-force protection (per email + client IP, in memory)
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCK_TIME=15m

# WebAuthn ceremony sessions are stored in Postgres (webauthn_sessions)
WEBAUTHN_CHALLENGE_TTL=5m

# Environment
ENV=development
```

#### Producción (Railway)

- `CORS_ALLOWED_ORIGINS`: origen(es) exactos del frontend, p. ej. `https://app.tudominio.com`. El comodín `*` se rechaza en producción.
- `TRUSTED_PLATFORM_HEADER=X-Real-IP` (el edge de Railway lo fija con la IP real del cliente). Alternativa: `TRUSTED_PROXIES` con el rango de la red privada del proxy. Sin ninguno de los dos, todos los clientes comparten la IP del proxy para rate limiting y bloqueo de login.
- `PROXY_SHARED_SECRET` aleatorio de 32+ caracteres (p. ej. `openssl rand -base64 48`), con **el mismo valor** en el backend (Railway) y en el frontend (Vercel). El navegador nunca llama al backend directamente: el proxy `/api/backend/*`, los Server Components y next-auth lo llaman desde los servidores de Vercel, así que sin este secreto todos los usuarios comparten la IP de salida de Vercel para rate limiting (`/auth/demo`, bloqueo de login). El frontend envía la IP del navegador en `X-Client-IP` junto con el secreto en `X-Proxy-Secret`; el backend solo acepta `X-Client-IP` si el secreto coincide (comparación en tiempo constante) y, si no, usa `TRUSTED_PLATFORM_HEADER`/IP del peer (sin rechazar la petición: el servidor MCP y otros clientes directos no lo envían). Ambas cabeceras se eliminan de la petición antes del resto de middlewares, así que nunca se registran. En el frontend solo debe configurarse donde el edge de la plataforma sobrescribe `x-real-ip`/`x-forwarded-for` (Vercel lo hace).
- `JWT_SECRET` aleatorio de 32+ caracteres; `JWT_ISSUER`/`JWT_AUDIENCE` deben coincidir entre todas las instancias. Tokens emitidos sin `iss`/`aud` son rechazados.

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