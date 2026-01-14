# Scale & Ambition Analysis

> What does it take to generate worlds, not just objects?
> This document explores the architectural implications of large-scale procedural generation.

---

## Current vs. Target Scale

| Scale | Current | Target | Gap |
|-------|---------|--------|-----|
| **Single Object** | ✅ Chair, table | ✅ Same | - |
| **Composed Object** | ✅ Table with legs | ✅ Same | - |
| **Scene** | ✅ Dining room | Room with varied furniture | Variety |
| **Building** | ⬜ | Multi-room structure | Layout, interior |
| **City Block** | ⬜ | Buildings + streets | Voronoi, facades |
| **City** | ⬜ | Explorable urban area | Streaming, LOD |
| **Region** | ⬜ | Cities + terrain + roads | Biomes, infrastructure |
| **World** | ⬜ | Infinite explorable | Chunking, lazy gen |

---

## The Doom Level Question

**Can we build a Doom-level generator?**

### What a Doom Level Needs

1. **Spatial Layout**
   - Rooms of varying shapes
   - Corridors connecting rooms
   - Height variation (stairs, lifts, overlooks)
   - Loops and branches (not just linear)

2. **Gameplay Structure**
   - Keys and locked doors (progression gates)
   - Enemy placement (difficulty curve)
   - Item placement (health, ammo, weapons)
   - Secrets (hidden areas, rewards)

3. **Geometry**
   - Walls, floors, ceilings
   - Doors (animated)
   - Platforms, lifts
   - Windows, decorative details

4. **Theming**
   - Consistent textures per area
   - Style variations (tech base, hell, etc.)
   - Lighting mood

### What We'd Need to Build

| Feature | Status | Notes |
|---------|--------|-------|
| BSP space partitioning | ⬜ | Room layout algorithm |
| Graph-based mission structure | ⬜ | Key/lock progression |
| Floor plan → 3D extrusion | 🟡 | Have 2D→3D, need floor plans |
| Height variation | ⬜ | Multi-level rooms |
| Door/portal geometry | ⬜ | Animated elements |
| Enemy/item placement | ⬜ | Rule-based scattering |
| Texture/material theming | 🟡 | Have materials, need themes |

### Estimated Effort: **2-3 months focused work**

---

## The Infinite World Question

**Can we generate an explorable world that extends infinitely?**

### Key Requirements

1. **Chunk-Based Architecture**
   ```
   World
   ├── Chunk(-1, -1)
   ├── Chunk(-1, 0)
   ├── Chunk(0, 0)  ← Player is here
   ├── Chunk(0, 1)
   ├── Chunk(1, 0)
   └── ... (generated on demand)
   ```

2. **Coordinate-Based Seeding**
   ```javascript
   function chunkSeed(worldSeed, cx, cy) {
     return hash(worldSeed, cx, cy);
   }
   // Same inputs always give same outputs
   ```

3. **Seamless Boundaries**
   - Terrain height must match at edges
   - Roads must connect
   - Rivers must flow continuously

4. **Memory Management**
   - Load chunks near camera
   - Unload distant chunks
   - Cache recently used

5. **Level of Detail**
   - Full detail near camera
   - Simplified far away
   - Imposters at horizon

### What Changes in Our Architecture

| Current | Needed | Change |
|---------|--------|--------|
| Builder runs once, returns mesh | Builder can be queried by region | **Major** |
| Output is complete mesh | Output is chunk/stream | **Major** |
| All geometry in memory | Geometry loaded/unloaded | **Major** |
| Single seed per build | Hierarchical seeds | Medium |
| No spatial queries | Efficient spatial indexing | Medium |
| Sync generation | Background/async generation | Medium |

### Estimated Effort: **3-6 months for core infrastructure**

---

## The Character-First Question

**Could a builder create characters first, then build architecture around them?**

### Inside-Out Generation Pattern

Traditional (Outside-In):
```
1. Generate building
2. Generate rooms
3. Place furniture
4. Place characters
```

Inverted (Inside-Out):
```
1. Generate characters (king, guards, petitioners)
2. Determine their spatial needs (throne, standing positions, queue area)
3. Generate room to contain them
4. Add architectural context (castle style, decorations)
```

### Why This Matters

- **Narrative-driven generation** - Story determines space
- **Character density** - No empty rooms, no overcrowding
- **Functional spaces** - Room exists because it's needed
- **Better composition** - Props relate to inhabitants

### What We'd Need

| Feature | Status | Notes |
|---------|--------|-------|
| Character builder | 🟡 | PersonBuilder exists, basic |
| Spatial requirements per character | ⬜ | "King needs 2x2m throne area" |
| Room sizing from contents | ⬜ | Sum of spatial requirements |
| Wall/ceiling wrapping | ⬜ | Generate shell around contents |
| Style propagation | 🟡 | Have overrides, need themes |

### Estimated Effort: **1-2 months**

---

## Composition Architecture Rethink

### Current Model
```
Builder → builds geometry → returns Mesh
Scene → composes Builders → returns combined Mesh
```

### Needed Model
```
WorldBuilder
├── query(bounds) → LazyChunkIterator
├── getAt(x, y, z) → Object | null
├── getSeed() → number
└── getMetadata() → WorldInfo

ChunkBuilder
├── generate(chunkX, chunkY) → ChunkData
├── getConnections() → EdgeInfo (for seamless boundaries)
└── LOD levels

ObjectBuilder (existing)
├── build(seed, overrides) → Mesh
└── getBounds() → AABB
```

### Query-Based vs. Eager Generation

**Eager (current):**
```javascript
const scene = DiningSceneBuilder.build(seed);
// scene.mesh contains ALL geometry
```

