# 📋 Reglas de Código - Gestor de Presupuesto

Este documento detalla las reglas de código aplicadas al proyecto siguiendo las mejores prácticas para ReactJS, NextJS, Redux, TypeScript, JavaScript, HTML, CSS, y frameworks de UI.

## 🎯 Filosofía de Desarrollo

- Escribir código limpio, mantenible y escalable
- Seguir principios SOLID
- Preferir patrones funcionales y declarativos sobre imperativos
- Enfatizar type safety y análisis estático
- Practicar desarrollo dirigido por componentes

## 📝 Reglas de Estilo de Código

### ✨ Formato General

- **Indentación**: Usar tabs (no espacios)
- **Comillas**: Single quotes (`'`) en lugar de double quotes (`"`)
- **Semicolons**: Omitir semicolons (excepto cuando sean requeridos para evitar ambigüedad)
- **Variables sin usar**: Eliminar variables no utilizadas
- **Espacios**: Agregar espacio después de keywords y antes de paréntesis en declaraciones de función
- **Igualdad**: Siempre usar strict equality (`===`) en lugar de loose equality (`==`)
- **Operadores infix**: Espaciar operadores infix
- **Comas**: Agregar espacio después de comas
- **Else statements**: Mantener else statements en la misma línea que las llaves de cierre
- **If statements**: Usar llaves para if statements multilinea
- **Trailing commas**: Usar trailing commas en literales de objeto/array multilinea
- **Longitud de línea**: Limitar a 80 caracteres

### 📁 Convenciones de Nombres

#### PascalCase para:
- Componentes (`UserProfile`, `LoginForm`)
- Definiciones de tipos (`UserType`, `ApiResponse`)
- Interfaces (`IUserRepository`, `IApiClient`)

#### kebab-case para:
- Nombres de directorios (`components/auth-wizard`)
- Nombres de archivos (`user-profile.tsx`, `auth-service.ts`)

#### camelCase para:
- Variables (`userName`, `isLoading`)
- Funciones (`getUserData`, `handleSubmit`)
- Métodos (`fetchUsers`, `updateProfile`)
- Hooks (`useAuth`, `useLocalStorage`)
- Propiedades (`firstName`, `createdAt`)
- Props (`onSubmit`, `initialValue`)

#### UPPERCASE para:
- Variables de entorno (`DATABASE_URL`, `API_KEY`)
- Constantes (`MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEOUT`)
- Configuraciones globales (`CACHE_DURATION`)

#### Patrones Específicos
- **Event handlers**: Prefijo 'handle' (`handleClick`, `handleSubmit`)
- **Boolean variables**: Prefijo con verbos (`isLoading`, `hasError`, `canSubmit`)
- **Custom hooks**: Prefijo 'use' (`useAuth`, `useForm`)
- **Abreviaciones permitidas**: `err` (error), `req` (request), `res` (response), `props` (properties), `ref` (reference)

## ⚛️ Mejores Prácticas de React

### 🏗️ Arquitectura de Componentes

```typescript
// ✅ Correcto - Function declaration
export default function UserProfile({ userId }: UserProfileProps) {
	const [user, setUser] = useState<User | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	
	const handleSubmit = (data: FormData) => {
		// Lógica del handler
	}
	
	return (
		<div>
			{/* JSX */}
		</div>
	)
}

// ❌ Incorrecto - Arrow function
const UserProfile = ({ userId }: UserProfileProps) => {
	// ...
}
```

### 🎪 Optimización de Performance

- Usar `useCallback` para memoizar funciones callback
- Implementar `useMemo` para cálculos costosos
- Evitar definiciones de función inline en JSX
- Implementar code splitting usando dynamic imports
- Usar proper key props en listas (evitar usar index como key)
- Usar `React.memo()` estratégicamente

## 🔄 Next.js Best Practices

### 🧩 Conceptos Core

- Utilizar App Router para routing
- Implementar proper metadata management
- Usar estrategias de caching apropiadas
- Implementar proper error boundaries

### 🏗️ Componentes y Features

- Usar componentes built-in de Next.js:
  - `Image` component para imágenes optimizadas
  - `Link` component para navegación client-side
  - `Script` component para scripts externos
  - `Head` component para metadata

### 🖥️ Server Components

