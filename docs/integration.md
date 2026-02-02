# How Components Connect

This page documents the **glue** — the interfaces and data formats that tie components together.

## The Three Key Interfaces

### 1. YAML Builder Definition → Builder Engine

The YAML format is the contract between "what an agent writes" and "what the engine executes." Every section maps to specific engine capabilities:

```yaml
version: "1.0"
name: BuilderName

decisions:     # → TracedBuilder.decide/decideNumber/decideCount
measurements:  # → TracedBuilder.defineMeasurement
derived:       # → ExpressionService.evaluateNumeric
geometry:      # → TracedBuilder geometry methods (ordered steps)
compose:       # → TracedBuilder.compose (recursive execution)
placement:     # → Placement engine
quality:       # → ValidationAPI tier checks ✅
modifiers:     # → Deformers (noise, bend, twist, taper) ✅
materials:     # → MaterialSlots with PBR properties ✅
ports:         # → Attachment points for negotiation ✅
requirements:  # → Request/offer protocol ✅
```

If a section references a capability that doesn't exist, the parser rejects it with a clear error. This makes the YAML format the **definitive inventory of platform capabilities**.

### 2. DSL Commands → Authoring Server → Engine

The command format `namespace.action args` is the contract between agents and the platform:

```
builder.run DiningChair seed=42 → triggers full execution pipeline
decision.override back_style solid → modifies session state
storage.save MyChair <yaml> → persists a builder definition
```

**Every platform capability must be reachable via a DSL command.** If something can only be done by editing files or writing TypeScript, that's a gap in the DSL.

### 3. TracedOutput → Consumers (Dashboard, Agent, Export)

The output of every builder run is a `TracedOutput`:

```typescript
interface TracedOutput {
  mesh: Mesh                        // The geometry
  decisions: TracedDecision[]       // Every decision made, with value + source
  measurements: TracedValue[]       // Every measurement, with value + source
  traces: TraceEntry[]              // Execution log
  validation: ValidationResult      // Quality checks
  skeleton: TracedSkeleton | null   // Joint hierarchy (Phase 3)
  metadata: {
    name: string
    seed: number
    duration: number
    triangleCount: number
  }
}
```

This is consumed by:
- **Dashboard** — renders mesh, displays traces
- **Agent** — inspects decisions, validates quality, plans next steps
- **PSD Scene** — serializes to scene description format
- **Export** — converts mesh to glTF with materials, UVs, and hierarchy

## Expression Resolution

Expressions are the glue between decisions, measurements, and geometry:

```yaml
decisions:
  leg_count:
    type: count
    min: 3
    max: 4

measurements:
  table_radius:
    base: 0.6

derived:
  leg_angle: "360 / leg_count"
  leg_x: "table_radius * cos(leg_angle * i * PI / 180)"
```

The resolution order:
1. **Decisions** evaluated first (may be overridden)
2. **Measurements** evaluated second (may reference decisions)
3. **Derived** values computed from expression strings (reference both)
4. **Geometry steps** use all of the above via `$variable` references

`ExpressionService` wraps `MathService` and adds context awareness — it knows about the current builder's decisions and measurements.

## SharedContext: Cross-Builder Communication

When builders compose other builders, SharedContext carries information:

```
DiningScene (parent)
  │
  │ SharedContext.set("scene_style", "modern")
  │ SharedContext.set("wood_tone", "oak")
  │
  ├── Table (child)
  │   └── reads SharedContext.get("scene_style") → "modern"
  │
  └── Chair (child)
      └── reads SharedContext.get("wood_tone") → "oak"
```

Additionally, explicit overrides in the `compose:` section:

```yaml
compose:
  chair:
    builder: DiningChair
    overrides:
      back_style: $scene_back_style    # $ references parent decision
```

This is how style consistency works across a composed scene without hardcoding values.

## SceneGraph: Semantic Layer

After composition, the SceneGraph provides a queryable semantic view:

```
SceneGraph
  ├── "table" [tags: furniture, surface, dining]
  │   ├── transform: identity
  │   └── mesh: 234 triangles
  ├── "chair_0" [tags: furniture, seating, dining]
  │   ├── transform: translate(0.8, 0, 0), rotate(0, 90, 0)
  │   └── mesh: 156 triangles
  └── "chair_1" [tags: furniture, seating, dining]
      ├── transform: translate(-0.8, 0, 0), rotate(0, -90, 0)
      └── mesh: 156 triangles
```

Agents query this for spatial reasoning:
- "What's the total bounding box of all seating?"
- "How far apart are the chairs?"
- "Which objects are tagged as furniture?"

## WebSocket: Real-Time Sync

```
Authoring Server ──WebSocket──► Dashboard
                                  │
Events:                           │
  builder.run result ──────────►  Update 3D view
  decision.override ───────────►  Re-render with new value
  storage.save ────────────────►  Refresh builder list
```

The dashboard never polls. It reacts to server broadcasts. This keeps the dashboard simple — it's a display, not a controller.

## Component Dependency Rules

```
Layer 0 (Math):       Vec3, Mat4, Transform, AABB, Spline, MathService
  ▲ no dependencies

Layer 1 (Spatial):    Scatter, PoissonDisk, ScalarField, Instance
  ▲ depends only on Layer 0

Layer 2 (Geometry):   Mesh, Extrude, Sweep, Lathe, Subdivision, Path2D, Shape2D
  ▲ depends on Layer 0-1

Layer 3 (Services):   ExpressionService, MaterialLibrary, ValidationAPI
  ▲ depends on Layer 0-2

Layer 4 (Engine):     TracedBuilder, YamlBuilderParser, SharedContext, SceneGraph, Placement
  ▲ depends on Layer 0-3

Layer 5 (Server):     Authoring handlers, command registry
  ▲ depends on Layer 0-4

Layer 6 (Protocol):   MCP server
  ▲ depends only on Layer 5 (HTTP calls)

Layer 6 (UI):         Dashboard
  ▲ depends only on Layer 5 (WebSocket)
```

Violations of this layering are bugs. For example, a geometry class should never import from builder/.
