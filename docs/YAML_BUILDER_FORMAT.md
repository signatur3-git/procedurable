# YAML Builder Format Specification

> Version: 1.0.0
> This document defines the YAML format for procedural builder definitions.

---

## Overview

Builders are defined as YAML files that declaratively specify:
1. **Metadata** - Name, description, version
2. **Decisions** - Virtual artist choices with options and weights
3. **Measurements** - Dimensional values with optional variation
4. **Derived** - Computed values from expressions
5. **Geometry** - Vertices, loops, faces, lofts, compositions

The YAML is parsed and executed by `YamlBuilderParser`, which generates
calls to `TracedBuilder` methods.

---

## Complete Example

```yaml
# DiningChair.yaml
version: "1.0"
name: DiningChair
description: Standard dining chair with seat, legs, and back

# =============================================================================
# DECISIONS - Virtual artist choices
# =============================================================================
decisions:
  leg_style:
    type: choice
    options: [round, square, tapered, turned]
    weights: [0.4, 0.2, 0.3, 0.1]
    
  back_style:
    type: choice
    options: [solid, slat, ladder, spindle]
    weights: [0.3, 0.3, 0.25, 0.15]
    
  seat_shape:
    type: choice
    options: [square, rounded, contoured]
    weights: [0.5, 0.35, 0.15]
    
  leg_taper:
    type: number
    min: 0.6
    max: 1.0
    
  back_recline:
    type: number
    min: 3
    max: 8
    
  has_stretchers:
    type: boolean
    probability: 0.6
    
  slat_count:
    type: count
    min: 3
    max: 5
    condition: back_style == "slat"

# =============================================================================
# MEASUREMENTS - Dimensions with sources
# =============================================================================
measurements:
  seat_width:
    base: 0.42
    variation: width_variation  # References a decision
    source: "Standard dining chair width"
    
  seat_depth:
    base: 0.38
    variation: depth_variation
    source: "Standard dining chair depth"
    
  seat_height:
    value: 0.45
    source: "Ergonomic seating height"
    
  seat_thickness:
    value: 0.025
    source: "Typical plywood/solid wood thickness"
    
  leg_radius:
    value: 0.02
    source: "Round leg radius"
    conditional:
      - if: leg_style == "square"
        value: 0.018
        
  leg_inset:
    value: 0.03
    source: "Structural inset from edge"

# =============================================================================
# DERIVED - Computed values
# =============================================================================
derived:
  half_width: "seat_width / 2"
  half_depth: "seat_depth / 2"
  seat_top: "seat_height + seat_thickness"
  leg_x_outer: "half_width - leg_inset"
  leg_z_outer: "half_depth - leg_inset"

# =============================================================================
# GEOMETRY - Build the mesh
# =============================================================================
geometry:
  # --- SEAT ---
  - comment: "Seat bottom vertices"
  - vertex: seat_bl_b
    position: { x: "-half_width", y: "seat_height", z: "-half_depth" }
  - vertex: seat_br_b
    position: { x: "half_width", y: "seat_height", z: "-half_depth" }
  - vertex: seat_fr_b
    position: { x: "half_width", y: "seat_height", z: "half_depth" }
  - vertex: seat_fl_b
    position: { x: "-half_width", y: "seat_height", z: "half_depth" }
    
  - comment: "Seat top vertices"
  - vertex: seat_bl_t
    position: { x: "-half_width", y: "seat_top", z: "-half_depth" }
  - vertex: seat_br_t
    position: { x: "half_width", y: "seat_top", z: "-half_depth" }
  - vertex: seat_fr_t
    position: { x: "half_width", y: "seat_top", z: "half_depth" }
  - vertex: seat_fl_t
    position: { x: "-half_width", y: "seat_top", z: "half_depth" }
    
  - comment: "Seat loops"
  - loop: seat_bottom
    type: rect
    vertices: [seat_bl_b, seat_br_b, seat_fr_b, seat_fl_b]
    purpose: structural
  - loop: seat_top
    type: rect
    vertices: [seat_bl_t, seat_br_t, seat_fr_t, seat_fl_t]
    purpose: structural
    
  - comment: "Seat faces"
  - loft: seat_sides
    from: seat_bottom
    to: seat_top
  - cap: seat_top_face
    loop: seat_top
    flip: false
  - cap: seat_bottom_face
    loop: seat_bottom
    flip: true

  # --- LEGS ---
  - comment: "Back-left leg"
  - circle: leg_bl_top
    center: { x: "-leg_x_outer", y: "seat_height", z: "-leg_z_outer" }
    radius: leg_radius
    segments: 8
    purpose: structural
    normal: [0, 1, 0]
  - circle: leg_bl_bottom
    center: { x: "-leg_x_outer", y: "0", z: "-leg_z_outer" }
    radius: "leg_radius * leg_taper"
    segments: 8
    purpose: structural
    normal: [0, 1, 0]
  - loft: leg_bl
    from: leg_bl_bottom
    to: leg_bl_top
  - cap: leg_bl_top_cap
    loop: leg_bl_top
    flip: false
  - cap: leg_bl_bottom_cap
    loop: leg_bl_bottom
    flip: true
    
  # ... (repeat for other 3 legs)
  
  # --- BACK ---
  - comment: "Chair back (conditional on back_style)"
  - when: back_style == "solid"
    geometry:
      - vertex: back_bl
        position: { x: "-half_width + 0.02", y: "seat_top", z: "-half_depth + 0.02" }
      # ... solid back geometry

# =============================================================================
# COMPOSITION (optional) - Include sub-builders
# =============================================================================
compose:
  # Alternative to inline leg geometry: use LegBuilder
  # leg_bl:
  #   builder: Leg
  #   offset: { x: "-leg_x_outer", y: 0, z: "-leg_z_outer" }
  #   overrides:
  #     style: $leg_style  # $ references parent decision
  #     height: seat_height
```

