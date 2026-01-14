# DSL Command Reference

> Procedurable Authoring API v1.0.0
> 
> This document describes all available DSL commands for the Procedurable authoring system.

## Overview

Commands are sent to the authoring server via HTTP POST to `/api/execute`:

```json
{
  "commands": [
    "builder.open DiningChair",
    "builder.run seed=42",
    "builder.measurements"
  ]
}
```

Response format:
```json
{
  "results": [
    { "command": "...", "status": "ok", "data": {...} },
    { "command": "...", "status": "error", "error": "..." }
  ]
}
```

---

## System Commands

System-level commands for version, health checks, and help.

### `system.version`

Get API version and info.

**Usage:** `system.version`

**Response:**
```json
{
  "version": "1.0.0",
  "apiVersion": "1.0",
  "protocol": "mcp-v1",
  "name": "Procedurable Authoring API",
  "releaseDate": "2026-01-14",
  "features": ["builder.*", "measurement.*", "decision.*", "storage.*", "math.*"]
}
```

### `system.ping`

Health check - returns pong.

**Usage:** `system.ping`

**Response:**
```json
{
  "message": "pong",
  "timestamp": 1768353600446
}
```

### `system.help`

List all available commands.

**Usage:** `system.help`

**Response:**
```json
{
  "namespaces": [
    {
      "name": "builder",
      "description": "Builder management commands",
      "commands": [
        { "usage": "builder.list", "description": "List all builders" },
        ...
      ]
    },
    ...
  ],
  "totalCommands": 25
}
```

### `system.status`

Get current system status.

**Usage:** `system.status`

**Response:**
```json
{
  "version": "1.0.0",
  "activeBuilder": "DiningChair",
  "activeBuilderSource": "yaml",
  "hasLastRun": true,
  "historyCount": 5,
  "measurementOverrides": 2,
  "decisionOverrides": 1
}
```

---

## Builder Commands

Commands for managing and running builders.

### `builder.list`

List all available builders (TypeScript + YAML).

**Usage:** `builder.list`

**Response:**
```json
{
  "builders": [
    {
      "name": "DiningChair",
      "description": "Standard dining chair",
      "measurements": ["seat_width", "seat_depth", ...],
      "decisions": ["leg_style", "back_style", ...],
      "source": "typescript"
    },
    {
      "name": "Leg",
      "description": "Furniture leg",
      "source": "yaml"
    }
  ]
}
```

### `builder.open <name>`

Open a builder for editing/running. This sets the active builder.

**Usage:** `builder.open DiningChair`

**Response:**
```json
{
  "builder": "DiningChair",
  "source": "typescript",
  "message": "Opened builder: DiningChair"
}
```

### `builder.run [seed=<n>]`

Run the active builder with optional seed. Same seed = identical output.

**Usage:** 
- `builder.run` - Random seed
- `builder.run seed=42` - Specific seed
- `builder.run 42` - Shorthand

**Response:**
```json
{
  "builder": "DiningChair",
  "seed": 42,
  "vertices": 124,
  "faces": 67,
  "bounds": { "width": "0.42m", "height": "0.85m", "depth": "0.40m" },
  "decisions": { "leg_style": { "value": "tapered", "source": "random" } },
  "issues": 0,
  "traces": 79
}
```

### `builder.info`

Get info about the active builder.

**Usage:** `builder.info`

### `builder.measurements`

Get all measurements from the last run.

**Usage:** `builder.measurements`

**Response:**
```json
{
  "measurements": {
    "seat_width": { "value": 0.42, "source": "Standard dining chair width" },
    "seat_depth": { "value": 0.38, "source": "Standard depth" }
  }
}
```

### `builder.decisions`

Get all decisions from the last run.

**Usage:** `builder.decisions`

**Response:**
```json
{
  "decisions": {
    "leg_style": { "value": "tapered", "source": "random", "options": ["round", "square", "tapered"] },
    "back_style": { "value": "slat", "source": "override" }
  }
}
```

### `builder.traces [filter=<prefix>]`

List trace keys from the last run. Traces show how geometry was created.

