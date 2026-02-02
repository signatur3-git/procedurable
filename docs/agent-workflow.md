# Agent Workflow

How an AI agent interacts with Procedurable to author and refine 3D content.

> **Updated:** 2026-02-03 (Phase 2 complete)

## The Agent Loop

With Phase 2 complete, agents can follow this full workflow:

```
 1. DISCOVER    → What builders exist? What can I do?
 2. UNDERSTAND  → What does this builder produce? What are its decisions?
 3. EVALUATE    → Is the output good enough? What quality tier is it?
 4. PLAN        → What needs to change to reach the target tier?
 5. MODIFY      → Override decisions, edit YAML, or create new builders
 6. VALIDATE    → Run quality gates, check decision coverage
 7. LEARN       → Store domain insights in world metadata
 8. COMPOSE     → Combine builders into scenes
 9. NEGOTIATE   → Publish requirements, receive offers, blend boundaries
10. REASON      → Query scenes semantically, compute spatial relationships
```

## Available Agent Actions

### Discover

```
system.help              → list all DSL commands
builder.list             → list available builders
storage.list             → list stored files
```

### Understand

```
builder.open DiningChair       → set active builder
builder.decisions              → list decisions with types, ranges, options
builder.measurements           → list measurements with values
builder.run seed=42            → execute and see full output
builder.traces                 → execution log
builder.mesh                   → raw geometry data
```

### Evaluate

```
builder.quality                → run tier 1 quality gates (✅ implemented)
builder.quality tier=2         → check against tier 2 gates (✅ implemented)
builder.run seed=1             → try multiple seeds to see variation
builder.run seed=2
builder.run seed=3
```

The `builder.quality` response includes machine-readable `suggestions` array:
```json
{
  "action": "add_material",
  "target": "mesh",
  "reason": "Tier 2 requires at least 2 distinct materials",
  "metric": "distinct_colors",
  "current_value": 1,
  "required_value": 2,
  "tier": 2
}
```

### Modify

```
decision.override back_style ladder   → pin a decision
measurement.set seat_height 0.5       → override a measurement
decision.reset back_style             → unpin
storage.save MyBuilder <yaml>         → create/update a builder
```

### Compose

```
scene.place_around table chairs count=4   → placement
scene.place_along path lamps spacing=2    → linear placement
scene.fill_area garden flowers density=5  → scatter fill
scene.query_by_tag seating                → spatial query
scene.get_bounds table                    → bounding box
```

### Quality-Driven Refinement ✅

```
builder.quality                        → run quality gates
builder.quality tier=2                 → check against Tier 2 criteria
quality.coverage DiningChair           → test all decision options
quality.plan DiningChair tier=2        → generate sophistication plan
```

The response includes machine-readable `suggestions` array:
```json
{
  "action": "add_material",
  "target": "mesh",
  "reason": "Tier 2 requires at least 2 distinct materials",
  "metric": "distinct_colors",
  "current_value": 1,
  "required_value": 2,
  "tier": 2
}
```

### Builder Authoring ✅

```
builder.create BookShelf template=shelving   → scaffold new builder
builder.add_decision BookShelf shelf_count count min=2 max=6
builder.add_measurement BookShelf width base=0.8
builder.add_geometry_step BookShelf extrude ...
builder.snapshot BookShelf                   → save current state for rollback
builder.restore BookShelf <snapshot_id>      → revert to previous state
```

### Knowledge Accumulation ✅

```
world.set furniture.dining.chair.seat_height 0.45
world.set furniture.dining.chair.seat_height.source "ergonomics standard"
world.get furniture.dining.*                → query stored knowledge
world.set styles.modern.materials [oak, steel, linen]
world.set styles.modern.decision_defaults.leg_style tapered_round
```

### Scene Description & Queries ✅

```
scene.save DiningRoom                → persist current scene
scene.load DiningRoom                → restore scene
scene.export DiningRoom format=gltf  → export to file

scene.overview                       → top-level summary (for large scenes)
scene.inspect siege_scene.army       → drill into one level
scene.distance catapult gate         → spatial relationship
scene.prims_within gate 20           → proximity search
```

### Builder Negotiation ✅

```
# Level 1: Attachment points
# (Declared in YAML, auto-resolved during composition)
compose:
  lamp:
    builder: TableLamp
    attach_to: table.surface_port    → snap lamp base to table surface

# Level 2: Requirements and offers
# House publishes requirement → terrain provides offer → house adapts
scene.get_requirements terrain       → see what builders need from terrain
scene.get_offers house_1             → see what terrain offered to house

# Level 3: Blend zones
# (Declared in composition YAML, auto-generated during build)
scene.get_blend_zones road           → inspect transition geometry
```

