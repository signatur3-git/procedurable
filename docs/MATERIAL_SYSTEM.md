# Material System Design

> Sustainable architecture for decision-driven procedural materials.

## Design Goals

1. **Maintainable**: Clear separation between material definition, resolution, and rendering
2. **Extensible**: Easy to add new material properties (roughness, metalness, normal maps)
3. **Consistent**: Uses same patterns as measurements/decisions (conditionals, expressions)
4. **Forward-compatible**: Supports texture baking and PBR in later steps

---

## Baking Architecture

### Types of Baked Maps

We distinguish between **mesh-derived maps** and **detail maps**:

#### Mesh-Derived Maps (from geometry only)
These can be computed from the mesh topology without knowing about materials:

| Map Type | Source | Use Case |
|----------|--------|----------|
| **AO Map** | Ray-traced occlusion | Dirt in crevices, shadows |
| **Curvature Map** | Mesh normals + neighbors | Edge wear, chipping |
| **Position/Height** | World Y coordinate | Gradient effects, weathering |
| **Thickness** | Ray-traced interior distance | Subsurface scattering |

#### Detail Maps (from sculpting/decoration)
These capture high-frequency detail that modifies the base mesh:

| Map Type | Source | Use Case |
|----------|--------|----------|
| **Normal Map** | High-poly → low-poly bake | Scratches, wood grain, carved details |
| **Displacement** | Sculpt delta | Real geometry displacement |
| **Mask Map** | Painted regions | Material zones, wear patterns |

### Baking Pipeline

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           GEOMETRY PIPELINE                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Base Mesh (YAML geometry)                                                │
│       │                                                                   │
│       ├──→ Mesh-Derived Maps (AO, curvature, position)                   │
│       │         ↓                                                         │
│       │    Layer Stack (smart materials use these)                        │
│       │                                                                   │
│       └──→ Sculpting/Detail (optional, Phase 2+)                         │
│                 │                                                         │
│                 ├──→ High-poly mesh (with scratches, details)            │
│                 │         ↓                                               │
│                 └──→ Detail Maps (normal map, displacement)              │
│                           ↓                                               │
│                      Combined with layer stack                            │
│                           ↓                                               │
│                      Final PBR Textures                                   │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Mesh-derived maps are computed first**
   - AO, curvature, position can be baked from any mesh
   - No dependency on sculpting tools
   - Smart materials use these (e.g., "worn edges" uses curvature)

2. **Sculpting adds detail AFTER base geometry**
   - Scratches, grain, carved details are "overlays"
   - Baked to normal maps (high → low poly transfer)
   - Can be procedural (noise-based scratches) or hand-sculpted

3. **Both systems feed the layer stack**
   - Mesh-derived: masks for smart materials
   - Sculpted: additional normal/displacement
   - Combined in final output

4. **Re-baking is incremental**
   - Change mesh → re-bake mesh-derived maps
   - Change sculpt → re-bake detail maps
   - Change material params → no re-bake needed

### Future Sculpting Integration

When we add sculpting tools (scratches, wood grain, etc.), they will:

```yaml
geometry:
  - box: table_top
    # ... vertices ...

  # Future: Sculpting operations
  sculpt:
    - target: table_top
      tool: scratch
      params:
        depth: 0.002
        count: { random: [3, 8] }
        angle_range: [0, 180]

    - target: table_top
      tool: wood_grain
      params:
        direction: [1, 0, 0]
        density: 0.5
        depth: 0.001
```

These sculpt operations would:
1. Modify the mesh (or create a displacement map)
2. Trigger normal map baking
3. Be combined with material layers

The baking system will be designed to **re-run when geometry changes** without breaking the material definitions. Materials reference the baked maps by name, not by the specific geometry that created them.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      YAML Builder Definition                     │
├─────────────────────────────────────────────────────────────────┤
│  decisions:                                                      │
│    wood_type: { type: choice, options: [oak, walnut, cherry] }  │
│                                                                  │
│  materials:                                                      │
│    seat_wood:                                                    │
│      color:                                                      │
│        default: wood_oak                                         │
│        when:                                                     │
│          - if: wood_type == walnut                               │
│            value: wood_walnut                                    │
│          - if: wood_type == cherry                               │
│            value: wood_cherry                                    │
│      roughness: 0.7                                              │
│                                                                  │
│  geometry:                                                       │
│    - loft: seat_surface                                          │
│      color: $seat_wood                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Material Resolution (Runtime)                 │
├─────────────────────────────────────────────────────────────────┤
│  1. Decisions are made (wood_type = "walnut")                   │
│  2. Materials are resolved:                                      │
│     - Evaluate conditionals against decision values              │
│     - Resolve color references (wood_walnut → RGB)               │
│     - Store in MaterialContext                                   │
│  3. Geometry references materials ($seat_wood)                   │
│  4. Faces get resolved RGB colors                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Mesh Output (with colors)                     │
├─────────────────────────────────────────────────────────────────┤
│  vertices: [...], normals: [...], colors: [...], hasColors: true │
└─────────────────────────────────────────────────────────────────┘
```

---

## YAML Schema

### Material Definition (Extended)

```yaml
materials:
  # Simple static material
  metal_frame:
    color: metal_steel
    roughness: 0.3
    metalness: 0.9

  # Decision-driven material
  seat_wood:
    color:
      default: wood_oak
      when:
        - if: wood_type == walnut
          value: wood_walnut
        - if: wood_type == cherry
          value: wood_cherry
        - if: wood_type == pine
          value: wood_pine
    roughness:
      default: 0.7
      when:
        - if: finish == gloss
          value: 0.3
        - if: finish == matte
          value: 0.9
    metalness: 0.0

  # Expression-based properties
  worn_wood:
    color: wood_oak
    roughness: "0.5 + age * 0.05"  # Expression using decisions