**Usage:**
- `builder.traces` - All traces
- `builder.traces filter=vertex:` - Only vertex traces
- `builder.traces filter=loop:` - Only loop traces

**Response:**
```json
{
  "traces": [
    "vertex:seat_bl_b",
    "vertex:seat_br_b",
    "loop:leg_bl_bottom",
    "face:seat_top",
    "loft:leg_bl_surface"
  ]
}
```

### `builder.trace <key>`

Get detailed trace information for a specific geometry element.

**Usage:** `builder.trace vertex:seat_bl_b`

**Response:**
```json
{
  "key": "vertex:seat_bl_b",
  "trace": {
    "type": "vertex",
    "name": "seat_bl_b",
    "source": { "expression": "(-half_width, seat_height, -half_depth)" },
    "details": { "position": { "x": -0.21, "y": 0.45, "z": -0.19 } }
  }
}
```

### `builder.mesh`

Get serialized mesh geometry for rendering (vertices, faces, normals).

**Usage:** `builder.mesh`

---

## Measurement Commands

Commands for inspecting and modifying builder measurements.

### `measurement.list`

List all measurements for the active builder.

**Usage:** `measurement.list`

### `measurement.get <name>`

Get a specific measurement value.

**Usage:** `measurement.get seat_width`

### `measurement.set <name> <value>`

Override a measurement value. Persists across runs until reset.

**Usage:** `measurement.set seat_width 0.50`

### `measurement.reset <name>`

Remove override for a measurement (restore default).

**Usage:** `measurement.reset seat_width`

### `measurement.reset-all`

Clear all measurement overrides.

**Usage:** `measurement.reset-all`

---

## Decision Commands

Commands for inspecting and overriding builder decisions.

### `decision.list`

List all decisions for the active builder.

**Usage:** `decision.list`

### `decision.get <name>`

Get a specific decision value and its options.

**Usage:** `decision.get leg_style`

### `decision.override <name> <value>`

Force a specific decision value. Persists across runs until reset.

**Usage:** `decision.override leg_style tapered`

### `decision.reset <name>`

Remove override for a decision (restore random selection).

**Usage:** `decision.reset leg_style`

### `decision.reset-all`

Clear all decision overrides.

**Usage:** `decision.reset-all`

---

## Storage Commands

Commands for managing YAML builder definitions in storage.

### `storage.list [prefix=<path>]`

List all YAML builders in storage.

**Usage:**
- `storage.list` - All builders
- `storage.list prefix=furniture/` - Only in furniture folder

**Response:**
```json
{
  "builders": [
    {
      "name": "DiningChairYaml",
      "description": "YAML dining chair",
      "tags": ["furniture", "seating"],
      "modifiedAt": "2026-01-14T12:00:00Z",
      "size": 11089
    }
  ],
  "total": 1
}
```

### `storage.get <name>`

Get a YAML builder definition from storage.

**Usage:** `storage.get DiningChairYaml`

**Response:**
```json
{
  "name": "DiningChairYaml",
  "description": "YAML dining chair",
  "modifiedAt": "2026-01-14T12:00:00Z",
  "content": "version: \"1.0\"\nname: DiningChairYaml\n..."
}
```

### `storage.save <name> content=<yaml>`

Save a YAML builder definition to storage.

**Usage:** `storage.save MyBuilder content="version: 1.0\nname: MyBuilder\n..."`

### `storage.delete <name>`

Delete a YAML builder from storage.

**Usage:** `storage.delete MyBuilder`

### `storage.exists <name>`

Check if a builder exists in storage.

**Usage:** `storage.exists DiningChairYaml`

**Response:**
```json
{
  "name": "DiningChairYaml",
  "exists": true
}
```

---

## Command Syntax

### Positional Arguments
```
builder.open DiningChair
builder.trace vertex:seat_bl_b
```

### Key=Value Options
```
builder.run seed=42
storage.list prefix=furniture/
```

### Quoted Strings
Use quotes for values with spaces:
```
storage.save MyBuilder content="multi\nline\nyaml"
```

---

## Error Handling

Failed commands return:
```json
{
  "command": "builder.run",
  "status": "error",
  "error": "No builder is open. Use builder.open <name> first."
}
```

