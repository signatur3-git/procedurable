# Architecture Overview

> Stable MCP layer + extensible DSL for human-agent collaboration

## Design Principles

1. **MCP Stability**: Minimal tools that rarely change (avoids IDE restarts)
2. **DSL Extensibility**: New commands added to authoring server, not MCP
3. **Hot Reload**: Authoring server runs with `tsx watch`, changes instant
4. **Shared Vision**: User and agent see the same state via WebSocket
5. **Batch Efficiency**: One MCP call can execute many DSL commands
6. **Deterministic**: Same seed → identical output
7. **Traceable**: Every vertex links back to source definition
8. **Storage Agnostic**: Builders/assets stored via abstraction (filesystem or S3)

---

## Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  AI Agent (Copilot)                                                     │
│                                                                         │
│  Sends YAML with DSL command stack:                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ commands:                                                        │   │
│  │   - "builder.open DiningChair"                                   │   │
│  │   - "measurement.set seat_width 0.50"                            │   │
│  │   - "builder.run seed=42"                                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ MCP: execute_commands
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  MCP Server (Stable - port 4242)                                        │
│                                                                         │
│  Tools (rarely change):                                                 │
│  ├── ping              - Health check                                   │
│  ├── execute_commands  - Run YAML command batch                         │
│  ├── get_state         - Current state snapshot                         │
│  └── get_help          - List DSL commands (from authoring server)      │
│                                                                         │
│  Proxies DSL to Authoring Server                                        │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP POST /api/execute
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Authoring Server (Hot-reloadable - port 4200 or integrated)            │
│                                                                         │
│  DSL Command Handlers:                                                  │
│  ├── builder.*     - open, run, save, list                              │
│  ├── measurement.* - set, get, constrain                                │
│  ├── decision.*    - add, remove, override                              │
│  ├── loop.*        - create, extrude, loft                              │
│  ├── vertex.*      - create, move, attach                               │
│  ├── face.*        - create, subdivide                                  │
│  ├── curve.*       - bezier, arc, sample                                │
│  └── storage.*     - list, get, put, sync                               │
│                                                                         │
│  WebSocket broadcast on every command                                   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  Dashboard (Browser)     │    │  Storage Provider        │
│  ┌────────┬────────────┐ │    │                          │
│  │ Seed   │ Inspector  │ │    │  ┌────────────────────┐  │
│  │ Grid   │ Panels     │ │    │  │ FileSystemStorage  │  │
│  └────────┴────────────┘ │    │  │ (dev mode)         │  │
│  WebSocket updates       │    │  └────────────────────┘  │
└──────────────────────────┘    │  ┌────────────────────┐  │
                                │  │ S3Storage          │  │
                                │  │ (production)       │  │
                                │  └────────────────────┘  │
                                │                          │
                                │  Stores:                 │
                                │  - builders/*.yaml       │
                                │  - assets/grunge/        │
                                │  - assets/materials/     │
                                │  - baked/                │
                                └──────────────────────────┘
```

**See:** `docs/DEPLOYMENT_STORAGE.md` for full storage architecture.

---

## MCP Tools (Stable, Minimal)

Only 4 tools - almost never need to change:

| Tool | Description |
|------|-------------|
| `ping` | Health check |
| `execute_commands` | Execute YAML with DSL command stack |
| `get_state` | Current builder state, last run, open builders |
| `get_help` | List available DSL commands (dynamic from authoring server) |

### Legacy Tools (Transitional)

During migration, existing tools continue to work:
- `list_builders`, `run_builder`, `get_measurements`, `get_validation`, `list_traces`, `get_trace`

These will be deprecated once DSL equivalents are stable.

---

## DSL Command Format

```
<namespace>.<action> [<positional_args>...] [<key>=<value>...]
```

Examples:
```
builder.open DiningChair
builder.list
builder.run seed=42
builder.run seed=42 overrides={"seat_width":0.5}

measurement.set seat_width 0.50
measurement.get seat_width
measurement.constrain seat_width min=0.35 max=0.55

decision.override leg_style tapered
decision.clear_override leg_style
decision.add leg_style cabriole weight=2

loop.create seat_top rect width=seat_width depth=seat_depth
loop.extrude seat_top distance=-seat_thickness cap=true
```

---

## YAML Batch Format

```yaml
commands:
  - "builder.open DiningChair"
  - "measurement.set seat_width 0.50"
  - "decision.override leg_style tapered"
  - "builder.run seed=42"
  - "builder.run seed=43"
  - "builder.run seed=44"
```

Response:
```yaml
results:
  - command: "builder.open DiningChair"
    status: ok
    data: { name: "DiningChair", measurements: 15, decisions: 12 }
  - command: "measurement.set seat_width 0.50"
    status: ok
    data: { previous: 0.45, new: 0.50 }
  - command: "builder.run seed=42"
    status: ok
    data: { vertices: 76, faces: 43, issues: 0, traceCount: 66 }
```

---

## Authoring Server: Command Handler Pattern

```typescript
// src/authoring/commands/measurement.ts
export const measurementCommands: CommandHandler[] = [
  {
    pattern: "measurement.set <name> <value>",
    description: "Set a measurement value",
    execute: async (args, ctx) => {
      const { name, value } = args;
      const previous = ctx.builder.getMeasurement(name);
      ctx.builder.setMeasurement(name, parseFloat(value));
      ctx.broadcast({ type: 'measurement_changed', name, value });
      return { previous, new: parseFloat(value) };
    }
  }
];
```

New commands are added by creating new handler files - no MCP changes needed.

---

## WebSocket Protocol

### Server → Client
```json
{ "type": "command_executed", "command": "builder.run seed=42", "result": {...} }
{ "type": "measurement_changed", "name": "seat_width", "value": 0.50 }
{ "type": "builder_opened", "name": "DiningChair" }
```

### Client → Server (optional, for GUI actions)
```json
{ "type": "run_command", "command": "builder.run seed=5" }
```

---

## File Structure

```
src/
├── mcp/
│   └── http-server.ts        # Stable MCP (ping, execute_commands, get_state, get_help)
├── authoring/
│   ├── server.ts             # Express + WebSocket, hot-reloadable
│   ├── command-parser.ts     # DSL string → parsed args
│   ├── command-registry.ts   # Handler discovery + registration
│   └── commands/             # Command handlers (extensible)
│       ├── builder.ts
│       ├── measurement.ts
│       ├── decision.ts
│       ├── loop.ts
│       ├── vertex.ts
│       ├── face.ts
│       └── curve.ts
├── builder/
│   ├── TracedBuilder.ts      # Core infrastructure
│   └── ChairBuilder.ts       # Reference implementation
└── dashboard/
    ├── App.vue               # Main layout
    ├── SeedGrid.vue          # 3×3 render grid
    └── InspectorPanel.vue    # Measurements, decisions, traces
```

---

## Migration Path

### Phase 1: Add execute_commands to existing MCP
- Keep all 7 existing tools
- Add `execute_commands`, `get_state`, `get_help`
- Build authoring server with first DSL handlers

### Phase 2: Implement core DSL commands
- `builder.*` commands
- `measurement.*` commands
- `decision.*` commands

### Phase 3: Deprecate legacy tools
- Mark old tools as deprecated in descriptions
- All new agent workflows use DSL
- Eventually remove (major version bump)

---

## Benefits of This Design

1. **IDE Stability**: MCP schema frozen, no restarts for new commands
2. **Fast Iteration**: `tsx watch` on authoring server, instant reload
3. **Discoverability**: `get_help` returns all commands dynamically
4. **Batch Efficiency**: 50 commands in one MCP call
5. **Debugging**: DSL strings are human-readable in logs
6. **Consistency**: Same commands work from agent YAML or GUI buttons
