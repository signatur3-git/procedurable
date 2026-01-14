# Procedural Generation Techniques

> Algorithms and patterns used in procedural content generation at scale.
> This document captures techniques from games, simulation, and generative art.

---

## Part 1: Noise & Pattern Generation

### 1.1 Perlin/Simplex Noise
**What it does:** Smooth, natural-looking random variation in N dimensions
**Used for:**
- Terrain heightmaps
- Cloud patterns
- Wood grain, marble textures
- Organic variation in measurements
- Animation timing variation

**Properties:**
- Continuous (no sharp jumps)
- Reproducible from seed + coordinates
- Octave layering (fractal brownian motion) for detail levels
- Can sample at any resolution

**Implementation:** mathjs or custom, ~100 lines

### 1.2 Voronoi Diagrams
**What it does:** Partition space into cells based on seed points
**Used for:**
- City blocks, room layouts
- Cracked earth, stone patterns
- Organic cell structures (scales, leaves)
- Territory/zone division
- Shattered glass

**Properties:**
- Each point belongs to nearest seed
- Edges are equidistant from seeds
- Can weight by seed properties

**Implementation:** Fortune's algorithm or brute force for small counts

### 1.3 Cellular Automata
**What it does:** Grid-based rules that evolve patterns
**Used for:**
- Cave generation (Game of Life variants)
- Dungeon layouts
- Organic growth patterns
- Crystal formation
- Coral, lichen

**Classic rules:**
- Conway's Game of Life
- Cave generation: "4-5 rule" (survive if 4+ neighbors, born if 5+)
- Maze generation

### 1.4 L-Systems (Lindenmayer Systems)
**What it does:** String rewriting rules that generate branching structures
**Used for:**
- Trees, plants, roots
- Blood vessels, river networks
- Lightning, cracks
- Recursive architecture

**Example:**
```
Axiom: F
Rules: F → F[+F]F[-F]F
Interpretation: F=forward, +=turn left, -=turn right, []=push/pop state
```

### 1.5 Wave Function Collapse (WFC)
**What it does:** Constraint propagation to fill space with compatible tiles
**Used for:**
- Tile-based levels (2D and 3D)
- Texture synthesis
- City blocks that connect properly
- Dungeon rooms that align

**Properties:**
- Guarantees local consistency
- Can fail (backtrack needed)
- Example-driven (learns from samples)

### 1.6 Poisson Disk Sampling
**What it does:** Distribute points with minimum distance constraint
**Used for:**
- Tree/rock placement (natural-looking)
- Star fields
- Stippling effects
- Object scattering

**Better than random:** No clumping, no gaps

### 1.7 Gradient/Flow Fields
**What it does:** Vector field that guides placement/orientation
**Used for:**
- Grass blade orientation
- Hair/fur direction
- Wind effects on trees
- River flow direction

---

## Part 2: Space Partitioning & Chunking

### 2.1 Spatial Hashing / Grid Chunking
**What it does:** Divide infinite space into fixed-size chunks
**Used for:**
- Minecraft-style worlds
- Streaming terrain
- LOD management
- Memory efficiency

**Key insight:** Only generate/keep chunks near camera

### 2.2 Quadtrees / Octrees
**What it does:** Recursive space subdivision with varying detail
**Used for:**
- Adaptive terrain detail
- Collision detection
- Visibility culling
- LOD selection

### 2.3 BSP Trees (Binary Space Partitioning)
**What it does:** Recursively split space with planes
**Used for:**
- Doom-style level geometry
- Room subdivision
- Convex decomposition
- Visibility determination

### 2.4 Hierarchical Generation
**What it does:** Generate coarse structure first, refine on demand
**Used for:**
- Galaxy → star systems → planets → continents → regions → local
- Building → floors → rooms → furniture → details

**Key insight:** Decisions at each level are deterministic from parent + seed

---

## Part 3: Infinite/Streaming Generation

### 3.1 Chunk-Based Streaming
**Pattern:**
1. World divided into chunks (e.g., 16x16 units)
2. Only chunks within view distance are generated
3. Chunks cached, evicted when far away
4. Chunk content determined by chunk coordinates + world seed

**Requirements:**
- Chunk boundaries must be seamless
- No dependencies on unloaded chunks (or careful handling)
- Deterministic from coordinates

### 3.2 Lazy Evaluation
**Pattern:**
1. High-level structure exists conceptually
2. Details generated only when accessed
3. Results cached for consistency

**Example:**
```
world.getBuilding(x, y) → 
  if not cached:
    seed = hash(worldSeed, x, y)
    building = generateBuilding(seed)
    cache.set((x,y), building)
  return cache.get((x,y))
```