### Symmetry Operations ✅

```
# In YAML geometry steps:
mirror:
  plane: { point: [0,0,0], normal: [1,0,0] }
  weld: true

radial_array:
  axis: { point: [0,0,0], direction: [0,1,0] }
  count: 6
```

## Agent Strategy: From Zero to Tier 2

Here's how an agent would build a new piece of furniture end-to-end in the target system:

### Phase 1: Research

```
world.get furniture.bookshelf.*           → check stored knowledge
builder.list                              → see if similar builders exist
builder.open DiningChair                  → study a well-made builder
builder.decisions                         → understand decision patterns
world.get styles.modern.*                 → get style defaults
```

### Phase 2: Scaffold

```
builder.create BookShelf template=furniture
builder.add_decision BookShelf shelf_count count min=2 max=6
builder.add_decision BookShelf style choice options=[modern,classic]
builder.add_measurement BookShelf total_height base=1.8
builder.add_measurement BookShelf width base=0.8
builder.snapshot BookShelf                → save baseline
```

### Phase 3: Build Geometry

```
# Edit YAML to add geometry steps
storage.save BookShelf <yaml with geometry>
builder.run seed=1
builder.quality                           → check basic validity
builder.run seed=2                        → verify variation
builder.run seed=3
```

### Phase 4: Validate

```
quality.validate BookShelf tier=2
→ FAIL: { action: "add_material", target: "frame",
→         reason: "material_count < 2", current: 1, required: 2 }
→ FAIL: { action: "add_bevel", target: "edges",
→         reason: "no_edge_treatment" }
→ PASS: decisions produce different geometry
→ PASS: minimum face count met

quality.coverage BookShelf
→ shelf_count: 100% (each option changes mesh) ✓
→ style: 0% (both options produce same mesh) ✗
```

### Phase 5: Fix & Iterate

```
# Agent reads machine-readable failures, acts on them:
# 1. Adds second material slot for accent
# 2. Adds bevel to edges
# 3. Adds style-dependent geometry (modern=clean lines, classic=molding)

storage.save BookShelf <updated yaml>
quality.validate BookShelf tier=2
→ PASS (all checks)
```

### Phase 6: Learn

```
world.set furniture.bookshelf.standard_heights [0.8, 1.2, 1.8, 2.4]
world.set furniture.bookshelf.shelf_spacing_min 0.25
world.set furniture.bookshelf.lessons "style decision must affect side panel profile"
```

## Agent Strategy: Scene Composition with Negotiation

How an agent composes a village scene using the negotiation protocol:

### Phase 1: Plan Scene

```
world.get architecture.village.*          → building types, spacing rules
world.get terrain.generation.*            → noise parameters, biomes
builder.list                              → available builders
```

### Phase 2: Create Builders with Ports & Requirements

```
# House builder declares what it needs from terrain:
# requirements:
#   flat_pad:
#     type: terrain_clearance
#     shape: rectangle
#     width: 12, depth: 10
#     max_slope: 5

# Road builder declares what it needs:
# requirements:
#   road_bed:
#     type: terrain_cut
#     width: 4
#     path: [waypoints...]
```

### Phase 3: Compose with Negotiation

```
# Scene YAML composes in order:
# 1. Houses and roads publish requirements (no geometry yet)
# 2. Terrain reads requirements, generates adapted mesh, publishes offers
# 3. Houses and roads read offers, generate geometry using terrain data
# 4. Blend zones connect boundaries

scene.overview
→ { village: { children: 12, bounds: ..., tags: [terrain, house, road, ...] } }
scene.distance house_1 house_2
→ { center_to_center: 25.3 }
```

### Phase 4: Validate & Export

```
quality.validate village tier=2
scene.export village format=gltf
```

## Why This Matters

The goal: **writing new code should barely be required.** Agents should:

1. Use existing geometry components (extrude, lathe, sweep, mirror, radial array, etc.)
2. Compose them via YAML builder definitions
3. Validate quality via automated gates with machine-readable feedback
4. Accumulate domain knowledge and style definitions for future builders
5. Negotiate with environment builders for context-aware composition
6. Reason about scenes through semantic and spatial queries

New code is only needed when the platform is missing a geometry capability (like 2D booleans or bevel). Once those exist, everything is YAML, decisions, and expressions.