- **Por defecto**: Server Components
- **URL query parameters** para data fetching y server state management
- **'use client'** solo cuando sea necesario:
  - Event listeners
  - Browser APIs
  - State management
  - Client-side-only libraries

## 📘 Implementación de TypeScript

```typescript
// ✅ Configuración requerida
{
	"compilerOptions": {
		"strict": true,
		// ... otras opciones
	}
}
```

### 🎯 Mejores Prácticas

- Definir interfaces claras para component props, state, y Redux state structure
- Usar type guards para manejar valores potentially undefined o null safely
- Aplicar generics a funciones, actions, y slices donde se necesite flexibilidad de tipos
- Utilizar TypeScript utility types (`Partial`, `Pick`, `Omit`) para código más limpio y reutilizable
- Preferir `interface` sobre `type` para definir estructuras de objeto, especialmente cuando se extienden
- Usar mapped types para crear variaciones de tipos existentes dinámicamente

## 🎨 UI y Styling

### 📚 Component Libraries

- **Shadcn UI** para diseño de componentes consistente y accesible
- **Radix UI primitives** para elementos UI customizables y accesibles
- Aplicar patrones de composición para crear componentes modulares y reutilizables

### 🎭 Guidelines de Styling

- **Tailwind CSS** para styling utility-first y mantenible
- Diseñar con principios mobile-first y responsive para flexibilidad across devices
- Implementar dark mode usando CSS variables o features de dark mode de Tailwind
- Asegurar ratios de contraste de color que cumplan standards de accesibilidad
- Mantener valores de spacing consistentes para establecer armonía visual
- Definir CSS variables para theme colors y spacing para soportar theming fácil y maintainability

## 🔧 Herramientas de Automatización

### 📜 Scripts Disponibles

```bash
# Aplicar todas las reglas automáticamente
npm run apply-rules

# Formatear código con Prettier
npm run format

# Verificar formato sin cambios
npm run format:check

# Ejecutar linting con ESLint
npm run lint

# Corregir errores de linting automáticamente  
npm run lint:fix

# Verificar tipos con TypeScript
npm run type-check

# Ejecutar todas las verificaciones de calidad
npm run code-quality
```

### ⚙️ Configuración de Herramientas

#### ESLint (`.eslintrc.js`)
- Enforces naming conventions
- Code style rules
- React best practices
- TypeScript rules
- Next.js specific rules

#### Prettier (`.prettierrc.js`)
- Code formatting consistency
- Tab-based indentation
- Single quotes
- No semicolons
- Trailing commas

## 🚀 Uso en el Proyecto

### 1. Aplicar Reglas Automáticamente

```bash
npm run apply-rules
```

Este script:
- Convierte double quotes a single quotes
- Elimina semicolons innecesarios
- Cambia indentación de espacios a tabs
- Aplica formato con Prettier

### 2. Verificar Calidad de Código

```bash
npm run code-quality
```

Este comando ejecuta:
- Type checking con TypeScript
- Linting con ESLint
- Format checking con Prettier

### 3. Durante Desarrollo

```bash
# Ejecutar en modo watch para auto-format
npm run format -- --watch

# Auto-fix linting issues
npm run lint:fix
```

## 📊 Estado de Aplicación de Reglas

### ✅ Completado

- [x] TypeScript strict mode habilitado
- [x] Configuración de ESLint
- [x] Configuración de Prettier
- [x] Scripts de automatización
- [x] Documentación de reglas

### 🔄 En Progreso

- [ ] Aplicación completa de single quotes
- [ ] Eliminación de semicolons en todo el proyecto
- [ ] Conversión a tabs en toda la codebase
- [ ] Actualización de function declarations

### 📋 Pendiente

- [ ] Verificación de naming conventions
- [ ] Validación de React best practices
- [ ] Verificación de Next.js conventions

## 🔧 Troubleshooting

### Problema: ESLint errors después de aplicar reglas

**Solución:**
```bash
npm run lint:fix
```

### Problema: Prettier conflicts con ESLint

**Solución:**
Las configuraciones están sincronizadas, pero si hay conflictos:
```bash
npm run format
npm run lint:fix
```

### Problema: TypeScript errors

**Solución:**
```bash
npm run type-check
```

## 📚 Referencias

- [React Best Practices](https://react.dev/learn)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [Prettier Configuration](https://prettier.io/docs/en/configuration.html)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs) 