### 3.3 Hierarchical Seeds
**Pattern:**
- World seed → chunk seed → object seed → detail seed
- `chunkSeed = hash(worldSeed, chunkX, chunkY)`
- `objectSeed = hash(chunkSeed, objectIndex)`

**Benefit:** Any object reproducible from world seed + coordinates

### 3.4 Border Handling
**Challenge:** Objects near chunk borders need info from neighbors
**Solutions:**
- Generate border padding (overlap region)
- Two-pass: structure pass (all chunks), detail pass (loaded chunks)
- Limit object size to chunk size

---

## Part 4: Level/World Generation Patterns

### 4.1 Mission/Space Grammar
**What it does:** Define level as graph of gameplay beats, then spatialize
**Used for:** Doom, roguelikes, Zelda dungeons

**Steps:**
1. Generate mission graph (lock → key → boss)
2. Convert nodes to rooms
3. Connect rooms with corridors
4. Place enemies, items, secrets

### 4.2 Agent-Based Generation
**What it does:** Simulate agents that "dig" or "build" the level
**Used for:** Caves, ant colonies, city growth

**Example agents:**
- Digger: Random walk, carves tunnels
- Builder: Places rooms, connects with doors
- Decorator: Adds props to empty spaces

### 4.3 Constraint-Based Layout
**What it does:** Define rules, solver finds valid arrangement
**Used for:** Architecture, furniture layout, puzzle placement

**Example constraints:**
- "Kitchen adjacent to dining room"
- "Windows on exterior walls"
- "Boss room at maximum distance from start"

### 4.4 Template + Variation
**What it does:** Pre-authored structure with procedural variation
**Used for:** Buildings with consistent style, quest templates

**Example:**
- Template: "tavern has bar, tables, rooms upstairs"
- Variation: Table count, room count, decorations, NPCs

### 4.5 Inside-Out Generation
**What it does:** Generate contents first, build container around them
**Used for:** Character-driven scenes, prop-heavy environments

**Example:**
1. Generate characters (king, guards, petitioners)
2. Determine their spatial needs
3. Build throne room to contain them
4. Add architectural detail

### 4.6 Simulation-Driven History
**What it does:** Simulate world history, result becomes current state
**Used for:** Dwarf Fortress, world building

**Example:**
1. Generate terrain, civilizations
2. Simulate N years of history (wars, migrations, construction)
3. Current world reflects simulated events

---

## Part 5: Scale Considerations

### 5.1 Level of Detail (LOD)
**Challenge:** Can't render full detail at all distances
**Solutions:**
- Multiple mesh versions (high/med/low poly)
- Billboards for distant objects
- Imposters (pre-rendered images)
- Hierarchical culling

### 5.2 Memory Budget
**Typical limits:**
- Web: ~1-2GB usable
- Game: ~4-8GB for assets
- Vertices per frame: ~1-10 million

**Strategies:**
- Streaming (load/unload chunks)
- Instancing (share geometry)
- Procedural detail (generate on GPU)

### 5.3 Generation Time
**Real-time requirements:**
- < 16ms per frame (60 FPS)
- Background generation in chunks
- Progressive refinement

**Offline/batch:**
- Can take seconds to minutes
- Pre-generate and cache

---

## Part 6: Composition Patterns for Complex Scenes

### 6.1 Scene Graph Hierarchy
```
World
├── Region (biome, theme)
│   ├── Structure (building, dungeon)
│   │   ├── Room
│   │   │   ├── Furniture
│   │   │   ├── Props
│   │   │   └── Characters
│   │   └── Corridor
│   └── Exterior
│       ├── Terrain
│       ├── Vegetation
│       └── Props
└── Region...
```

### 6.2 Two-Phase Generation
**Phase 1: Structure**
- Generate layout (rooms, connections)
- No geometry yet, just spatial info
- Can reference other regions

**Phase 2: Realization**
- Convert layout to geometry
- Add detail, props, materials
- Only for visible/loaded areas

### 6.3 Reactive Generation
**Pattern:** Generate in response to queries
```
getTerrainHeight(x, z) → generate if needed, cache, return
getObjectsInArea(bounds) → generate if needed, cache, return
```

### 6.4 Multi-Pass Decoration
**Pass 1:** Major structures (buildings, roads)
**Pass 2:** Medium props (trees, vehicles)
**Pass 3:** Small details (grass, debris)
**Pass 4:** Dynamic elements (NPCs, particles)

Each pass can depend on previous passes.

---

## Part 7: What We Need to Build

