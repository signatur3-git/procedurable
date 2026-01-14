# Changelog

All notable changes to the Procedurable MCP API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-14

### 🎉 Initial Stable Release

First stable release of the Procedurable MCP API.

### Added

#### Core Infrastructure
- **MCP Server** (`npm run mcp:http`) - HTTP/SSE transport for Copilot integration
- **Authoring Server** (`npm run authoring`) - DSL command execution engine
- **Dashboard** (`npm run dev`) - Visual builder preview with 3D rendering

#### DSL Command Namespaces

| Namespace | Commands | Description |
|-----------|----------|-------------|
| `system` | version, ping, help, status | System info and health checks |
| `builder` | list, open, run, mesh, measurements, decisions, traces, trace | Builder management |
| `measurement` | list, get, set, reset, reset-all | Measurement inspection/override |
| `decision` | list, get, override, reset, reset-all | Decision inspection/override |
| `storage` | list, get, save, delete, exists | YAML builder storage |
| `math` | eval, validate, functions, constants | Expression evaluation |

#### YAML Builder System
- Full YAML builder definition format
- Expression engine with MathService (sin, cos, pi, etc.)
- Control flow: `repeat` and `if/else` constructs
- Composition: Sub-builder nesting with overrides
- Pre-loading cache for nested composition

#### Migrated Builders (TypeScript → YAML)
- `Table.yaml` - Rectangular and round dining tables
- `DiningChair.yaml` - Full-featured dining chair
- `DiningScene.yaml` - Table with 4 chairs composition
- `Leg.yaml` - Reusable furniture leg component

### Documentation
- `docs/DSL_COMMANDS.md` - Complete command reference
- `docs/DEPRECATION_POLICY.md` - API stability guarantees
- `docs/YAML_BUILDER_FORMAT.md` - YAML schema specification
- `docs/MCP_SETUP.md` - Integration setup guide

### Testing
- 29 integration tests covering all DSL commands
- Run with: `npm run test:integration`

---

## [Unreleased]

### Planned for v1.1.0
- Dynamic composition count (repeat in compose section)
- Conditional composition (if/else for sub-builders)
- Output parity verification tools

### Planned for v2.0.0 (Phase 2)
- Advanced geometry primitives (icosphere, lathe, limb segments)
- Procedural materials system
- PersonBuilder YAML migration

