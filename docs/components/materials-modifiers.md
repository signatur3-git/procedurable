# Materials & Modifiers

Surface appearance and non-destructive mesh post-processing.

## Materials [minimal]

### Current State

`MaterialLibrary` provides named color presets. Materials are applied as vertex colors — no UV-based texturing, no PBR properties.

```typescript
MaterialLibrary.get("oak")     → { r: 0.76, g: 0.60, b: 0.42 }
MaterialLibrary.get("steel")   → { r: 0.78, g: 0.78, b: 0.80 }
```

### Target State: Named Material Slots [planned — C3]

Instead of painting vertex colors, builders assign **named material slots** to mesh regions:

```yaml
materials:
  seat:
    slot: primary_wood
    default: oak
  legs:
    slot: primary_wood
    default: $seat_material    # inherits from seat decision
  cushion:
    slot: fabric
    default: linen_cream
```

Each slot has a name, a default value, and can be overridden. At export time, slots map to:
- Vertex colors (current dashboard)
- PBR material definitions (glTF export)
- Material IDs (renderer integration)

### Material Pipeline

```
Builder YAML
  │ declares material slots
  ▼
TracedBuilder
  │ assigns slot to each face during geometry creation
  ▼
Mesh faces tagged with slot name
  │
  ▼ (at export/render time)
MaterialResolver
  │ maps slot name → concrete material properties
  │ (color, roughness, metallic, texture)
  ▼
Output format (vertex colors / glTF materials / etc.)
```

### Why Slots Matter

- **Consistency:** All "primary_wood" surfaces across a scene use the same material
- **Override-friendly:** Agent says `material.set primary_wood walnut` and everything updates
- **Export-ready:** glTF needs material definitions, not vertex colors
- **Quality tier:** Tier 2 requires >= 2 distinct materials

## Modifiers [planned]

Non-destructive operations applied after base geometry creation.

### ModifierStack Concept

```yaml
geometry:
  - create: seat_base
    # ... base geometry steps ...

modifiers:
  - type: subdivision
    target: seat_base
    levels: 2

  - type: bevel
    target: seat_base
    edges: sharp    # only sharp edges
    width: 0.005
    segments: 3

  - type: noise_displacement
    target: seat_base
    amplitude: 0.001
    frequency: 10
    seed: $surface_seed
```

Modifiers are applied in order, each taking the output of the previous one.

### Planned Modifiers

| Modifier | Effect | Depends On |
|----------|--------|------------|
| `subdivision` | Catmull-Clark smoothing | [exists] as direct call, needs stack integration |
| `bevel` | Edge rounding | [planned — C2] |
| `chamfer` | Edge flat cut | [planned — C2] |
| `noise_displacement` | Organic surface variation | [planned — C5] |
| `bend` | Curve along axis | [planned — C5] |
| `twist` | Progressive rotation | [planned — C5] |
| `taper` | Progressive scale | [planned — C5] |
| `lattice` | Free-form deformation | [planned — C5] |

### Why a Stack

Without a modifier stack, every geometry operation is destructive and baked into the builder steps. With a stack:

- Modifiers can be toggled on/off per quality tier (Tier 1 skips bevel, Tier 2 includes it)
- Agents can add/remove modifiers without rewriting geometry steps
- LOD generation: apply fewer modifiers for lower detail levels
- Experimentation: try different combinations without changing the builder