**Lazy (needed for scale):**
```javascript
const world = WorldBuilder.create(seed);
// Nothing generated yet

const chunk = world.getChunk(0, 0);
// Only this chunk generated

const building = chunk.getBuilding(3);
// Only this building detailed

const room = building.getRoom(0);
// Only this room furnished
```

---

## Noise & Pattern Infrastructure

### What We're Missing

1. **Perlin/Simplex Noise**
   - Needed for: terrain, organic variation, textures
   - Effort: S (libraries exist, or ~100 lines)

2. **Voronoi Diagrams**
   - Needed for: city blocks, cracked patterns, cell structures
   - Effort: M (Fortune's algorithm or simple approach)

3. **Poisson Disk Sampling**
   - Needed for: natural object scattering (trees, rocks)
   - Effort: S (~50 lines)

4. **L-Systems**
   - Needed for: trees, plants, branching structures
   - Effort: M (string rewriting + turtle graphics)

5. **Wave Function Collapse**
   - Needed for: tile-based levels, texture synthesis
   - Effort: L (constraint propagation, backtracking)

### Immediate Action: Add to MathService

```typescript
// Noise functions
noise.perlin2d(x, y, seed, frequency?) → number (-1 to 1)
noise.perlin3d(x, y, z, seed, frequency?) → number
noise.fbm(x, y, seed, octaves, persistence) → number (fractal)

// Distribution functions  
scatter.poisson(bounds, minDistance, seed) → Vec2[]
scatter.grid(bounds, spacing, jitter, seed) → Vec2[]

// Voronoi
voronoi.cells(points, bounds) → Cell[]
voronoi.edges(points, bounds) → Edge[]
```

---

## Industrial Design Patterns

Beyond game levels, what about manufactured objects?

### Mass Customization Pattern
```yaml
ProductLineBuilder:
  base_model: "chair_base"
  variations:
    - axis: material
      options: [wood, metal, plastic]
    - axis: size
      options: [child, adult, tall]
    - axis: style
      options: [modern, classic, rustic]
  constraints:
    - "plastic excludes rustic"
    - "child excludes tall"
  
# Generates product catalog with valid combinations
```

### Parametric Family Pattern
```yaml
WindowBuilder:
  parameters:
    width: [0.5, 2.0]
    height: [0.5, 3.0]
    panes_x: [1, 4]
    panes_y: [1, 6]
    frame_style: [flat, beveled, ornate]
  
  constraints:
    - "panes_x * panes_y <= 12"
    - "ornate requires width >= 1.0"
  
# Any valid parameter combination produces a window
```

### Assembly Pattern
```yaml
FurnitureAssemblyBuilder:
  parts:
    - name: seat
      builder: SeatBuilder
      expose_params: [width, depth, material]
    - name: legs
      builder: LegBuilder
      count: 4
      attach_to: seat.corners
    - name: back
      builder: BackBuilder
      optional: true
      attach_to: seat.rear_edge
  
  configurations:
    stool: { back: false }
    chair: { back: true }
    bench: { back: false, width: doubled }
```

---

## Revised Phase Planning

Given this analysis, our phases should perhaps be:

### Phase 2A: Object Generation (Current)
- ✅ Single objects (chair, table)
- ✅ Simple composition (table + legs)
- ✅ Scene composition (dining room)
- 🟡 Materials and variation
- ⬜ 2D shapes, CSG, advanced geometry

### Phase 2B: Pattern Infrastructure (NEW)
- ⬜ Noise functions (Perlin, FBM)
- ⬜ Voronoi diagrams
- ⬜ Poisson disk sampling
- ⬜ L-systems for branching
- ⬜ Coordinate-based seeding

### Phase 2C: Layout & Levels (NEW)
- ⬜ BSP room generation
- ⬜ Graph-based mission structure
- ⬜ Floor plan → 3D extrusion
- ⬜ Doom-level builder proof of concept

### Phase 3: Scale Infrastructure
- ⬜ Chunk-based world model
- ⬜ Lazy/streaming generation
- ⬜ LOD generation
- ⬜ Infinite world proof of concept

### Phase 4: Character & Narrative
- ⬜ Character generation (beyond PersonBuilder)
- ⬜ Inside-out scene generation
- ⬜ Narrative-driven spaces
- ⬜ Crowd/population simulation

---

## Immediate Actions

1. **Add noise functions to MathService** (S effort, high value)
   - Perlin 2D/3D
   - FBM (fractal brownian motion)
   - Expose via DSL: `math.noise`, `math.fbm`

2. **Add coordinate-based seeding** (S effort, foundational)
   - `hash(seed, x, y) → deterministic seed`
   - Enables infinite world pattern

3. **Document composition patterns** (S effort, clarity)
   - Template + variation
   - Inside-out
   - Assembly

4. **Prototype: Simple dungeon** (M effort, proof of concept)
   - BSP room division
   - Corridor connections
   - Wall extrusion
   - Validates the architecture

---

## Questions to Answer

1. **Do we need a separate "layout" representation?**
   - Currently: builders produce geometry directly
   - Alternative: builders produce layout, separate step produces geometry

2. **How do we handle dependencies across chunks?**
   - Roads need to connect
   - Rivers flow continuously
   - Buildings respect streets

3. **What's our LOD strategy?**
   - Generate multiple versions?
   - Simplify on the fly?
   - Different builder for each LOD?

4. **How do we test infinite worlds?**
   - Can't test all chunks
   - Need statistical validation
   - Need boundary testing

---

## Related Documents

- `PROCEDURAL_TECHNIQUES.md` - Algorithm catalog
- `AUTHORING_PROBLEM_DOMAIN.md` - Builder authoring challenges
- `MASTER_PLAN.md` - Current milestone planning

