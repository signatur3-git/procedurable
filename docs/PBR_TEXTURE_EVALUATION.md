# PBR Texture Authoring Evaluation

> **Status:** ✅ Integrated into Phase 3 planning (Track G3-G6)
> **Date:** 2026-02-03
> **Purpose:** Design document for the procedural PBR texture pipeline
> **Stories:** See `BACKLOG.md` G3-001 through G6-004 for implementation details

---

## The Vision

What if builders could author not just geometry, but **complete PBR texture maps** procedurally? An agent wouldn't just say "use oak material" — it would procedurally generate the wood grain pattern, the subtle color variations, the surface scratches, and the wear patterns. Every texture would be deterministic (same seed = same result) and controlled by the same decision-driven philosophy that governs geometry.

This document explores what that would require.

---

## What "Full PBR Textures" Means

A production-ready PBR (Physically Based Rendering) material typically includes:

| Map | Purpose | Generation Challenge |
|-----|---------|---------------------|
| **Albedo** (Base Color) | Surface color without lighting | Pattern + color variation + staining |
| **Normal** | Surface detail bumps | Height field → normal conversion |
| **Roughness** | Surface smoothness | Wear patterns, polish, grime |
| **Metallic** | Metal vs. non-metal | Usually binary, but metal edges/patina |
| **Height/Displacement** | Actual surface deformation | Carving, grain, dents |
| **Ambient Occlusion** | Crevice darkening | Computed from geometry + height |
| **Emissive** | Glowing regions | Domain-specific (LEDs, fire, magic) |

For believable results, these maps must be **coherent** — the wood grain in the normal map must match the grain in the albedo and roughness maps.

---

## The Substance Painter Model

Substance Painter (and Designer) works through **layers and generators**:

```
Layer Stack:
├── Base Material (procedural wood grain)
├── Edge Wear Generator (uses curvature + ambient occlusion)
├── Dirt Generator (uses ambient occlusion + position)
├── Scratch Layer (uses noise + directionality)
└── Custom Paint (hand-painted or masked regions)
```

Key insight: **generators use mesh data** (curvature, ambient occlusion, world position, UV islands) to intelligently place effects.

### What Makes It Non-Deterministic

In Substance Painter:
- Random seeds are hidden/automatic
- Generators use unpredictable mesh analysis
- Hand-painting is inherently non-deterministic
- Preview updates can drift from final bake

### What a Deterministic Version Would Need

1. **Explicit seeds at every level** — material, layer, generator, noise
2. **Mesh analysis as reproducible data** — curvature, AO, position baked to predictable buffers
3. **No hand-painting** — all "painting" through procedural masks and rules
4. **Rule-based wear** — "edges wear first", "low areas collect dirt" as evaluatable expressions

---

## A Procedural Texture Stack in YAML

```yaml
materials:
  oak_wood:
    type: procedural
    seed: 42
    
    # Base layer: procedural wood grain
    layers:
      - name: base_grain
        generator: wood_grain
        params:
          species: oak
          ring_spacing: { base: 0.02, variation: 0.3 }
          ray_density: 0.4
          color_dark: "#5a3d2b"
          color_light: "#8b6914"
        outputs:
          albedo: blend
          normal: height_to_normal
          roughness: grain_roughness
          
      # Edge wear: uses curvature analysis
      - name: edge_wear
        generator: curvature_wear
        params:
          convex_wear: 0.7      # edges wear more
          intensity: 0.3
          seed: 17
        mask: curvature > 0.5
        outputs:
          albedo: lighten 0.1
          roughness: increase 0.2
          
      # Dirt accumulation: uses AO
      - name: grime
        generator: dirt_accumulation
        params:
          color: "#2a2015"
          intensity: 0.15
        mask: ao < 0.3 AND position.y < $seat_height
        outputs:
          albedo: multiply
          roughness: increase 0.1
          
      # Scratches: directional noise
      - name: scratches
        generator: scratch_pattern
        params:
          density: 0.1
          direction: { type: radial, center: [0.5, 0.5] }
          depth: 0.001
          seed: 23
        outputs:
          normal: scratch_normal
          roughness: scratch_roughness
```

### Key Design Decisions

