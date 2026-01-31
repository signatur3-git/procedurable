# Scene & Composition

How multiple builders are assembled into scenes with semantic structure.

## Components

| Class | Role | Status |
|-------|------|--------|
| `SceneGraph` | Semantic tree of placed objects with tags | [exists] |
| `SceneNode` | Individual node in scene hierarchy | [exists] |
| `SharedContext` | Key-value store for cross-builder state | [exists] |
| `Placement` | Constraint-based object positioning | [partial] |

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

Special `__constraints__` entries allow children to influence parent layout:

```
Parent sets: table_width = 1.2
Child reads: table_width from SharedContext
Child uses it to size chair appropriately
```

## Placement [partial]

Positions objects according to spatial constraints.

### Available Modes

| Mode | What It Does | Status |
|------|-------------|--------|
| `around_rectangle` | Place N items around a rectangle perimeter | [exists] |
| `around_circle` | Place N items around a circle | [exists] |
| `along_path` | Place items along a spline path | [planned] |
| `fill_area` | Fill a region with items (grid or scatter) | [planned] |
| `on_surface` | Place items on a mesh surface | [planned] |

### Target: Goal-Seeking Placement [planned — B1-003]

Current placement is prescriptive ("put 4 chairs around this rectangle"). Target state is goal-seeking:

```yaml
placement:
  mode: around_rectangle
  goal: "seat everyone comfortably"
  constraints:
    min_distance: 0.5
    max_count: 8
    allow_reduced: true    # ok to place fewer if they don't fit
```

The placement engine would try to satisfy the goal, report back what it achieved, and explain any compromises.

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
- Agent reasoning about scene composition
- Diffing scenes to understand changes
- Export as a unit (all meshes + transforms → glTF)