### Immediate (Enable New Patterns)
| Feature | Enables | Effort |
|---------|---------|--------|
| Noise functions (Perlin, Simplex) | Terrain, organic variation | M |
| Voronoi | Layouts, patterns | M |
| Coordinate-based seeding | Infinite worlds | S |
| Chunk abstraction | Streaming generation | M |

### Medium Term (Full Worlds)
| Feature | Enables | Effort |
|---------|---------|--------|
| L-Systems | Trees, plants, fractals | M |
| BSP trees | Doom-style levels | M |
| WFC (Wave Function Collapse) | Tile-based levels | L |
| Lazy/streaming generation | Infinite worlds | L |

### Long Term (AAA-Scale)
| Feature | Enables | Effort |
|---------|---------|--------|
| LOD generation | Large visible areas | L |
| GPU-side generation | Real-time detail | XL |
| History simulation | Rich world state | XL |

---

## Part 8: Example - Doom Level Builder

**Goal:** Generate a playable Doom-style level

### Phase 1: Mission Graph
```yaml
generate_mission:
  nodes:
    - start
    - key_blue
    - lock_blue
    - key_red  
    - lock_red
    - boss
    - exit
  edges:
    - [start, key_blue]
    - [key_blue, lock_blue]
    - [lock_blue, key_red]
    - [lock_blue, boss]  # optional secret
    - [key_red, lock_red]
    - [lock_red, exit]
```

### Phase 2: Spatial Layout (BSP)
```yaml
spatialize:
  method: bsp
  bounds: { width: 100, depth: 100 }
  min_room_size: 10
  assign_nodes_to_leaves: true
  connect_adjacent: corridors
```

### Phase 3: Room Generation
```yaml
for_each_room:
  - determine_shape: [rect, L, T, cross]
  - set_height: [3, 4, 5]
  - add_pillars_if: area > 100
  - add_windows_if: exterior_wall
  - texture_by: theme
```

### Phase 4: Populate
```yaml
populate:
  enemies:
    density_by: distance_from_start
    types_by: difficulty_curve
  items:
    health: near_combat_areas
    ammo: along_path
    secrets: dead_ends
```

### Phase 5: Geometry
```yaml
realize:
  walls: extrude_floor_plan
  floors: textured_quads
  ceilings: [flat, vaulted, open_sky]
  doors: at_connections
  props: from_room_type
```

---

## Part 9: Example - Infinite City

**Goal:** Explorable city that generates on demand

### Chunk Structure
```
Chunk (64x64 meters)
├── Roads (determined by neighboring chunks too)
├── Blocks (Voronoi from road network)
│   ├── Buildings
│   │   ├── Floors
│   │   │   └── Rooms
│   │   └── Facade
│   └── Courtyards
└── Street Props
```

### Generation Pipeline
```javascript
function getChunk(cx, cy) {
  if (cache.has(cx, cy)) return cache.get(cx, cy);
  
  // Seed from coordinates
  const seed = hash(worldSeed, cx, cy);
  const rng = new Random(seed);
  
  // Get road network (needs neighbor info)
  const roads = generateRoads(cx, cy, getNeighborRoadHints);
  
  // Voronoi blocks from roads
  const blocks = voronoiFromRoads(roads, rng);
  
  // Buildings on blocks
  const buildings = blocks.map(b => generateBuilding(b, rng));
  
  // Street furniture
  const props = scatterProps(roads, rng);
  
  const chunk = { roads, blocks, buildings, props };
  cache.set(cx, cy, chunk);
  return chunk;
}
```

### LOD Strategy
- **Far:** Building silhouettes only (boxes with height)
- **Medium:** Facades (textured quads)
- **Near:** Full geometry (windows, doors, details)
- **Interior:** Only when entered

---

## Summary: Key Mindset Shifts

1. **Think in infinite space** - Not "make a chair" but "make any chair at any position"

2. **Hierarchical seeds** - World seed → region → chunk → object → detail

3. **Lazy generation** - Only build what's needed, when it's needed

4. **Seamless boundaries** - Chunk edges must match

5. **Two-phase pattern** - Structure first (fast, abstract), then detail (expensive, concrete)

6. **Composition is recursive** - World contains regions contains buildings contains rooms contains props

7. **Noise is everywhere** - Not just terrain, but variation in everything

8. **Constraints drive layout** - Define relationships, solve for positions

---

## Related Documents

- `AUTHORING_PROBLEM_DOMAIN.md` - Builder authoring challenges
- `AUTHORING_SOLUTION_DOMAIN.md` - Current tool inventory
- `SOLUTION_DOMAIN.md` - Geometry tools

