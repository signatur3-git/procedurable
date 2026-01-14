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

Supported operators: `+`, `-`, `*`, `/`, `()`, `sqrt`, `sin`, `cos`, `abs`, `min`, `max`

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
```

Use `$parent_decision` to reference parent builder's decisions.

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