---

## Schema Reference

### Metadata

```yaml
version: "1.0"           # Format version
name: BuilderName        # Unique identifier
description: "..."       # Human-readable description
author: "name"           # Optional
tags: [furniture, chair] # Optional categorization
```

### Decisions

#### Choice Decision
```yaml
decision_name:
  type: choice
  options: [option1, option2, option3]
  weights: [0.5, 0.3, 0.2]  # Optional, defaults to equal
  default: option1          # Optional, used when overridden
```

#### Number Decision
```yaml
decision_name:
  type: number
  min: 0.0
  max: 1.0
  default: 0.5  # Optional, for override
```

#### Boolean Decision
```yaml
decision_name:
  type: boolean
  probability: 0.6  # Chance of true
```

#### Count Decision
```yaml
decision_name:
  type: count
  min: 3
  max: 7
  condition: other_decision == "value"  # Optional
```

### Measurements

#### Fixed Value
```yaml
measurement_name:
  value: 0.45
  source: "Description of why this value"
```

#### With Variation
```yaml
measurement_name:
  base: 0.42
  variation: variation_decision  # Adds decision value to base
  source: "Description"
```

#### Conditional
```yaml
measurement_name:
  value: 0.02
  conditional:
    - if: decision == "value"
      value: 0.018
    - if: decision == "other"
      value: 0.022
```

### Derived Values

Simple expressions using measurements and decisions:
```yaml
derived:
  half_width: "seat_width / 2"
  diagonal: "sqrt(width * width + depth * depth)"
  adjusted: "base_value + (variation * 0.1)"
```

**Accessing constraints with @ prefix:**
```yaml
derived:
  # Clamp natural dimension to parent constraint
  final_width: "min(seat_width, @max_width)"
  
  # Use multiple constraints
  final_height: "min(seat_height + back_height, @max_height)"
  
  # Constraints have automatic fallbacks:
  # @max_* defaults to 999 (no constraint)
  # @min_* defaults to 0 (no constraint)
```

**How @ prefix works:**
- The `@` prefix is transformed to `__constraint_` internally
- Example: `@max_width` becomes `__constraint_max_width`
- This allows MathJS to parse the expression correctly

### Shapes (2D Geometry for Extrusion)

Define 2D shapes that can be extruded into 3D geometry. Used with `extrude2d` command.

#### Rectangle Shape
```yaml
shapes:
  plate:
    type: rect
    width: 2.0
    height: 1.0
    center: { x: 0, z: 0 }  # Optional, defaults to origin
```

#### Circle Shape
```yaml
shapes:
  hub:
    type: circle
    radius: 0.5
    segments: 32  # More segments = smoother circle
    center: { x: 0, z: 0 }
```