1. **Layers are declarative** — no imperative "paint this pixel"
2. **Generators are platform-provided** — agents compose them, don't write them
3. **Masks are expressions** — use mesh analysis (curvature, AO, position) + builder measurements
4. **Every random element has explicit seed** — determinism preserved

---

## Required Platform Capabilities

### Mesh Analysis Pipeline

Before texture generation, the mesh must be analyzed:

```typescript
interface MeshAnalysis {
  // Per-vertex data (interpolated to UV space)
  curvature: Float32Array;      // -1 (concave) to +1 (convex)
  ambientOcclusion: Float32Array;
  worldPosition: Vec3Array;
  
  // Per-face data
  faceNormals: Vec3Array;
  faceArea: Float32Array;
  
  // UV-space metrics
  uvIslandIds: Uint16Array;     // Which UV island each texel belongs to
  uvSeamDistance: Float32Array; // Distance to nearest UV seam
}
```

This analysis must be **deterministic** — same mesh + same UV layout = same analysis results.

### Noise Function Library

Procedural textures need a rich noise library:

| Noise Type | Use Case |
|------------|----------|
| Perlin / Simplex | Organic variation, clouds |
| Worley (Voronoi) | Cell patterns, scales, stones |
| FBM (Fractal Brownian Motion) | Layered detail, terrain |
| Domain Warping | Distorted patterns, wood grain |
| Gradient | Color ramps, directional effects |
| Scratches | Directional line noise |
| Splatter | Paint drops, stains |

All must be:
- Seeded and reproducible
- Tileable (optional)
- Evaluatable at arbitrary UV coordinates

### Generators (Domain-Specific)

Generators combine noise with domain knowledge:

```typescript
interface TextureGenerator {
  name: string;
  domain: string;  // "wood", "metal", "fabric", etc.
  params: ParamSchema;
  
  evaluate(
    uv: Vec2,
    params: Record<string, any>,
    meshAnalysis: MeshAnalysis,
    seed: number
  ): {
    albedo?: Color;
    normal?: Vec3;
    roughness?: number;
    metallic?: number;
    height?: number;
  };
}
```

Example generators:

| Generator | Domain | What It Produces |
|-----------|--------|-----------------|
| `wood_grain` | Wood | Ring patterns, rays, color variation |
| `metal_brushed` | Metal | Directional scratches, polish variation |
| `fabric_weave` | Fabric | Weave patterns (plain, twill, satin) |
| `stone_marble` | Stone | Veining, color bands, crystal structure |
| `leather_grain` | Leather | Pebble texture, wrinkles, pores |
| `rust_patina` | Metal | Oxidation patterns, edge concentration |
| `dirt_accumulation` | Any | AO-driven grime accumulation |
| `edge_wear` | Any | Curvature-driven wear patterns |

### UV-Space Evaluation

Textures are generated in UV space, but generators need world-space context:

```
For each texel at UV (u, v):
  1. Find the face(s) that map to this UV location
  2. Interpolate world position, normal, curvature, AO
  3. Evaluate all layers bottom-to-top
  4. Blend outputs according to layer blend modes
  5. Write to output texture(s)
```

This requires **UV → World mapping** that's stable and deterministic.

---

## Agent Workflow

How would an agent "paint" a procedural texture?

### 1. Material Selection (Knowledge-Driven)

```
world.get materials.wood.oak.*
→ { color_range: [...], grain_density: 0.02-0.05, typical_roughness: 0.4-0.7 }

world.get styles.mid_century_modern.wood_finish
→ { preferred_species: [walnut, teak], finish: "oiled", wear: "light" }
```

### 2. Layer Stack Construction

```
builder.add_material oak_procedural type=procedural domain=wood
builder.material_layer oak_procedural base generator=wood_grain species=oak
builder.material_layer oak_procedural wear generator=edge_wear intensity=0.2
builder.material_layer oak_procedural finish generator=oil_finish
```

### 3. Regional Variation (Expression-Based Masks)

```yaml
# Apply more wear to seat top vs. legs
layers:
  - name: seat_wear
    generator: surface_wear
    mask: part_name == "seat" AND position.y > $seat_height - 0.01
    params:
      intensity: 0.5
      pattern: use_direction  # wear follows sitting direction
```

