# Scene & Composition

How multiple builders are assembled into scenes with semantic structure.

## Components

| Class | Role | Status |
|-------|------|--------|
| `SceneGraph` | Semantic tree of placed objects with tags | [exists] |
| `SceneNode` | Individual node in scene hierarchy | [exists] |
| `SharedContext` | Key-value store for cross-builder state | [exists] |
| `Placement` | Constraint-based object positioning | [exists] |

## SceneGraph [exists]

A tree of named, tagged objects with transforms. Separate from the geometry — this is the **semantic** layer that says "this is a chair, it's at the dining table, it's tagged as seating."

```
DiningScene
  ├── table (tag: furniture, surface)
  │   └── Mesh (from Table builder)
  ├── chair_0 (tag: furniture, seating)
  │   └── Mesh (from DiningChair builder)
  ├── chair_1 (tag: furniture, seating)
  │   └── Mesh (from DiningChair builder)
  └── centerpiece (tag: decoration)
      └── Mesh (from Vase builder)
```

### Query API

```
query_by_tag("seating")    → [chair_0, chair_1]
query_by_tag("furniture")  → [table, chair_0, chair_1]
get_bounds("table")        → AABB
```

### Tag Aggregation [planned — B2-003]

Currently tags live only on the prim where they're declared. For large scenes, agents need to query a parent and find tags from any descendant:

```
# Fortress scene with nested builders:
siege_scene
  ├── fortress (tags: structure)
  │   ├── wall_north (tags: wall)
  │   └── gate (tags: entrance)
  └── army_attackers (tags: army)
      ├── unit_1 (tags: race:orc, role:infantry)
      └── catapult_squad (tags: role:siege)

# With tag aggregation, querying the root finds deep tags:
query_by_tag("race:orc")    → [unit_1]  (found through army_attackers)
scene.overview               → top-level prims with collected tags from all descendants
```

### Summary & Drill-Down Queries [planned — B2-003]

For scenes too large to dump into one MCP response:

```
scene.overview
→ { siege_scene: { children: 2, bounds: AABB, tags: [structure, army, race:orc, role:siege, ...] } }

scene.inspect siege_scene.army_attackers
→ { unit_1: { bounds: AABB, tags: [...] }, catapult_squad: { bounds: AABB, tags: [...] } }
```

### Spatial Relationship Queries [planned — B2-003]

Agents reasoning about scenes need distance and proximity:

```
scene.distance catapult_squad fortress.gate
→ { center_to_center: 50.2, surface_to_surface: 43.7 }

scene.prims_within fortress.gate 20
→ [wall_north, army_attackers.unit_1]
```

## SharedContext [exists]

Enables parent builders to pass style decisions to children without hardcoding:

```yaml
# DiningScene.yaml
compose:
  chair:
    builder: DiningChair
    overrides:
      back_style: $scene_back_style    # all chairs match scene decision
      wood_tone: $scene_wood_tone      # consistent material
```

SharedContext is a flat key-value store. It's set by the parent and readable by all children in the composition tree.

### Constraint Propagation

Special `__constraints__` entries allow parents to limit children:

```
Parent sets: table_width = 1.2
Child reads: table_width from SharedContext
Child uses it to size chair appropriately
```

### Negotiation Protocol [planned — B5]

SharedContext is being extended with typed channels for builder negotiation:

**Requirements channel** — builders publish spatial needs:
```yaml
requirements:
  flat_pad:
    type: terrain_clearance
    shape: rectangle
    width: 12
    depth: 10
    max_slope: 5
```

**Offers channel** — environment builders respond:
```yaml
offers:
  house_1.flat_pad:
    elevation: 42.3
    slope: 2.1
    boundary_loop: pad_edge_loop
```

This enables builders to adapt to each other without knowing internals. See [Builder Negotiation](#builder-negotiation-planned--b5) below.

## Placement [exists]

Positions objects according to spatial constraints.

### Available Modes

| Mode | What It Does | Status |
|------|-------------|--------|
| `around_rectangle` | Place N items around a rectangle perimeter | [exists] |
| `around_circle` | Place N items around a circle | [exists] |
| `along_path` | Place items along a line with configurable spacing | [exists] |
| `fill_area` | Fill a region via Poisson disk scatter | [exists] |
| `on_surface` | Place items on a mesh surface | [planned] |

All placement is deterministic (seeded random) and includes AABB collision avoidance.

### Goal-Seeking Placement [exists — B1-003]

```yaml
placement:
  mode: around_rectangle
  constraints:
    min_distance: 0.5
    max_count: 8
    allow_reduced: true    # ok to place fewer if they don't fit
```

The placement engine tries to satisfy constraints, reports back what it achieved, and explains any compromises.

## Procedurable Scene Description (PSD) [planned — B2]

A serializable format for complete scenes:

```yaml
# scene.psd.yaml
version: "1.0"
name: "Dining Room"
seed: 42

builders:
  table:
    type: Table
    position: [0, 0, 0]
    overrides: { style: modern }
    ports:                           # attachment points
      surface_center: { position: [0, 0.75, 0], normal: [0, 1, 0] }
  chairs:
    type: DiningChair
    placement: { mode: around, target: table, count: 4 }
    overrides: { back_style: slat }

metadata:
  domain: furniture
  quality_target: tier_2
  tags: [interior, dining]
```

PSD enables:
- Saving and loading complete scenes
- Agent reasoning about scene composition (tag aggregation, spatial queries)
- Diffing scenes to understand changes
- Export as a unit (all meshes + transforms → glTF)
- Storing port/attachment point metadata for builder negotiation

## Builder Negotiation [planned — B5]

Three levels of inter-builder communication, each building on the previous:

### Level 1: Attachment Points (B5-001)

Builders declare named **ports** — positions where other builders can attach:

```yaml
# Lamp builder declares a base port
ports:
  base:
    position: { x: 0, y: 0, z: 0 }
    normal: { x: 0, y: -1, z: 0 }
    loop: base_ring       # optional edge loop for blending

# Composition snaps lamp to table
compose:
  lamp:
    builder: TableLamp
    attach_to: table.surface_center
```

The system auto-computes offset and rotation to align the ports.

### Level 2: Request/Offer Protocol (B5-002)

Builders that need to adapt to each other communicate through structured requirements and offers:

```
House publishes:  "I need a flat 10×12m pad at (50, 30)"
    ↓
Terrain receives: all housing requirements before generating mesh
    ↓
Terrain publishes: "Pad at elevation 42.3m, slope 2.1° east"
    ↓
House reads:      offer and adapts foundation to 2.1° slope
```

Implementation uses composition ordering: compose requirement-publishers first, then environment builders, then re-compose with offers. All requirements and offers are traced for inspectability.

### Level 3: Transition Zone Blending (B5-003)

When two builders share a boundary, neither owns the transition alone:

```yaml
compose:
  road:
    builder: Road
    blend_zones:
      - my_loop: road_edge_left
        their_loop: terrain.cut_left
        method: loft
        segments: 4
```

The system takes boundary loops from both builders and generates connecting geometry via loft — reusing existing geometry primitives with a new protocol for exchanging boundary data.

### Design Principles

- **Deterministic** — same seed, same requirements, same offers, same result
- **Traceable** — every requirement, offer, and blend is in the trace log
- **Progressive** — Level 1 works now with minimal changes; Level 2-3 build incrementally
- **Composable** — ports extend output metadata; requirements extend SharedContext; blends use existing loft
