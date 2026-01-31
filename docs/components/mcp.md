# MCP Server

The stable, minimal shell that gives AI agents access to Procedurable.

## Design Philosophy

The MCP server is **intentionally thin**. It exposes exactly 4 tools and delegates everything to the Authoring Server. This means:

- MCP protocol integration rarely needs changes
- All new capabilities automatically appear via `execute_commands`
- Agent tooling stays stable even as the platform evolves

## Tools [exists]

### `ping`
Health check. Returns server status.

### `execute_commands`
Batch DSL command execution. This is the primary tool agents use.

```json
{
  "commands": [
    "builder.open DiningChair",
    "decision.override back_style solid",
    "builder.run seed=42",
    "builder.quality"
  ]
}
```

Returns results for each command. Agents send multi-step workflows in a single tool call.

### `get_state`
Snapshot of current server state:
- Active builder name
- Current overrides
- Last run result summary
- Available builders

### `get_help`
List all available DSL commands with descriptions. Agents use this for self-discovery.

## Transports [exists]

| Transport | File | Use Case |
|-----------|------|----------|
| stdio | `server.ts` | Standard MCP (Claude Desktop, CLI) |
| HTTP | `http-server.ts` | IDE integration (Copilot, web clients) |
| Minimal | `minimal-server.ts` | Lightweight/embedded use |

## Agent Interaction Pattern

```
Agent                          MCP                    Authoring
  │                             │                        │
  ├── get_help ────────────────►│                        │
  │◄── command list ────────────┤                        │
  │                             │                        │
  ├── execute_commands ────────►│── POST /api/execute ──►│
  │   ["builder.list"]         │                        │── list YAML files
  │◄── builder names ──────────┤◄── results ────────────┤
  │                             │                        │
  ├── execute_commands ────────►│── POST /api/execute ──►│
  │   ["builder.open Chair",   │                        │── load + execute
  │    "builder.run seed=1"]   │                        │
  │◄── traced output ──────────┤◄── results ────────────┤
  │                             │                        │
  ├── (agent reasons about     │                        │
  │    output, decides to      │                        │
  │    modify)                 │                        │
  │                             │                        │
  ├── execute_commands ────────►│── POST /api/execute ──►│
  │   ["decision.override      │                        │── re-run with
  │     back_style ladder",    │                        │   override
  │    "builder.run seed=1"]   │                        │
  │◄── new traced output ──────┤◄── results ────────────┤
```

## Target State

The MCP server itself needs minimal changes. Its power grows as the Authoring Server adds commands. Key upcoming capabilities (accessed through `execute_commands`):

- Builder creation and editing [B4]
- Quality validation with tier gates [A2]
- Scene description save/load [B2]
- World metadata read/write [B3]
- glTF export [C6]
