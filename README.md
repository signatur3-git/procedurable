# Procedurable

**An authoring system where AI agents co-author BUILDERS that generate 3D models.**

## Overview

Procedurable is an MCP-enabled authoring system for procedural 3D content generation.
AI agents interact via MCP tools, humans use the visual dashboard - both see the same state in real-time.

**Key insight:** Agents don't modify models directly. They modify **YAML builder definitions** that generate models.

---

## Quick Start

### 1. Start Servers

```bash
npm install

# Terminal 1: Authoring server (DSL commands)
npm run authoring

# Terminal 2: MCP server (for Copilot)
npm run mcp:http

# Terminal 3: Dashboard (visual preview)
npm run dev
```

### 2. Configure Copilot MCP

Add to `C:\Users\<you>\AppData\Local\github-copilot\intellij\mcp.json`:
```json
{ "servers": { "procedurable": { "url": "http://127.0.0.1:4242/mcp" } } }
```

### 3. Open Dashboard

Browser opens at `http://localhost:3000` with 3D builder preview.

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  AI Agent       │     │  Human          │
│  (Copilot)      │     │  (Dashboard)    │
└────────┬────────┘     └────────┬────────┘
         │ MCP (4242)            │ WebSocket (4200)
         ▼                       ▼
┌─────────────────────────────────────────┐
│      Authoring Server (4200)            │
│  ┌──────────┐  ┌──────────┐  ┌───────┐  │
│  │ builder  │  │ decision │  │ math  │  │
│  │ storage  │  │ measure  │  │ system│  │
│  └──────────┘  └──────────┘  └───────┘  │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  YAML Builders (builders/*.yaml)        │
│  Table, DiningChair, DiningScene, Leg   │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  TracedBuilder → 3D Mesh                │
└─────────────────────────────────────────┘
```

---

## DSL Commands (32 total)

| Namespace | Commands |
|-----------|----------|
| `system` | version, ping, help, status |
| `builder` | list, open, run, mesh, measurements, decisions, traces, trace |
| `measurement` | list, get, set, reset, reset-all |
| `decision` | list, get, override, reset, reset-all |
| `storage` | list, get, save, delete, exists |
| `math` | eval, validate, functions, constants |

See [docs/DSL_COMMANDS.md](docs/DSL_COMMANDS.md) for full reference.

---

## Project Structure

```
procedurable/
├── builders/              # YAML builder definitions
│   ├── Table.yaml         # Rectangular + round tables
│   ├── DiningChair.yaml   # Full-featured chair
│   ├── DiningScene.yaml   # Table + 4 chairs composition
│   └── Leg.yaml           # Reusable furniture leg
├── src/
│   ├── authoring/         # DSL command server
│   ├── builder/           # TracedBuilder, YAML parser
│   ├── core/              # Vec3, Mat4, MathService
│   ├── dashboard/         # Visual preview UI
│   ├── geometry/          # Mesh, Face, EdgeLoop
│   ├── mcp/               # MCP HTTP server
│   ├── storage/           # FileSystem storage
│   ├── tests/             # Integration tests
│   └── validation/        # Mesh validation
├── docs/                  # Documentation
├── dashboard.html         # Dashboard entry point
└── package.json
```

---

## Documentation

- [MCP Setup](MCP_SETUP.md) - Integration setup guide
- [DSL Commands](docs/DSL_COMMANDS.md) - Complete command reference
- [YAML Builder Format](docs/YAML_BUILDER_FORMAT.md) - Builder definition schema
- [Master Plan](docs/MASTER_PLAN.md) - Roadmap and milestones
- [Deprecation Policy](docs/DEPRECATION_POLICY.md) - API stability guarantees
- [Changelog](CHANGELOG.md) - Version history

---

## Current Version

**v1.0.0** - MCP API stable, YAML builders complete for furniture domain.

See [CHANGELOG.md](CHANGELOG.md) for details.

---

## License

MIT
