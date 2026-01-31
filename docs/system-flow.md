# System Flow

How a request travels from an agent to a rendered mesh.

## Request Path

```
Agent sends MCP tool call: execute_commands
  │
  ▼
MCP Server (port 4242)
  │ Translates MCP tool call to HTTP POST
  ▼
Authoring Server (port 4200)
  │ POST /api/execute { commands: ["builder.run DiningChair seed=42"] }
  ▼
Command Parser
  │ Splits "builder.run DiningChair seed=42"
  │ → namespace: "builder", action: "run", args: {name: "DiningChair", seed: 42}
  ▼
Command Registry
  │ Routes to builder handler's "run" method
  ▼
Builder Handler
  │ 1. Loads YAML from storage: builders/DiningChair.yaml
  │ 2. Applies active overrides (decisions + measurements)
  │ 3. Delegates to YamlBuilderParser
  ▼
YamlBuilderParser
  │ Parses YAML sections:
  │ - decisions → TracedBuilder.decide() / decideNumber() / decideCount()
  │ - measurements → TracedBuilder.defineMeasurement()
  │ - derived → ExpressionService.evaluateNumeric()
  │ - geometry steps → TracedBuilder geometry methods
  │ - compose → recursive builder execution
  │ - placement → Placement engine
  ▼
TracedBuilder
  │ Executes with SeededRandom (fork-based hierarchy)
  │ Records every decision and measurement in trace
  │ Calls geometry engines for mesh creation
  ▼
Geometry Engines
  │ Extrude, Sweep, Lathe, Subdivision, MeshOperations
  │ Produce Mesh objects (vertices + faces)
  ▼
ValidationAPI
  │ Runs mesh checks + quality assessment
  │ Attaches results to output
  ▼
TracedOutput
  │ { mesh, decisions, measurements, traces, validation, metadata }
  ▼
Response flows back up:
  │ Builder Handler → Authoring Server → MCP Server → Agent
  │
  └──► WebSocket broadcast → Dashboard (real-time 3D preview)
```

## Composition Flow

When a builder composes sub-builders:

```
DiningScene.yaml
  │
  ├── compose.table → loads Table.yaml
  │   └── TracedBuilder executes Table
  │       └── mesh + decisions + traces
  │
  ├── compose.chairs → loads DiningChair.yaml (N times)
  │   ├── Placement engine determines positions
  │   ├── SharedContext carries parent decisions to children
  │   │   (e.g., all chairs inherit table_style from scene)
  │   └── Each chair: TracedBuilder → mesh + traces
  │
  └── Final assembly:
      ├── Merge meshes with transforms
      ├── Build SceneGraph (semantic tree with tags)
      └── Return composite TracedOutput
```

## Data That Flows Between Components

| From → To | Data | Purpose |
|-----------|------|---------|
| Agent → MCP | Tool calls (JSON) | Stable protocol |
| MCP → Authoring | HTTP POST commands | Batch DSL execution |
| Authoring → Storage | YAML read/write | Builder persistence |
| Authoring → Builder Engine | Parsed YAML + overrides | Builder execution |
| Builder Engine → Geometry | Shape specs (profiles, paths, params) | Mesh creation |
| Builder Engine → Validation | Mesh + quality target | Quality assessment |
| Builder Engine → Dashboard | TracedOutput via WebSocket | Real-time preview |
| Parent Builder → Child Builder | SharedContext + overrides | Style coordination |
| Builder Engine → Agent | TracedOutput (JSON) | Inspection & iteration |

## Ports & Protocols

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Authoring Server | 4200 | HTTP + WebSocket | Command execution, real-time sync |
| MCP Server | 4242 | stdio or HTTP | Agent integration |
| Dashboard | 3000 | HTTP (Vite dev) | 3D preview UI |