### 4. Quality Validation

```
builder.quality tier=3
→ FAIL: texture_resolution < 1024
→ FAIL: roughness_variation < 0.1 (surfaces look plastic)
→ PASS: all maps coherent
→ PASS: UV utilization > 85%
```

---

## The "Automatic Substance Painter" Fantasy

The ultimate vision: an agent describes **intent**, and the system generates appropriate textures.

### Intent-Based Material Description

```yaml
materials:
  vintage_chair_wood:
    intent:
      base: oak, medium tone
      age: 50 years
      use: heavy (restaurant, daily use)
      environment: indoor, humid summers
      style: honest wear (not artificial distressing)
    
    # System translates intent to layers:
    # → wood_grain with age-darkened color
    # → edge_wear concentrated on armrests, seat front
    # → dirt in crevices, lighter on high-touch areas
    # → finish worn through on edges, intact in recesses
```

### What This Requires

1. **Domain ontology** — what does "50 years of use" mean for oak vs. pine vs. metal?
2. **Wear simulation models** — where do hands touch a chair? where does water pool?
3. **Material aging knowledge** — how does oak darken? where does rust form?
4. **Style interpretation** — "honest wear" vs. "distressed" vs. "pristine"

This is essentially **encoding the knowledge of a materials artist** into evaluatable rules.

---

## Implementation Phases (If We Did This)

### Phase T0: Fix Current UV Issues (Foundation)

Before any procedural texturing, fix the basics:

1. **Per-operation UV generation** — every geometry command outputs correct UVs
   - Box: 6 planar projections with world-scale
   - Lathe: cylindrical + planar caps
   - Extrude: cylindrical sides + planar caps
   - Loft: interpolated from edge loops
   - Boolean: re-project cut faces

2. **UV quality metrics** — detect and report problems
   - Stretch measurement
   - Coverage check (faces without UVs)
   - Texel density calculation

3. **Dashboard checker preview** — visualize UV quality in real-time

**Estimated effort:** 2-3 weeks
**Prerequisite for:** Everything else

### Phase T1: Smart Unwrap and Atlas

Global UV unwrapping for production-quality UVs:

1. **Angle-based unwrapping** — segment mesh by normal angles
2. **Distortion minimization** — ABF/LSCM algorithms
3. **Island packing** — efficient texture space utilization
4. **Seam control** — hints for where to place cuts

**Estimated effort:** 3-4 weeks
**Enables:** Consistent texel density, efficient texture use

### Phase T2: Procedural Texture Foundation
- Mesh analysis pipeline (curvature, AO, position in UV space)
- Noise function library (Perlin, Worley, FBM, domain warp)
- Single-layer procedural material evaluation
- YAML schema for procedural materials

### Phase T3: Layer Stack
- Multi-layer composition with blend modes
- Expression-based masks using mesh analysis
- Generator plugin architecture
- Basic generators: solid, noise, gradient

### Phase T4: Domain Generators
- Wood grain generator (species-aware)
- Metal generators (brushed, polished, aged)
- Fabric generators (weave patterns)
- Stone generators (marble, granite)
- Wear generators (edge, surface, AO-driven)

### Phase T5: Decals and Text
- Decal projection system (planar, cylindrical, spherical)
- Text rasterization (reuse TrueType parsing)
- UV-space compositing
- Agent workflow for branded variants

### Phase T6: Intent System
- Material aging models
- Use-pattern simulation (touch, moisture, UV exposure)
- Style-to-generator translation
- Quality gates for texture realism

### Phase T7: Integration
- Bake procedural textures to image files
- glTF export with texture maps
- Real-time preview in dashboard
- Agent authoring workflow

---

## Quick Win: Triplanar as Fallback

Even without fixing all UV issues, **triplanar projection** provides immediate value:

```yaml
materials:
  wood:
    type: procedural
    projection: triplanar  # Ignore UVs entirely
    scale: 1.0
    layers:
      - generator: wood_grain
```

**Benefits:**
- Works today with current geometry
- No UV fixes required
- Grain flows continuously across parts
- Deterministic (seed-controlled)

