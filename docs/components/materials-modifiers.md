# Materials & Modifiers

Surface appearance and non-destructive mesh post-processing.

## Materials [implemented — C3-001]

### Current State

Procedurable supports two material systems that work together:

1. **Named color presets** (legacy) — `MaterialLibrary` provides color lookups, applied as vertex colors
2. **Material slots** (C3-001) — PBR-ready named slots with per-face assignment

```typescript
// Legacy: color-only presets
MaterialLibrary.get("oak")     → { r: 0.76, g: 0.60, b: 0.42 }
MaterialLibrary.get("steel")   → { r: 0.78, g: 0.78, b: 0.80 }

// New: full MaterialSlot with PBR properties
interface MaterialSlot {
  name: string;
  color: RGBColor;
  roughness: number;   // 0.0 (mirror) to 1.0 (rough), default 0.5
  metalness: number;   // 0.0 (dielectric) to 1.0 (metal), default 0.0
}
```

### Material Slots in YAML

Builders define named materials with PBR properties in the `materials:` section:

```yaml
materials:
  wood:
    color: wood_oak        # named color, hex (#8B4513), or conditional
    roughness: 0.8
    metalness: 0.0
  metal:
    color: metal_steel
    roughness: 0.2
    metalness: 0.9

geometry:
  - box:
      name: table_top
      center: { x: 0, y: 0.75, z: 0 }
      size: { x: 1.2, y: 0.05, z: 0.8 }
      color: $wood           # $-prefix references a named material slot
  - box:
      name: leg_bracket
      center: { x: 0.5, y: 0.4, z: 0.3 }
      size: { x: 0.05, y: 0.05, z: 0.05 }
      color: $metal          # different material slot
  - box:
      name: accent
      center: { x: 0, y: 0, z: 0 }
      size: { x: 0.1, y: 0.1, z: 0.1 }
      color: '#ff0000'       # inline color — no slot assigned (backward compat)
```

The `$material_name` syntax resolves both the color (for vertex color fallback) and the material slot index (for PBR export).

### Material Pipeline

```
Builder YAML
  │ materials: section defines named MaterialSlots
  ▼
YamlBuilderExecutor (Phase 2.5)
  │ resolveMaterialSlots() → registers slots on Mesh
  ▼
Geometry Commands
  │ resolveGeometryMaterial() → resolves color + slot index
  │ Face created with both color AND materialSlotIndex
  ▼
Mesh
  │ materialSlots: MaterialSlot[] (deduplicated by name)
  │ faces[i].materialSlotIndex → index into materialSlots
  │ faces[i].color → vertex color fallback
  ▼
Output format:
  ├── Dashboard: renders vertex colors (existing)
  ├── PSD: material slots serialized (existing B2)
  └── glTF: PBR materials from slots (planned C6)
```

### Key Design Decisions

- **Per-face, not per-vertex:** Material assignment is per-face via `Face.materialSlotIndex`, not per-vertex
- **Deduplication:** `Mesh.addMaterialSlot()` deduplicates by name — same name returns existing index
- **Merge-safe:** `Mesh.merge()` remaps slot indices so merged meshes maintain correct assignments
- **Backward compatible:** Faces without a slot index fall back to vertex colors
- **`$`-prefix convention:** `$wood` in geometry commands means "use the material slot named wood"; `wood_oak` without `$` means "use the named color directly"

### Why Slots Matter

- **Consistency:** All `$wood` surfaces across a scene use the same material
- **Export-ready:** glTF needs material definitions, not vertex colors
- **PBR properties:** roughness and metalness travel with the slot, not just color
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