```

### Color Value Types

```yaml
# Hex string
color: "#8B4513"

# Named color (from library)
color: wood_oak

# RGB object
color: { r: 0.5, g: 0.3, b: 0.2 }

# Conditional
color:
  default: wood_oak
  when:
    - if: condition
      value: wood_walnut
```

---

## Implementation Plan

### Phase 1: Conditional Colors (Step 2)

1. **Extend YamlMaterial schema** to support conditional values
2. **Add MaterialContext** to track resolved materials
3. **Resolve materials after decisions** in parser
4. **Update resolveGeometryColor** to use MaterialContext

### Phase 2: Full PBR Properties (Step 3-4)

1. Add roughness, metalness to Face/mesh output
2. Extend dashboard renderer for PBR
3. Support expressions in material properties

### Phase 3: Texture Baking (Step 5-6)

1. Add mesh map generation (AO, curvature)
2. Layer stack for procedural textures
3. Material editor UI

---

## Material Library

Pre-defined named colors organized by category:

```typescript
const MATERIAL_LIBRARY = {
  // Woods
  wood_oak:      { r: 0.545, g: 0.353, b: 0.169 },
  wood_walnut:   { r: 0.373, g: 0.235, b: 0.157 },
  wood_cherry:   { r: 0.545, g: 0.271, b: 0.208 },
  wood_pine:     { r: 0.722, g: 0.580, b: 0.380 },
  wood_mahogany: { r: 0.400, g: 0.200, b: 0.133 },
  wood_maple:    { r: 0.735, g: 0.604, b: 0.459 },
  wood_ebony:    { r: 0.180, g: 0.150, b: 0.130 },
  
  // Metals
  metal_steel:   { r: 0.600, g: 0.600, b: 0.620 },
  metal_brass:   { r: 0.710, g: 0.650, b: 0.259 },
  metal_copper:  { r: 0.722, g: 0.451, b: 0.200 },
  metal_gold:    { r: 0.831, g: 0.686, b: 0.216 },
  metal_silver:  { r: 0.753, g: 0.753, b: 0.753 },
  
  // Fabrics
  fabric_red:    { r: 0.698, g: 0.133, b: 0.133 },
  fabric_blue:   { r: 0.200, g: 0.329, b: 0.529 },
  fabric_green:  { r: 0.235, g: 0.420, b: 0.235 },
  fabric_beige:  { r: 0.761, g: 0.698, b: 0.502 },
  fabric_brown:  { r: 0.396, g: 0.263, b: 0.129 },
  
  // Stone
  stone_marble:  { r: 0.941, g: 0.933, b: 0.898 },
  stone_granite: { r: 0.502, g: 0.502, b: 0.502 },
  stone_slate:   { r: 0.439, g: 0.502, b: 0.565 },
  
  // Basic
  white:         { r: 1.0, g: 1.0, b: 1.0 },
  black:         { r: 0.1, g: 0.1, b: 0.1 },
  gray:          { r: 0.5, g: 0.5, b: 0.5 },
};
```

---

## Code Structure

```
src/
  builder/
    YamlBuilderParser.ts     # Extended with material resolution
    MaterialLibrary.ts       # Named colors and presets (NEW)
    MaterialContext.ts       # Runtime material state (NEW)
  
  geometry/
    Face.ts                  # Already has color property
    Mesh.ts                  # Already serializes colors
```

---

## Migration Path

### Current (Step 1)
```yaml
materials:
  seat_wood:
    color: wood_pine
```

### Step 2 (Conditional)
```yaml
materials:
  seat_wood:
    color:
      default: wood_oak
      when:
        - if: wood_type == pine
          value: wood_pine
```

### Step 3+ (Full PBR)
```yaml
materials:
  seat_wood:
    color: { ... }
    roughness: 0.7
    metalness: 0.0
    normalMap: generated  # Later
```

The schema is **additive** - old YAML files continue to work.

