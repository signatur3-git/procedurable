# YAML Builder Format

Complete reference for the builder definition format.

## Minimal Example

```yaml
version: "1.0"
name: SimpleBox

measurements:
  width:
    base: 1.0
  height:
    base: 0.5
  depth:
    base: 1.0

geometry:
  - create_box:
      name: box
      width: $width
      height: $height
      depth: $depth
```

## Full Structure

```yaml
version: "1.0"
name: BuilderName

# ── Decisions ──────────────────────────────────────
# Virtual artist choices. Each run with a different seed
# may produce a different selection.
decisions:
  style:
    type: choice
    options: [modern, classic, rustic]
    weights: [0.4, 0.3, 0.3]          # optional, defaults to uniform

  leg_count:
    type: count
    min: 3
    max: 4

  seat_depth_ratio:
    type: number
    min: 0.8
    max: 1.0

# ── Measurements ───────────────────────────────────
# Physical dimensions. Can have random variation.
measurements:
  seat_height:
    base: 0.45
    variation: seat_height_var          # references a decision for ±variation

  seat_width:
    value: 0.42                         # fixed value (no variation)

# ── Derived ────────────────────────────────────────
# Computed from expressions. Evaluated after decisions
# and measurements are resolved.
derived:
  seat_depth: "seat_width * seat_depth_ratio"
  leg_inset: "seat_width * 0.1"
  rail_height: "seat_height * 0.6"

# ── Geometry ───────────────────────────────────────
# Ordered steps that create and transform meshes.
geometry:
  - create_loop:
      name: seat_profile
      type: rectangle
      width: $seat_width
      depth: $seat_depth

  - extrude:
      name: seat
      loop: seat_profile
      height: 0.03
      cap: both

  - transform:
      target: seat
      translate: { y: $seat_height }

  - create_loop:
      name: leg_profile
      type: circle
      radius: 0.015
      segments: 8

  - extrude:
      name: leg_fl
      loop: leg_profile
      height: $seat_height

  # ... more geometry steps ...

  - merge:
      name: chair
      sources: [seat, leg_fl, leg_fr, leg_bl, leg_br]

# ── Compose ────────────────────────────────────────
# Include other builders as sub-components.
compose:
  cushion:
    builder: SeatCushion
    offset: { x: 0, y: "$seat_height + 0.03", z: 0 }
    condition: "$has_cushion"            # only include if decision is true
    overrides:
      width: $seat_width
      depth: $seat_depth
      material: $cushion_material

# ── Placement ──────────────────────────────────────
# Position composed objects with spatial constraints.
placement:
  mode: around_rectangle
  center: { x: 0, y: 0, z: 0 }
  width: $table_width
  depth: $table_depth
  builder: DiningChair
  count: $chair_count
  minDistance: 0.5
  allowReducedCount: true
  overrides:
    back_style: $chair_back_style

# ── Quality (planned) ─────────────────────────────
# Declares target quality tier and known gaps.
quality:
  target_tier: 2
  current_tier: 1
  tier_gaps:
    - "legs are rectangular (need turned profile)"
    - "no edge bevels"
    - "single material"

# ── Modifiers (planned) ───────────────────────────
# Non-destructive post-processing stack.
modifiers:
  - type: subdivision
    target: seat
    levels: 1
  - type: bevel
    target: chair
    width: 0.003
    segments: 2

# ── Materials (planned) ───────────────────────────
# Named material slot assignments.
materials:
  frame:
    slot: primary_wood
    default: oak
  cushion:
    slot: fabric
    default: linen_cream
```

## Variable References

`$name` in any value position resolves to a decision, measurement, or derived value:

| Reference | Resolves To |
|-----------|-------------|
| `$seat_width` | Measurement or derived value named "seat_width" |
| `$back_style` | Decision value named "back_style" |
| `"$seat_height * 0.5"` | Expression evaluated with all named values in scope |

## Geometry Step Types

| Step | Purpose | Key Parameters |
|------|---------|----------------|
| `create_box` | Box mesh | width, height, depth |
| `create_sphere` | Sphere mesh | radius, segments |
| `create_loop` | Edge loop (circle or rectangle) | type, dimensions |
| `extrude` | Extrude loop or shape to 3D | loop/shape, height, cap |
| `lathe` | Revolve profile around Y | profile, segments |
| `sweep` | Move profile along path | profile, path, segments |
| `transform` | Translate/rotate/scale a named mesh | target, translate/rotate/scale |
| `merge` | Combine meshes | sources[] |
| `subdivide` | Catmull-Clark subdivision | target, levels |
| `clone` | Duplicate a named mesh | source, name |
