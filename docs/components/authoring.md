# Authoring Server

The command routing layer — translates DSL commands into builder engine operations.

## Architecture [exists]

```
HTTP POST /api/execute
  │ { commands: ["builder.run DiningChair seed=42", "decision.list"] }
  ▼
Command Parser
  │ "builder.run DiningChair seed=42"
  │ → { namespace: "builder", action: "run", args: "DiningChair seed=42" }
  ▼
Command Registry
  │ Looks up handler for namespace "builder"
  │ Calls handler.run(parsedArgs, context)
  ▼
Handler executes, returns result
  │
  ▼
WebSocket broadcast to dashboard
```

Port: **4200** (HTTP + WebSocket)

## Command Namespaces [exists]

| Namespace | Commands | Purpose |
|-----------|----------|---------|
| `builder` | open, run, list, measurements, decisions, traces, trace, mesh, export_obj, export_glb, quality, coverage | Builder execution and inspection |
| `decision` | list, get, override, reset, reset-all | Pin/unpin decision values |
| `measurement` | list, get, set, reset, reset-all | Override measurement values |
| `math` | eval, validate, functions, constants | Expression testing |
| `storage` | list, get, save, delete, exists | Builder file I/O |
| `system` | version, ping, help, status | Server info |
| `material` | list, get, set | Material selection |
| `geometry` | box, sphere, lathe, sweep, extrude | Direct geometry creation |
| `text` | render | Text-to-shape |
| `scene` | list, get, place_around, place_along, fill_area, query_by_tag, get_bounds, list_prims, get_materials | Scene queries and placement |
| `world` | *(future)* | World metadata store |

## Global Server State

The authoring server maintains session state:

- **Active builder** — currently loaded builder name + source
- **Override maps** — decision and measurement overrides (persistent across runs)
- **Run history** — recent execution results
- **WebSocket clients** — connected dashboards
- **Webhook registry** — MCP reload notifications

This state means commands are contextual: `decision.override back_style solid` applies to whichever builder is currently active.

## Adding New Commands

To extend the platform with new capabilities:

1. Create a handler in `src/servers/authoring/handlers/`
2. Register the namespace in the command registry
3. Commands are immediately available via DSL (and therefore via MCP)

The authoring server hot-reloads in dev mode (`tsx watch`), so new commands are available without restart.

## Target State Additions

| Capability | Status | Impact |
|------------|--------|--------|
| `builder.create` command [B4] | Planned | Create new builder YAML from template via DSL |
| `builder.edit` command [B4] | Planned | Modify builder YAML sections via DSL (add decision, change geometry step) |
| `world.set` / `world.get` [B3] | Planned | Persistent metadata store for domain knowledge |
| `quality.validate` [A2] | Planned | Run tier-specific quality gates |
| `quality.coverage` [A3] | Planned | Test decision coverage |
| `export.gltf` [C6] | Planned | Export current scene as glTF |
| Undo/redo | Planned | Revert override changes |
| Command macros | Planned | Save and replay command sequences |
