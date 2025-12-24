# Package Directory (pkg/)

## Purpose

This directory contains **public packages** that can be imported by external applications. These are libraries and utilities that are designed to be reusable across multiple projects.

## Guidelines

- **Public API**: Code here should have a stable, well-documented public API
- **Backward Compatibility**: Changes should maintain backward compatibility
- **Minimal Dependencies**: Avoid heavy dependencies that would burden consumers
- **Good Documentation**: Include comprehensive godoc comments

## Examples

```
pkg/
├── validator/        # Custom validation utilities
├── errors/           # Custom error types and utilities  
├── logger/           # Logging utilities
├── middleware/       # Reusable HTTP middleware
└── clients/          # External service clients
```

## Usage

```go
import "github.com/osmait/gestorDePresupuesto/pkg/validator"
import "github.com/osmait/gestorDePresupuesto/pkg/logger"
```

## Current Status

This directory is ready for public utilities when needed. Currently, most functionality is in `internal/` as it's specific to this application. 