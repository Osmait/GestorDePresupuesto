# API Directory (api/)

## Purpose

This directory contains **API definitions and schemas** such as:

- OpenAPI/Swagger specifications
- Protocol buffer definitions (.proto files)
- GraphQL schemas
- API documentation
- Contract definitions

## Guidelines

- **Version Control**: Use versioning for API definitions (v1, v2, etc.)
- **Documentation**: Keep API docs up-to-date with implementation
- **Validation**: Include request/response validation schemas
- **Examples**: Provide clear usage examples

## Structure Examples

```
api/
├── openapi/          # OpenAPI/Swagger specifications
│   ├── v1/
│   │   ├── budget.yaml
│   │   ├── auth.yaml
│   │   └── users.yaml
│   └── v2/
├── proto/            # Protocol buffer definitions
│   └── v1/
├── graphql/          # GraphQL schemas
│   └── schema.graphql
└── docs/             # Additional API documentation
```

## Integration

These definitions can be used to:

- Generate client SDKs
- Validate requests/responses
- Generate documentation
- Mock services for testing
- Contract testing

## Current Status

This directory is ready for API definitions. The current REST API implementation is in `internal/platform/server/` and could benefit from formal OpenAPI specifications. 