Common errors:
- `No builder is open` - Call `builder.open` first
- `Unknown builder: X` - Builder doesn't exist
- `Missing required argument` - Check command usage

---

## YAML Geometry Commands (P2-M1b)

These geometry commands are used in YAML builder definitions, not as DSL commands.
They are processed by the YAML parser when a builder runs.

### Profile Definitions

Define 2D cross-sections for lathe and sweep operations.

```yaml
profiles:
  vase_profile:
    type: polygon          # polygon, circle, ellipse, rect
    closed: false          # true for closed profiles
    points:
      - { x: 0, y: 0 }
      - { x: "base_radius", y: "h1" }  # Expressions supported
      - { x: "body_radius", y: "h2" }

  pipe_profile:
    type: circle
    radius: 0.02
    segments: 8
```

### Spline Definitions

Define 3D paths for sweep operations.

```yaml
splines:
  handle_path:
    type: catmull-rom      # catmull-rom or linear
    tension: 0.5           # 0-1, controls curve tightness
    points:
      - { x: "r", y: "h1", z: 0 }
      - { x: "r + offset", y: "h2", z: 0 }
      - { x: "r", y: "h3", z: 0 }
```

### `lathe:` - Rotational Solid

Spin a 2D profile around the Y axis.

```yaml
geometry:
  - lathe: vase_body
    profile: vase_profile   # Reference to defined profile
    segments: 24            # Number of segments around axis
    angle: 6.28318          # Optional: arc angle (default 2π)
    color: $ceramic         # Optional: material color
```

**Use cases:** Vases, bottles, bowls, cups, balusters, table legs

### `sweep:` - Extrude Along Path

Sweep a 2D profile along a 3D spline path.

```yaml
geometry:
  - sweep: handle
    profile: handle_profile  # 2D cross-section
    path: handle_path        # 3D spline path
    segments: 12             # Segments along path
    twist: 0                 # Optional: rotation along path (radians)
    scaleStart: 1.0          # Optional: scale at start
    scaleEnd: 1.0            # Optional: scale at end
    color: $ceramic          # Optional: material color
```

**Use cases:** Handles, pipes, cables, organic tubes, handrails

### `subdivide:` - Catmull-Clark Subdivision

Smooth a low-poly control cage into an organic surface.

```yaml
geometry:
  # First create a control cage (e.g., box)
  - vertex: v0
    position: { x: -0.2, y: -0.05, z: -0.2 }
  # ... more vertices and faces ...

  # Then subdivide
  - subdivide: smooth
    iterations: 2           # 1-3 iterations typical
```

**Use cases:** Cushions, organic shapes, character heads, soft objects

---

## Math Commands

Mathematical expression evaluation for calculations. Uses [mathjs](https://mathjs.org/) for robust evaluation.

### `math.eval <expression> [var=value...]`

Evaluate a mathematical expression with optional variable substitution.

**Usage:**
- `math.eval "sin(pi/4)"` - Evaluate with constants
- `math.eval "cos(angle) * radius" angle=0.785 radius=10` - With variables

**Response:**
```json
{
  "expression": "sin(pi/4)",
  "value": 0.7071067811865475
}
```

### `math.validate <expression>`

Check if an expression is syntactically valid.

**Usage:** `math.validate "sin(x) + cos(y)"`

### `math.functions`

List all available mathematical functions.

**Response includes:**
- **Trig:** `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`
- **Basic:** `abs`, `sqrt`, `pow`, `exp`
- **Rounding:** `floor`, `ceil`, `round`, `trunc`
- **Comparison:** `min`, `max`

### `math.constants`

List all available mathematical constants.

**Response includes:**
- `pi` - π ≈ 3.14159...
- `e` - Euler's number ≈ 2.71828...
- `tau` - 2π ≈ 6.28318...

---

## WebSocket Events

The authoring server also broadcasts events via WebSocket on port 4200:

- `builder_opened` - When a builder is opened
- `builder_run` - When a builder is run
- `measurement_changed` - When a measurement is overridden
- `decision_changed` - When a decision is overridden

Connect to `ws://127.0.0.1:4200` to receive these events.