#### Ellipse Shape
```yaml
shapes:
  oval_base:
    type: ellipse
    radiusX: 1.0
    radiusZ: 0.6
    segments: 32
    center: { x: 0, z: 0 }
```

#### Polygon Shape
```yaml
shapes:
  custom_profile:
    type: polygon
    points:
      - { x: 0, z: 0 }
      - { x: 1, z: 0 }
      - { x: 1, z: 1 }
      - { x: 0.5, z: 1.5 }
      - { x: 0, z: 1 }
```

#### Text Shape (P2M4-002)
```yaml
shapes:
  sign_text:
    type: text
    content: "HELLO"        # Text string or decision reference
    font: "roboto"          # Font name (must be loaded via text.load command)
    size: 0.5               # Text height in meters
    spacing: 0.02           # Extra spacing between characters (optional)
    center: { x: 0, z: 0 }  # Center position (optional)
```

**Text shape requirements:**
- Font must be loaded before building: `text.load roboto path="./fonts/Roboto-Regular.ttf"`
- Supports TrueType (.ttf) and OpenType (.otf) fonts
- Text can reference decisions: `content: text_content` where `text_content` is a choice decision
- Automatically handles kerning for proper character spacing
- **Current limitation:** Only outer contours are used; holes (like in 'A', 'O') require boolean operations (P2M4-003)

**Using text shapes in geometry:**
```yaml
shapes:
  sign_text:
    type: text
    content: text_content  # References a decision
    font: "roboto"
    size: text_size       # References a measurement
    spacing: 0.02

geometry:
  # Extrude text to 3D
  - extrude2d: text
    shape: sign_text
    depth: 0.05
    bevel:
      size: 0.01
      segments: 2
    color: $text_color
```


**Conditional expressions** using `if()` function:
```yaml
derived:
  # if(condition, then_value, else_value)
  radius: "if(is_round, 0.5, 0.4)"
  
  # Works with comparisons
  abs_value: "if(x > 0, x, -x)"
  
  # Can be nested
  tier: "if(size > 10, 100, if(size > 5, 50, 0))"
  
  # Boolean decisions (0 = false, non-zero = true)
  leg_radius: "if(has_thick_legs, 0.03, 0.02)"
```

**String comparisons** using `eq()` function:
```yaml
derived:
  # Use eq() for string equality with choice decisions in DERIVED expressions
  size_multiplier: "if(eq(sign_size, 'small'), 0.7, if(eq(sign_size, 'large'), 1.4, 1.0))"
  
  # eq() returns 1 for equal, 0 for not equal
  is_oak: "eq(wood_type, 'oak')"  # Returns 1 if oak, 0 otherwise
  
  # Works with any type (strings, numbers, booleans)
  matches: "eq(value, 'expected')"
```

**Note:** For `when:` conditions in geometry sections, use simple `==` syntax instead:
```yaml
geometry:
  - when: "sign_shape == rectangle"  # Simple == in when conditions
    geometry:
      - extrude2d: sign_plate
```

**Supported operators and functions:**
- Arithmetic: `+`, `-`, `*`, `/`, `()`
- Trigonometry: `sin`, `cos`, `tan`, `atan2`
- Math: `sqrt`, `abs`, `min`, `max`, `floor`, `ceil`, `round`
- Comparison: `>`, `<`, `>=`, `<=`, `==`, `!=`
- Conditional: `if(condition, then, else)`
- Constants: `pi`, `e`, `tau`
- **Constraints:** `@constraint_name` (only in child builders)

### Geometry Commands

#### Vertex
```yaml
- vertex: name
  position: { x: "expr", y: "expr", z: "expr" }
```

#### Circle Loop
```yaml
- circle: name
  center: { x: "expr", y: "expr", z: "expr" }
  radius: "expr" | number
  segments: 8
  purpose: structural | animation_joint | seam | detail
  normal: [0, 1, 0]
```

#### Rectangle Loop
```yaml
- loop: name
  type: rect
  vertices: [v1, v2, v3, v4]  # References vertex names
  purpose: structural
```

#### Face
```yaml
- face: name
  vertices: [v1, v2, v3, v4]  # Direct vertex list
  # OR
  loop: loop_name             # From existing loop
  flip: false                 # Reverse winding
```

#### Loft
```yaml
- loft: name
  from: bottom_loop
  to: top_loop
```

