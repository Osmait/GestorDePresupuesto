# Guía de Desarrollo Local

Este documento describe cómo configurar y ejecutar el proyecto en modo desarrollo usando los comandos make disponibles.

## Comandos Make para Desarrollo

### 🚀 Comandos Principales

#### `make dev-setup`
**Configuración inicial del entorno de desarrollo** (primera vez)
```bash
make dev-setup
```
Este comando:
- Instala todas las dependencias de desarrollo
- Crea el archivo `.env` con configuración por defecto
- Inicia la base de datos PostgreSQL con Docker
- Ejecuta las migraciones de base de datos

#### `make dev-start`
**Iniciar desarrollo con base de datos**
```bash
make dev-start
```
Este comando:
- Inicia PostgreSQL con Docker Compose
- Espera a que la base de datos esté lista
- Inicia la aplicación Go con hot reload (Air)
- Configura variables de entorno automáticamente

#### `make dev-full`
**Iniciar entorno completo** (backend + frontend + database)
```bash
make dev-full
```
Este comando inicia todos los servicios:
- **Backend**: http://localhost:8080
- **Frontend**: http://localhost:4321
- **Database**: localhost:5432

### 🔧 Comandos de Gestión

#### `make dev-stop`
**Detener entorno de desarrollo**
```bash
make dev-stop
```

#### `make dev-restart`
**Reiniciar entorno de desarrollo**
```bash
make dev-restart
```

#### `make dev-logs`
**Ver logs del entorno de desarrollo**
```bash
make dev-logs
```

### 📋 Comandos de Configuración

#### `make dev-env`
**Crear archivo .env para desarrollo**
```bash
make dev-env
```
Crea un archivo `.env` con la configuración por defecto para desarrollo.

#### `make migrate`
**Ejecutar migraciones de base de datos**
```bash
make migrate
```

#### `make dev-reset-db`
**Resetear base de datos** (⚠️ PELIGROSO - solo desarrollo)
```bash
make dev-reset-db
```
Este comando:
- Elimina todos los datos de la base de datos
- Recrea la base de datos desde cero
- Ejecuta las migraciones

## Flujo de Trabajo Típico

### Primera vez (configuración inicial)
```bash
# 1. Configurar entorno de desarrollo
make dev-setup

# 2. Iniciar desarrollo
make dev-start
```

### Desarrollo diario
```bash
# Iniciar desarrollo
make dev-start

# En otra terminal, ver logs si es necesario
make dev-logs

# Al terminar
make dev-stop
```

### Desarrollo con frontend
```bash
# Iniciar entorno completo
make dev-full

# Al terminar
make dev-stop
```

## Servicios y Puertos

| Servicio | Puerto | URL |
|----------|--------|-----|
| Backend API | 8080 | http://localhost:8080 |
| Frontend | 4321 | http://localhost:4321 |
| PostgreSQL | 5432 | localhost:5432 |
| PostgreSQL Test | 5433 | localhost:5433 |

## Configuración de Base de Datos

### Desarrollo
- **Host**: localhost
- **Puerto**: 5432
- **Base de datos**: my_store
- **Usuario**: osmait
- **Contraseña**: admin123

### Testing
- **Host**: localhost
- **Puerto**: 5433
- **Base de datos**: test
- **Usuario**: test
- **Contraseña**: test

## Variables de Entorno

Las variables principales para desarrollo se configuran automáticamente:

```bash
ENV=development
SERVER_HOST=localhost
SERVER_PORT=8080
DB_HOST=localhost
DB_PORT=5432
DB_USER=osmait
DB_PASSWORD=admin123
DB_NAME=my_store
DB_TYPE=postgres
JWT_SECRET=your-secret-key-for-development-only
ENABLE_METRICS=true
ENABLE_TRACING=true
ENABLE_DEBUG_MODE=true
LOG_LEVEL=debug
LOG_FORMAT=console
```

## Hot Reload con Air

La aplicación usa [Air](https://github.com/cosmtrek/air) para hot reload:

- **Archivos monitoreados**: `*.go`, `*.html`, `*.tmpl`
- **Archivos excluidos**: `*_test.go`
- **Directorio temporal**: `tmp/`
- **Log de errores**: `build-errors.log`

## Comandos Adicionales

### Herramientas de Desarrollo
```bash
# Instalar dependencias de desarrollo
make dev-deps

# Formatear código
make fmt

# Ejecutar linting
make lint

# Ejecutar tests
make test

# Ejecutar tests con coverage
make test-coverage
```

### Calidad de Código
```bash
# Análisis de seguridad
make security

# Verificar vulnerabilidades
make vuln-check

# Compilar para producción
make build-prod
```

## Troubleshooting

### Puerto ya en uso
```bash
# Verificar qué proceso usa el puerto
lsof -i :8080

# Detener servicios Docker
make dev-stop
```

### Base de datos no responde
```bash
# Verificar estado de Docker
docker-compose ps

# Reiniciar base de datos
docker-compose restart postgres
```

### Problemas con migraciones
```bash
# Resetear base de datos (elimina todos los datos)
make dev-reset-db
```

### Limpiar archivos temporales
```bash
# Limpiar archivos de build
make clean

# Limpiar archivos de Air
rm -rf tmp/ build-errors.log
```

## Consejos

1. **Usa `make dev-setup` solo la primera vez** para configurar el entorno
2. **Usa `make dev-start` para desarrollo diario** (solo backend + database)
3. **Usa `make dev-full` cuando necesites frontend** también
4. **Revisa los logs** con `make dev-logs` si algo no funciona
5. **El hot reload funciona automáticamente** - solo guarda tus cambios en Go 