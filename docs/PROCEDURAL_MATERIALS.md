# Procedural Materials Design

> Substance Painter-like procedural materials for builders

## Vision

Just like builders generate meshes procedurally, **MaterialBuilders** generate materials procedurally. Materials can respond to the same decisions as the mesh (e.g., `wood_type: oak | walnut | pine`) and produce coordinated textures.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Builder                                                                │
│  ├── Mesh generation (existing)                                         │
│  └── Material generation (new)                                          │
│       ├── Albedo map (baked texture)                                    │
│       ├── Roughness map (baked texture)                                 │
│       ├── Normal map (baked from high-poly or procedural)               │
│       ├── Metalness map (baked texture)                                 │
│       ├── AO map (baked from geometry)                                  │
│       └── Mask maps (dirt, wear, edge wear, cavity)                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## How Substance Painter Actually Works

Substance Painter's power comes from **layers of baked maps** combined with **procedural generators**:

1. **Mesh Maps (Baked from Geometry)**
   - Ambient Occlusion (AO) - shadows in crevices
   - Curvature - convex/concave edges
   - World Space Normal - orientation
   - Position - world coordinates for gradients
   - Thickness - for subsurface scattering

2. **Smart Materials (Use Mesh Maps)**
   - "Add dirt to crevices" → uses AO + Curvature maps
   - "Wear on edges" → uses Curvature map (convex = wear)
   - "Rust drips" → uses Position map (gravity direction)

3. **Procedural Generators**
   - Noise patterns (Perlin, Voronoi, etc.)
   - Grunge maps (pre-made dirt/scratch textures)
   - Pattern generators (brick, tile, fabric weave)

4. **Final Bake**
   - All layers composited to final PBR textures
   - Albedo, Roughness, Metalness, Normal, AO

## Our Architecture: Texture-First

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Step 1: Mesh Map Baking (from geometry)                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  TracedBuilder output mesh                                       │   │
│  │         │                                                        │   │
│  │         ▼                                                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │   │
│  │  │ AO Map      │  │ Curvature   │  │ Position    │              │   │
│  │  │ (ray-traced │  │ Map         │  │ Map         │              │   │
│  │  │  or SSAO)   │  │ (edge detect)│  │ (world XYZ) │              │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Step 2: Material Layer Stack                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Layer 3: Edge Wear        [Mask: Curvature > 0.7]              │   │
│  │           Color: lighter, Roughness: higher                      │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  Layer 2: Dirt in Crevices [Mask: AO < 0.5]                     │   │
│  │           Color: darker brown, Roughness: higher                 │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  Layer 1: Base Wood        [Mask: none]                         │   │
│  │           Procedural wood grain texture                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Step 3: Final Texture Bake                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ Albedo.png  │  │ Roughness   │  │ Normal.png  │  │ Metalness   │   │
│  │ (RGB)       │  │ .png (R)    │  │ (RGB)       │  │ .png (R)    │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Mesh Maps (Baked from Geometry)

These are computed from the mesh itself, not authored:

| Map | Source | Use |
|-----|--------|-----|
| **AO** | Ray-traced or SSAO from mesh | Dirt accumulation, shadows |
| **Curvature** | Second derivative of surface | Edge wear, highlights |
| **Cavity** | Inverted curvature (concave) | Dirt in cracks |
| **Position** | World XYZ normalized | Gradient effects, gravity |
| **World Normal** | Surface orientation | Top/bottom masks |
| **Thickness** | Ray-traced inside mesh | Subsurface, thin areas |

### Implementation Options

**GPU-based (WebGL/Three.js):**
- Render mesh from multiple angles
- Compute AO via screen-space techniques
- Fast but approximate

**CPU-based (Ray tracing):**
- Accurate AO and thickness
- Slower but precise
- Could use existing geometry code

**Hybrid:**
- Simple maps (position, normal) on GPU
- Complex maps (AO, thickness) on CPU or WebWorker

---

## Grunge/Detail Maps (Asset Library)

Pre-made textures that add realism:

```
assets/
├── grunge/
│   ├── dirt_01.png        # Organic dirt patterns
│   ├── dirt_02.png
│   ├── scratches_01.png   # Surface scratches
│   ├── fingerprints.png   # Smudges
│   └── water_stains.png   # Drip marks
├── patterns/
│   ├── wood_grain_oak.png
│   ├── wood_grain_walnut.png
│   ├── fabric_weave.png
│   └── leather_pores.png
└── normals/
    ├── wood_grain_normal.png  # Baked from sculpt
    ├── fabric_normal.png
    └── scratches_normal.png
```

These can be:
- Procedurally generated once and cached
- Hand-authored or sourced from CC0 libraries
- Generated per-material with different seeds

---

## Normal Maps: Three Sources

### 1. Detail Normals (from texture library)
Pre-baked normal maps for micro-detail:
- Wood grain bumps
- Fabric weave
- Leather pores

### 2. Procedural Normals (computed from height)
Generate height map procedurally, derive normal:
```typescript
// Height from noise
const height = perlinNoise(uv * scale);
// Normal from height gradient
const normal = computeNormalFromHeight(heightMap);
```

### 3. Baked Normals (from high-poly sculpt)
For complex shapes, sculpt high-poly and bake to low-poly:
```
High-poly mesh (100k verts) → Bake → Normal map → Low-poly mesh (1k verts)
```

This is advanced - we'd need a sculpting system or import from external tools.

---

## Material Layer System

Like Substance Painter, materials are built from layers:

```yaml
material:
  name: "WornWood"
  
  # Mesh maps (auto-generated from geometry)
  mesh_maps:
    ao: { resolution: 1024, samples: 64 }
    curvature: { resolution: 1024 }
    position: { resolution: 1024 }
  
  layers:
    # Base layer - wood grain
    - name: "base_wood"
      mask: null  # Full coverage
      albedo:
        type: texture
        source: "patterns/wood_grain_${wood_type}.png"
        tint: { oak: "#c4a66b", walnut: "#5c4033", pine: "#f5deb3" }
      roughness: 0.5
      normal:
        type: texture
        source: "normals/wood_grain_normal.png"
        strength: 0.5
    
    # Dirt in crevices
    - name: "crevice_dirt"
      mask:
        type: mesh_map
        source: ao
        remap: { in: [0.3, 0.6], out: [1, 0] }  # Dirt where AO is low
      albedo:
        type: multiply
        color: "#3d2817"
        blend: 0.7
      roughness: 0.8
    
    # Edge wear
    - name: "edge_wear"
      mask:
        type: mesh_map
        source: curvature
        remap: { in: [0.5, 0.8], out: [0, 1] }  # Wear on convex edges
      albedo:
        type: lighten
        amount: 0.15
      roughness: 0.3  # Worn = smoother
    
    # Random scratches
    - name: "scratches"
      mask:
        type: texture
        source: "grunge/scratches_01.png"
        scale: 2.0
        threshold: 0.7
      albedo:
        type: lighten
        amount: 0.1
      roughness: 0.4
      normal:
        type: texture
        source: "normals/scratches_normal.png"
        strength: 0.3
```

---

## DSL Commands

```bash
# Mesh map baking
material.bake_mesh_maps resolution=1024
material.bake_ao samples=64
material.bake_curvature

# Create material with layers
material.create WornWood
material.add_layer base_wood
material.set_layer_albedo base_wood texture=wood_grain_oak.png
material.set_layer_roughness base_wood 0.5

material.add_layer dirt
material.set_layer_mask dirt mesh_map=ao remap=0.3,0.6,1,0
material.set_layer_albedo dirt multiply=#3d2817 blend=0.7

# Assign to parts
builder.set_material seat WornWood
builder.set_material legs WornWood

# Final bake
material.bake WornWood resolution=2048 format=png
```

---

## Implementation Phases (Revised)

### Phase 5a: Mesh Map Baking
- Implement AO baking (CPU ray-traced or GPU SSAO)
- Implement curvature map computation
- Implement position/normal map export
- Store as textures per-builder-run

### Phase 5b: Layer Stack System
- Layer data structure with masks and blend modes
- Texture sampling with tiling/scale
- Layer compositing (multiply, overlay, add, etc.)

### Phase 5c: Grunge Library
- Curate/generate base grunge textures
- Procedural grunge generators (noise-based)
- Normal map generation from height

### Phase 5d: Smart Materials
- Pre-built material presets (worn wood, rusty metal, etc.)
- Decision-driven material switching
- Material inheritance in composed builders

### Phase 5e: Material Editor UI
- Visual layer stack editor
- Mask preview with mesh maps
- Real-time preview in dashboard

---

## File Structure (Revised)

```
src/
├── material/
│   ├── MaterialBuilder.ts       # Layer stack evaluation
│   ├── MeshMapBaker.ts          # AO, curvature, position baking
│   ├── TextureCompositor.ts     # Layer blending
│   ├── LayerMask.ts             # Mask evaluation
│   ├── GrungeGenerator.ts       # Procedural grunge
│   └── NormalMapGenerator.ts    # Height → Normal conversion
├── authoring/
│   └── commands/
│       └── material.ts          # material.* DSL handlers
└── dashboard/
    └── MaterialEditor.vue       # Layer stack UI

assets/
├── grunge/                      # Dirt, scratch, stain textures
├── patterns/                    # Wood, fabric, leather patterns
└── normals/                     # Pre-baked normal details
```

---

## Three.js Integration

```typescript
// Load baked textures
const albedo = textureLoader.load('baked/chair_albedo.png');
const roughness = textureLoader.load('baked/chair_roughness.png');
const normal = textureLoader.load('baked/chair_normal.png');
const ao = textureLoader.load('baked/chair_ao.png');

// Apply to material
const material = new THREE.MeshStandardMaterial({
  map: albedo,
  roughnessMap: roughness,
  normalMap: normal,
  aoMap: ao,
  aoMapIntensity: 1.0,
});

// Mesh needs UV2 for AO
geometry.setAttribute('uv2', geometry.getAttribute('uv'));
```

---

## Questions Resolved

| Question | Answer |
|----------|--------|
| UV unwrapping | Auto-generate with box/cylinder/planar projection |
| Texture resolution | Configurable per-material (512, 1024, 2048) |
| Normal maps | Three sources: detail library, procedural, baked from high-poly |
| Export format | Baked PNGs, bundled with glTF |
| Mesh maps | Baked per-builder-run, cached for re-use |

---

## Priority

This is a **Phase 5** feature (after M1-M4). The revised phases:

1. **5a**: Mesh map baking (AO, curvature) - foundation
2. **5b**: Layer stack system - core functionality  
3. **5c**: Grunge library - realism
4. **5d**: Smart materials - usability
5. **5e**: Material editor UI - authoring

Prep work in earlier phases:
- M2: UV generation in TracedBuilder
- M3: Material field in part definitions
- M4: Basic color/roughness assignment