#### Cap
```yaml
- cap: name
  loop: loop_name
  flip: true  # For bottom caps
```

#### Comment
```yaml
- comment: "Description of next section"
```

#### Conditional Geometry
```yaml
- when: decision == "value"
  geometry:
    - vertex: ...
    - face: ...
```

### Composition

Reference other builders as sub-components:
```yaml
compose:
  instance_name:
    builder: BuilderName
    offset: { x: "expr", y: "expr", z: "expr" }
    rotation: { x: 0, y: 0, z: 0 }  # Euler angles in radians
    scale: 1.0
    overrides:
      decision_name: value
      measurement_name: 0.5
    constraints:  # NEW (P2-M2d-002): Semantic constraints for child builder
      max_height: 0.9
      max_footprint:
        width: 0.5
        depth: 0.5
      pose:
        facing: center
        angle_tolerance: 15
      required_tags: [seating, stable]
```

Use `$parent_decision` to reference parent builder's decisions in both `overrides` and `constraints`.

**Constraints vs Overrides:**
- **Overrides** force specific decision values (e.g., `style: modern`)
- **Constraints** pass context/requirements that child can query (e.g., `max_height: 0.9`)
- Child builder accesses constraints via `builder.getConstraint('max_height')`
- Constraints are metadata - child is responsible for validation
- Enables semantic relationships like "chair must fit in space" or "face this direction"

**Example:**
```yaml
# Parent builder (RoomWithChair.yaml)
compose:
  chair:
    builder: ChairInBounds
    offset: { x: 0, y: 0, z: 0 }
    constraints:
      max_width: "$chair_area_width"    # Reference parent measurement
      max_depth: "$chair_area_depth"
      max_height: "$chair_max_height"
      message: "Chair must fit in designated area"

# Child builder (ChairInBounds.yaml) can query:
# const maxHeight = builder.getConstraint('max_height');  // 0.9
# const message = builder.getConstraint('message');       // "Chair must fit..."
```

### Shared Context (Cross-Builder Communication)

Scene-level shared state for sibling coordination:
```yaml
# Define shared state at scene level
shared_context:
  theme:
    style: modern
    primary_wood: oak
    accent_color: steel
  spatial:
    room_width: 5.0
    occupied_zones: []

compose:
  table:
    builder: Table
    offset: { x: 0, y: 0, z: 0 }
    read_context: [theme, spatial]          # Read theme and spatial from context
    write_context:
      table_width: "$top_width"              # Write table dimensions back
      table_height: "$height"
  
  chair_1:
    builder: Chair
    offset: { x: -1, y: 0, z: 1.5 }
    read_context: [theme, table_width, table_height]  # Read theme + table size
    write_context:
      chair_1_position: "$position"
```

**How it works:**
- **`shared_context`**: Initial scene-level state (top-level YAML section)
- **`read_context`**: Keys to inject as overrides before building child
- **`write_context`**: Key-value pairs to write back after child builds
  - Values are expressions evaluated in child's context
  - Use `$measurement_name` to reference child measurements
- **Evaluation order**: Sequential (left-to-right), siblings can see previous siblings' writes

**Use cases:**
- Theme coordination (all furniture uses same style/colors)
- Spatial awareness (chairs know table size and position themselves)
- Resource allocation (track occupied zones to avoid collisions)

---

## File Organization

```
builders/
  furniture/
    DiningChair.yaml
    Table.yaml
    Shelf.yaml
  components/
    Leg.yaml
    Stretcher.yaml
  scenes/
    DiningScene.yaml
```

Builders can reference each other via `compose`.

---

## Validation Rules

1. All referenced measurements/decisions must be defined before use
2. All vertex references in loops/faces must exist
3. Loop names must be unique within builder
4. Expressions must be valid mathematical expressions
5. Conditional `if` clauses must reference valid decisions
6. Composed builders must exist in storage

---

## Migration from TypeScript

To convert a TypeScript builder to YAML:

1. Extract all `builder.decide*()` calls → `decisions` section
2. Extract all `builder.defineMeasurement()` → `measurements` section  
3. Extract all `builder.defineDerived()` → `derived` section
4. Extract geometry calls in order → `geometry` section
5. Extract `builder.compose()` calls → `compose` section

The output should be byte-for-byte identical when run with the same seed.

