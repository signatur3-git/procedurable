# Agent Workflow

How an AI agent interacts with Procedurable to author and refine 3D content.

## The Target Loop

In the fully realized system, an agent follows this workflow:

```
1. DISCOVER    → What builders exist? What can I do?
2. UNDERSTAND  → What does this builder produce? What are its decisions?
3. EVALUATE    → Is the output good enough? What quality tier is it?
4. PLAN        → What needs to change to reach the target tier?
5. MODIFY      → Override decisions, edit YAML, or create new builders
6. VALIDATE    → Run quality gates, check decision coverage
7. LEARN       → Store domain insights in world metadata
8. COMPOSE     → Combine builders into scenes
```

## Available Agent Actions (Current)

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
builder.quality                → run validation checks
builder.run seed=1             → try multiple seeds to see variation
builder.run seed=2
builder.run seed=3
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
scene.query_by_tag seating                → spatial query
scene.get_bounds table                    → bounding box
```

## Target Agent Actions (Planned)

### Quality-Driven Refinement [A Track]

```
quality.validate DiningChair tier=2    → check against Tier 2 criteria
quality.coverage DiningChair           → test all decision options
quality.plan DiningChair tier=2        → generate sophistication plan
```

### Builder Authoring [B4]

```
builder.create BookShelf template=shelving   → scaffold new builder
builder.add_decision BookShelf shelf_count count min=2 max=6
builder.add_measurement BookShelf width base=0.8
builder.add_geometry_step BookShelf extrude ...
```

### Knowledge Accumulation [B3]

```
world.set furniture.dining.chair.seat_height 0.45
world.set furniture.dining.chair.seat_height.source "ergonomics standard"
world.get furniture.dining.*                → query stored knowledge
world.set styles.modern.materials [oak, steel, linen]
```

### Scene Description [B2]

```
scene.save DiningRoom                → persist current scene
scene.load DiningRoom                → restore scene
scene.export DiningRoom format=gltf  → export to file
```

## Agent Strategy: From Zero to Tier 2

Here's how an agent would build a new piece of furniture end-to-end in the target system:

### Phase 1: Research

```
world.get furniture.bookshelf.*           → check stored knowledge
builder.list                              → see if similar builders exist
builder.open DiningChair                  → study a well-made builder
builder.decisions                         → understand decision patterns
```

### Phase 2: Scaffold

```
builder.create BookShelf template=furniture
builder.add_decision BookShelf shelf_count count min=2 max=6
builder.add_decision BookShelf style choice options=[modern,classic]
builder.add_measurement BookShelf total_height base=1.8
builder.add_measurement BookShelf width base=0.8
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
→ FAIL: only 1 material (need 2+)
→ FAIL: no edge bevels
→ PASS: decisions produce different geometry
→ PASS: minimum face count met

quality.coverage BookShelf
→ shelf_count: 100% (each option changes mesh) ✓
→ style: 0% (both options produce same mesh) ✗
```

### Phase 5: Fix & Iterate

```
# Agent reads coverage failure, realizes style decision
# doesn't affect geometry yet. Edits YAML to add
# style-dependent geometry (modern=clean lines, classic=molding)

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

## Why This Matters

The goal: **writing new code should barely be required.** Agents should:

1. Use existing geometry components (extrude, lathe, sweep, etc.)
2. Compose them via YAML builder definitions
3. Validate quality via automated gates
4. Accumulate domain knowledge for future builders

New code is only needed when the platform is missing a geometry capability (like 2D booleans or bevel). Once those exist, everything is YAML, decisions, and expressions.
