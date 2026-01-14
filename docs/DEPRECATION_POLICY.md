# MCP API Deprecation Policy

> Version: 1.0.0
> Date: 2026-01-14

## Overview

This document defines how we handle changes to the MCP API to ensure stability for agents and integrations.

---

## Versioning Scheme

We use **Semantic Versioning** (SemVer):

```
MAJOR.MINOR.PATCH
  │     │     └── Bug fixes, no API changes
  │     └──────── New features, backward compatible
  └────────────── Breaking changes
```

**Current Version**: `1.0.0`

---

## API Stability Guarantees

### Stable (v1.0+)

| Category | Guarantee |
|----------|-----------|
| **Command names** | Will not change without deprecation period |
| **Required parameters** | Will not change without deprecation period |
| **Response structure** | Fields will not be removed without deprecation |
| **Error codes** | Will remain stable |

### Experimental

Commands prefixed with `x_` or documented as experimental may change without notice.

---

## Deprecation Process

### 1. Announcement (MINOR version bump)

When deprecating a feature:
- Add `deprecated: true` to command response
- Add `deprecationMessage` with migration guidance
- Document in CHANGELOG.md
- Keep feature fully functional

```json
{
  "command": "old.command",
  "status": "ok",
  "deprecated": true,
  "deprecationMessage": "Use 'new.command' instead. Will be removed in v2.0.0",
  "data": { ... }
}
```

### 2. Deprecation Period

- **Minimum**: 2 minor versions OR 3 months (whichever is longer)
- Deprecated features continue to work normally
- Warnings appear in responses

### 3. Removal (MAJOR version bump)

- Feature removed in next major version
- Document migration path in CHANGELOG.md
- Update DSL_COMMANDS.md

---

## Change Categories

### Non-Breaking (MINOR/PATCH)

✅ Safe to do anytime:
- Adding new commands
- Adding new optional parameters
- Adding new fields to responses
- Bug fixes that don't change behavior
- Performance improvements
- Documentation updates

### Breaking (requires MAJOR version)

⚠️ Requires deprecation period:
- Removing commands
- Renaming commands
- Removing response fields
- Changing parameter requirements (required → optional is OK)
- Changing response structure
- Changing error codes

---

## Command Lifecycle

```
┌──────────────┐
│  Proposed    │  RFC or implementation in progress
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Experimental │  Prefixed with x_, may change
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Stable     │  Fully supported, deprecation required
└──────┬───────┘
       │ (deprecation announced)
       ▼
┌──────────────┐
│ Deprecated   │  Still works, migration guidance provided
└──────┬───────┘
       │ (major version bump)
       ▼
┌──────────────┐
│   Removed    │  No longer available
└──────────────┘
```

---

## Current Command Status

### Stable (v1.0.0)

| Namespace | Commands | Status |
|-----------|----------|--------|
| `builder` | list, open, run, mesh, measurements, decisions, traces, trace | ✅ Stable |
| `measurement` | list, get, set, reset, reset-all | ✅ Stable |
| `decision` | list, get, override, reset, reset-all | ✅ Stable |
| `storage` | list, get, save, delete, exists | ✅ Stable |
| `math` | eval, validate, functions, constants | ✅ Stable |
| `system` | version, ping, help, status | ✅ Stable |

### None Currently Deprecated

No commands are currently deprecated.

---

## Changelog

### v1.0.0 (2026-01-14)

**Initial stable release**

- All DSL commands finalized
- YAML builder support complete
- MathService for expressions
- Full documentation

---

## For Integrators

### Checking Version

```
system.version
→ { "version": "1.0.0", "apiVersion": "1.0", "protocol": "mcp-v1" }
```

### Handling Deprecations

1. Check `deprecated` field in responses
2. Log warnings for deprecated command usage
3. Plan migration before next major version
4. Test against new commands before switching

### Reporting Issues

If a breaking change is made without proper deprecation:
1. File an issue referencing this policy
2. Include the command and expected behavior
3. We will either revert or fast-track deprecation

---

## Questions?

See `docs/DSL_COMMANDS.md` for current command documentation.
See `docs/MCP_SETUP.md` for integration setup.