**Limitations:**
- Blending artifacts on angled surfaces
- Can't do fine detail or text
- Not suitable for all material types

This could be a **Phase T0.5** deliverable — immediate procedural textures without solving the UV problem.

---

## Open Questions

### Q1: UV Layout Responsibility

Who creates the UV layout? Currently UVs are auto-generated per geometry operation. For coherent textures across a model, we might need:
- Global UV atlasing
- Explicit UV island control in builders
- UV-aware composition (don't split a leg across UV islands)

### Q2: Resolution and Performance

Procedural evaluation is expensive. Options:
- Bake to textures at build time (deterministic, but storage)
- Evaluate on-demand in shaders (flexible, but complex export)
- Hybrid: bake for export, evaluate for preview

### Q3: Hand-Painted Regions

Can we achieve hand-painted quality without actual painting?
- Stencil-based masks (decals, logos)
- Region-specific generators (carved text, inlays)
- Reference image-guided generation (match a photo's character)

### Q4: Cross-Part Coherence

How do we ensure the wood grain flows continuously across parts?
- World-space projection (ignore UVs for grain direction)
- Shared material instances with position-based seeds
- Explicit grain direction vectors in builder

### Q5: Domain Knowledge Scale

How many "species" do we need for believable furniture?
- 5-10 wood species covers 90% of furniture
- But each needs: grain pattern, color range, hardness (wear), aging behavior
- This is a significant knowledge authoring effort

---

## Deep Dive: UV Mapping and Texture Coordinates

> This section addresses the checker pattern issues and explores holistic solutions for UV generation, unwrapping, texture atlasing, and decal/text rendering.

### Current UV State

The platform has basic UV infrastructure:

```typescript
// Vertex.ts
interface VertexAttributes {
  normal?: Vec3;
  uv?: [number, number];  // ← exists
  color?: [number, number, number];
}
```

And glTF export supports UVs:
```typescript
// GLTFExporter.ts
const hasUVs = triangulated.vertices.some(v => v.attributes.uv !== undefined);
// If hasUVs, exports TEXCOORD_0 attribute
```

**The problem:** Per-operation UV generation is inconsistent or missing. Each geometry command generates its own UVs (if any) without coordination, leading to:

1. **Checker pattern distortion** — stretching, scaling inconsistencies
2. **Seam misalignment** — adjacent parts don't line up
3. **No global coordination** — each part uses [0,1] independently
4. **No atlas awareness** — can't pack multiple parts efficiently

### Why Checker Patterns Look Wrong

A checker pattern reveals UV problems because:
- **Stretching** → rectangles instead of squares
- **Inconsistent texel density** → some squares bigger than others
- **Seam discontinuities** → pattern jumps at part boundaries

Common causes in procedural geometry:

| Geometry Type | Typical Problem |
|--------------|-----------------|
| Box | Each face uses full [0,1] range, but different face sizes → different texel density |
| Lathe | Cylindrical mapping works, but caps often wrong or missing UVs |
| Extrude | Sides get cylindrical, caps get planar, but cap UVs often at wrong scale |
| Loft | Interpolated UVs can stretch if top/bottom loops have different vertex counts |
| Boolean | Cut faces get no UVs or garbage UVs |
| Subdivision | UV interpolation is fine, but original UVs must be correct |

### Levels of UV Solution

There are three levels of increasing sophistication:

#### Level 1: Fix Per-Operation UVs

Each geometry operation generates correct, consistent UVs for its topology:

```yaml
# Box: 6 planar projections, each [0,1] based on world-space dimensions
box:
  name: seat
  size: { x: 0.4, y: 0.03, z: 0.4 }
  uv_mode: world_scale  # 1 UV unit = 1 meter → consistent texel density
```

```yaml
# Lathe: cylindrical mapping with correct cap handling
lathe:
  name: leg
  profile: leg_profile
  segments: 12
  uv_mode: cylindrical
  cap_uv: planar  # caps get planar projection
```

**Implementation:**

```typescript
// For box faces
function boxFaceUV(vertex: Vec3, face: 'top'|'bottom'|'front'|'back'|'left'|'right', worldScale: number): [number, number] {
  // Project onto face plane, scale by world dimensions
  switch(face) {
    case 'top':
    case 'bottom':
      return [vertex.x * worldScale, vertex.z * worldScale];
    case 'front':
    case 'back':
      return [vertex.x * worldScale, vertex.y * worldScale];
    case 'left':
    case 'right':
      return [vertex.z * worldScale, vertex.y * worldScale];
  }
}
```

**Pros:** Simple, fixes most checker issues
**Cons:** Each part still independent, no global coordination

#### Level 2: Global UV Unwrapping

After geometry is complete, run automatic UV unwrapping on the entire mesh:

```yaml
# In builder YAML
post_process:
  - unwrap:
      method: smart_uv_project  # or: angle_based, conformal
      island_margin: 0.01       # gap between UV islands
      pack: true                # pack islands into [0,1]
```

**How Smart UV Projection Works:**

1. **Segment by angle** — faces with similar normals form islands
2. **Unfold each island** — minimize distortion (area/angle preservation)
3. **Pack islands** — arrange into [0,1] texture space efficiently
4. **Assign seams** — mark where cuts were made

```typescript
interface UnwrapResult {
  uvs: Map<VertexId, [number, number]>;  // Per-vertex UVs
  islands: UVIsland[];                    // Groups of connected faces
  seams: EdgeId[];                        // Edges where UVs are split
  utilization: number;                    // Percentage of [0,1] used
  maxStretch: number;                     // Worst-case distortion
}

interface UVIsland {
  faceIndices: number[];
  bounds: { minU: number, maxU: number, minV: number, maxV: number };
  partName: string;  // Link back to builder part
}
```

**Pros:** Globally consistent, professional quality, enables texturing
**Cons:** Loses parametric UV relationship, harder to control seam placement

#### Level 3: Agent-Controlled UV Layout

Builders declare **UV intent**, system executes:

```yaml
uv_layout:
  strategy: atlas
  texel_density: 512  # texels per meter
  
  islands:
    - parts: [seat_top, seat_bottom]
      projection: planar_y
      priority: high  # gets more texture space
      
    - parts: [leg_*]  # wildcard for all legs
      projection: cylindrical
      share_uv: true  # all legs share same UV space (instancing)
      
    - parts: [back_*]
      projection: auto
      
  seam_hints:
    - edge: seat_to_leg_joint
      prefer_seam: true  # hide seams at joints
      
    - edge: seat_top_edge
      prefer_seam: false  # don't cut across visible surfaces
```

**Key Concepts:**

- **Texel density** — consistent pixel/meter ratio across all parts
- **UV sharing** — identical parts use same UV space (saves texture area)
- **Priority** — important surfaces get more resolution
- **Seam hints** — agent can guide where to place UV cuts

**Pros:** Full control, enables optimization, agent can reason about textures
**Cons:** Significant complexity, requires agent UV knowledge

### Texture Atlasing for Multi-Part Models

A chair has ~15+ parts. Without atlasing, each needs its own texture — wasteful.

```
Traditional (wasteful):
┌────────┐ ┌────────┐ ┌────────┐
│ seat   │ │ leg_1  │ │ back   │  ... 15 textures
│ 1024²  │ │ 256²   │ │ 512²   │
└────────┘ └────────┘ └────────┘

Atlased (efficient):
┌────────────────┐
│ ┌────┐ ┌────┐  │
│ │seat│ │back│  │  1 texture, 2048²
│ └────┘ └────┘  │
│ ┌─┐ ┌─┐ ┌─┐ ┌─┐│
│ │1│ │2│ │3│ │4││  legs share UV space
│ └─┘ └─┘ └─┘ └─┘│
└────────────────┘
```

**Atlas Generation Pipeline:**

```typescript
interface TextureAtlas {
  resolution: [number, number];      // e.g., [2048, 2048]
  islands: AtlasIsland[];
  utilization: number;               // Percentage used
}

interface AtlasIsland {
  partNames: string[];               // Parts mapped here
  uvBounds: { minU, maxU, minV, maxV: number };
  resolution: [number, number];       // Effective texels for this island
}

function packAtlas(islands: UVIsland[], targetResolution: number): TextureAtlas {
  // Sort by area (largest first for better packing)
  // Use bin-packing algorithm (Guillotine, MaxRects, etc.)
  // Respect margin between islands
  // Return packed coordinates
}
```

**Agent Workflow:**

```
builder.uv_atlas DiningChair resolution=2048
→ {
    utilization: 0.78,
    islands: [
      { parts: ["seat"], uv: [0, 0, 0.5, 0.3], texels: [1024, 614] },
      { parts: ["back"], uv: [0.5, 0, 1.0, 0.4], texels: [1024, 819] },
      { parts: ["leg_*"], uv: [0, 0.3, 0.2, 0.5], texels: [410, 410], shared: true },
      ...
    ]
  }
```

### Decals and Text Rendering into Textures

How to "paint" specific regions without hand-painting?

#### Decal System

A decal is a projected texture overlay at a specific location:

```yaml
materials:
  seat_wood:
    type: procedural
    layers:
      - generator: wood_grain
        # ... base wood
        
      # Decal: manufacturer logo on underside
      - name: logo_decal
        type: decal
        source: branded_logo.png  # or: procedural text
        projection:
          type: planar
          origin: { x: 0, y: "$seat_height - 0.01", z: 0 }
          normal: { x: 0, y: -1, z: 0 }  # pointing down
          size: { width: 0.05, height: 0.02 }
        blend_mode: multiply
        opacity: 0.8
```

**How Decals Work:**

1. **Define projection** — where in 3D space, what size, what orientation
2. **Generate mask** — which UV texels fall within projection
3. **Sample source** — get color/opacity from source image or generator
4. **Blend into atlas** — composite onto base layers

```typescript
interface Decal {
  source: DecalSource;              // Image path or generator
  projection: DecalProjection;       // Where in 3D space
  blendMode: 'normal' | 'multiply' | 'overlay' | 'add';
  opacity: number;
}

interface DecalProjection {
  type: 'planar' | 'cylindrical' | 'spherical';
  origin: Vec3;
  normal: Vec3;           // For planar
  size: { width: number, height: number };
}

function projectDecalToUV(
  decal: Decal,
  mesh: Mesh,
  uvMapping: Map<VertexId, [number, number]>
): DecalMask {
  // For each face in mesh:
  //   1. Check if face is within decal projection bounds
  //   2. Compute decal UV for each vertex (position in decal space)
  //   3. Return mask of affected texels with decal UVs
}
```

#### Text Rendering into Textures

Render text directly into texture space:

```yaml
materials:
  sign_face:
    type: procedural
    layers:
      - generator: painted_metal
        color: "#2a4d6e"
        
      # Text layer
      - name: sign_text
        type: text
        content: "$business_name"  # Expression from builder
        font: Helvetica
        size: 0.15                 # World units
        color: "#ffffff"
        position: { u: 0.5, v: 0.5 }  # Center of UV space
        align: center
        projection:
          type: planar
          part: sign_face         # Project onto this part's UVs
```

**Text Rendering Pipeline:**

```typescript
interface TextLayer {
  content: string;                  // May contain $expressions
  font: string;
  size: number;                     // World-space size
  color: Color;
  position: { u: number, v: number };
  align: 'left' | 'center' | 'right';
  projection: TextProjection;
}

function renderTextToTexture(
  text: TextLayer,
  atlas: TextureAtlas,
  island: AtlasIsland
): void {
  // 1. Parse font (we already have TrueType parsing for 3D text)
  // 2. Get glyph outlines
  // 3. Rasterize glyphs at target resolution
  // 4. Composite into atlas at specified position
}
```

**Reusing Existing Infrastructure:**

The platform already has text-to-shape for 3D text:
- `FontParser` — reads TrueType fonts
- `Glyph` outlines — bezier curves for each character
- `Shape2D` — polygon representation

For textures, we'd add:
- Glyph rasterizer — curves → pixels at target resolution
- UV-space placement — position text within atlas island

### World-Space vs. UV-Space Texturing

Some texture effects work better in world-space, others in UV-space:

| Approach | Good For | Problems |
|----------|----------|----------|
| **UV-Space** | Detailed patterns, text, decals | Requires good UVs, seam issues |
| **World-Space** | Continuous patterns (wood grain), wear | Can't do fine detail, triplanar blending needed |
| **Hybrid** | Best of both | Complexity |

**Triplanar Projection (World-Space Fallback):**

When UVs are bad or missing, project texture from 3 axes and blend:

```typescript
function triplanarSample(
  worldPos: Vec3,
  worldNormal: Vec3,
  texture: Texture,
  scale: number
): Color {
  // Sample texture from X, Y, Z projections
  const sampleX = texture.sample(worldPos.y * scale, worldPos.z * scale);
  const sampleY = texture.sample(worldPos.x * scale, worldPos.z * scale);
  const sampleZ = texture.sample(worldPos.x * scale, worldPos.y * scale);
  
  // Blend based on normal direction
  const blend = abs(worldNormal);  // How much each axis faces camera
  return sampleX * blend.x + sampleY * blend.y + sampleZ * blend.z;
}
```

**YAML Declaration:**

```yaml
materials:
  wood:
    type: procedural
    projection: triplanar  # Don't rely on UVs
    scale: 1.0             # 1 meter = 1 texture repeat
    layers:
      - generator: wood_grain
```

**Pros:** Works without good UVs, grain flows across parts
**Cons:** Blending visible on angled surfaces, can't do fine detail

### UV Quality Gates

How do we know if UVs are good enough?

```
builder.quality tier=3
→ FAIL: uv_stretch > 0.2 (20% distortion on seat_top)
→ FAIL: uv_utilization < 0.5 (only 50% of texture space used)
→ FAIL: texel_density_variance > 2.0 (some parts 4x more detailed than others)
→ PASS: no overlapping UV islands
→ PASS: all faces have UVs
```

**Metrics:**

| Metric | What It Measures | Target |
|--------|-----------------|--------|
| **Stretch** | Area/angle distortion | < 10% |
| **Utilization** | % of [0,1] texture space used | > 70% |
| **Texel Density Variance** | Consistency of pixel/meter ratio | < 1.5x |
| **Overlap** | UV islands overlapping | 0 |
| **Coverage** | Faces with valid UVs | 100% |

### Agent UV Workflow

How would an agent reason about UVs?

```
# 1. Check current UV quality
builder.uv_quality
→ {
    coverage: 0.85,           # 15% of faces have no UVs
    stretch: { max: 0.45, mean: 0.12 },
    utilization: 0.32,        # Poor packing
    density_variance: 3.2,    # Inconsistent
    suggestions: [
      { action: "add_cap_uvs", parts: ["leg_*"], reason: "caps missing UVs" },
      { action: "repack", reason: "utilization < 0.5" },
      { action: "normalize_density", reason: "variance > 2.0" }
    ]
  }

# 2. Fix missing UVs
builder.uv_generate leg_* method=cylindrical cap_method=planar

# 3. Create optimized atlas
builder.uv_atlas resolution=2048 margin=0.01

# 4. Verify
builder.uv_quality
→ { coverage: 1.0, stretch: { max: 0.08 }, utilization: 0.78, density_variance: 1.2 }
```

### Holistic Texture Authoring Vision

Putting it all together — how an agent authors a complete textured model:

```yaml
# DiningChair.yaml
name: DiningChair

materials:
  oak_frame:
    type: procedural
    layers:
      - generator: wood_grain
        species: oak
        seed: 42
      - generator: edge_wear
        intensity: 0.2
        mask: curvature > 0.5
      - generator: oil_finish
        sheen: 0.3
        
  fabric_seat:
    type: procedural
    layers:
      - generator: fabric_weave
        pattern: twill
        color: "$cushion_color"  # from decision
      - generator: wear_fade
        intensity: 0.15
        mask: ao < 0.4
        
  logo:
    type: decal
    source: manufacturer_logo.png
    projection:
      part: seat_bottom
      position: center
      size: { width: 0.04, height: 0.02 }

# ... decisions, measurements, geometry ...

uv_layout:
  strategy: atlas
  resolution: 2048
  texel_density: 512  # texels per meter
  
  rules:
    - parts: [seat_top]
      priority: high
      
    - parts: [leg_*]
      share_uv: true
      
    - parts: [back_*]
      projection: auto
      
  seam_hints:
    - prefer_seam: joint_edges
    - avoid_seam: visible_surfaces

texture_output:
  format: png
  maps: [albedo, normal, roughness, metallic, ao]
  resolution: 2048
```

**What the Platform Does:**

1. **Geometry pass** — build mesh as usual
2. **UV generation** — apply per-operation UVs with world-scale
3. **UV unwrap** — smart project + pack into atlas
4. **Mesh analysis** — compute curvature, AO, position maps
5. **Layer evaluation** — evaluate procedural layers in UV space
6. **Decal projection** — project decals/text onto atlas
7. **Texture bake** — output albedo, normal, roughness, etc.
8. **Export** — glTF with mesh + texture files

**Agent Reasoning:**

```
# Agent wants to create a branded chair variant

world.get branding.acme_furniture.*
→ { logo: "acme_logo.png", colors: ["#2a4d6e", "#c4a35a"], font: "Futura" }

builder.add_decal seat_bottom source=acme_logo.png position=center size=0.04
builder.add_text_layer back_top content="ACME" font=Futura size=0.02 color=#c4a35a

builder.bake_textures resolution=2048
→ { 
    files: ["DiningChair_albedo.png", "DiningChair_normal.png", ...],
    bake_time: 2.3s 
  }

builder.export format=gltf include_textures=true
→ { file: "DiningChair.glb", size: "4.2MB" }
```

---

## Relationship to Existing Work

### G3: Procedural Textures (Phase 3)

G3 in the current plan is a subset:
- UV-space noise evaluation
- Material layering with blend modes
- Basic procedural patterns

This evaluation extends G3 to:
- Full PBR map generation (not just albedo)
- Mesh analysis-driven generators
- Intent-based material description
- Domain-specific generator library

### Material Slots (C3 ✅)

C3 established named material slots with PBR properties:
```yaml
materials:
  wood:
    color: "#8b6914"
    roughness: 0.6
    metalness: 0.0
```

This evaluation would extend slots to:
```yaml
materials:
  wood:
    type: procedural
    generator: wood_grain
    # ... full procedural stack
```

### Quality Tiers

Current Tier 2 requires "2 distinct materials."
Tier 3/4 could require:
- Procedural texture variation
- Coherent wear patterns
- Style-appropriate aging

---

## Why This Is Ambitious

1. **Scope expansion** — the texture pipeline (G3-G6) adds 12 stories to Phase 3, comparable to a small track
2. **Domain knowledge** — requires encoding artist expertise (wood species, wear patterns, aging)
3. **UV complexity** — smart unwrapping is algorithmically complex (ABF/LSCM implementations)
4. **Validation** — "does this look like oak?" is harder to automate than mesh validation
5. **Agent capability** — agents will need domain knowledge (Track F) to make good texture choices

### Why It's Worth Doing

1. **Determinism** — unlike hand-painting, procedural textures are fully reproducible
2. **Variation** — every instance has unique wear patterns from its seed
3. **Knowledge accumulation** — material knowledge (species, finishes, aging) fits the metadata system
4. **Agent authoring** — fits the "decisions, not code" philosophy
5. **Export completeness** — glTF exports become truly production-ready
6. **Quality tier progression** — enables meaningful Tier 3 and Tier 4 definitions

---

## Conclusion

Full procedural PBR texture support is now part of Phase 3 planning (Track G3-G6, 12 stories). Key design decisions:

1. **Baked textures, not runtime shaders.** Builders produce PNG texture files deterministically. This ensures portability and avoids compute-intensive runtime evaluation.

2. **Three.js MeshStandardMaterial for preview.** Dashboard renders baked PBR textures when available, falls back to plain colors for fast iteration.

3. **Optional textures.** Textures are explicitly baked on demand, not automatically generated. Geometry preview works without textures.

4. **Housekeeping.** Texture cache management prevents unbounded growth.

5. **Incremental delivery.** G3 (UV fixes) enables texturing. G4 (generators) enables procedural materials. G5 (decals) enables branding. G6 (baking) enables export. H5 (demo) proves it works end-to-end.

See `BACKLOG.md` for detailed stories and acceptance criteria.
