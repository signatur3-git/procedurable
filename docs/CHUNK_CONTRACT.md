# Chunk Contract - Deterministic World Generation

## Purpose

Define how world generation queries work for streaming/infinite worlds. The chunk contract ensures that:
1. Same coordinates + seed → same output (deterministic)
2. Chunks can be generated independently
3. Boundary consistency is maintained (no gaps/overlaps)

## Core Concept: Coordinate-Based Generation

Instead of generating "a forest", we generate "the forest at coordinates (100, 200) with seed 42".

```typescript
// Traditional approach (limited)
const forest = generateForest(seed);

// Chunk approach (infinite)
const chunk = generateChunk(bounds: {x: 100, z: 200, width: 50, depth: 50}, seed: 42);
```

## The Contract

### 1. Deterministic Function

**Rule:** `generate(coordinates, seed) → same output always`

```typescript
interface ChunkRequest {
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  seed: number;
}

interface ChunkOutput {
  bounds: ChunkRequest['bounds'];
  seed: number;
  terrain?: TerrainData;
  instances?: Instance[];
  metadata?: ChunkMetadata;
}
```

**Implementation:**
- Use coordinate hash + seed as the actual seed for generation
- `actualSeed = hash(x, z, baseSeed)`
- Same input → same hash → same random sequence → same output

### 2. Query Interface

Two types of queries:

#### Height Query (Fast)
```
world.sampleHeight x=100 z=200 seed=42
→ Returns: { x: 100, z: 200, height: 12.5 }
```

**Use case:** "What's the ground height at this point?"
- Used for placement (put tree on terrain)
- Fast evaluation (scalar field sample only)
- No geometry generation needed

#### Instance Query (Full Generation)
```
world.instances bounds={minX:0,maxX:50,minZ:0,maxZ:50} seed=42
→ Returns: { instances: [...], count: 47 }
```

**Use case:** "Give me all objects in this area"
- Full procedural generation
- Returns instance data (positions, transforms)
- Ready for rendering

### 3. Boundary Consistency

**Problem:** Adjacent chunks must align perfectly at boundaries.

**Solution:** Padding + Consistent Seeding

```
┌────────────┬────────────┐
│  Chunk A   │  Chunk B   │
│  (0-50)    │  (50-100)  │
│         ○──┼──○         │  ← Tree on boundary
│            │            │
│            │            │
└────────────┴────────────┘
```

**Rules:**
1. **Consistent seeding:** Tree at x=50 uses `hash(50, z, seed)` regardless of which chunk queries it
2. **Padding:** Query slightly beyond bounds to catch objects that overlap
3. **Deduplication:** If object center is outside chunk, don't include it

**Padding Formula:**
```typescript
const padding = maxObjectRadius; // e.g., 5m for trees
const queryBounds = {
  minX: chunkMinX - padding,
  maxX: chunkMaxX + padding,
  minZ: chunkMinZ - padding,
  maxZ: chunkMaxZ + padding
};

// Then filter: only include if center is in actual bounds
instances = instances.filter(inst => 
  inst.transform.position.x >= chunkMinX &&
  inst.transform.position.x < chunkMaxX &&
  inst.transform.position.z >= chunkMinZ &&
  inst.transform.position.z < chunkMaxZ
);
```

## Implementation Examples

### Example 1: Height Field Query

```typescript
import { field } from './ScalarField';

function sampleHeight(x: number, z: number, seed: number): number {
  // Create deterministic terrain field
  const terrain = field.remap(
    field.fbm(seed, 0.02, 1.0, 4, 0.5),
    -1, 1,
    0, 50  // 0-50m elevation
  );
  
  return terrain.sample(x, 0, z);
}

// Usage
const height = sampleHeight(100, 200, 42);
console.log(`Ground at (100, 200) is ${height}m high`);
```

### Example 2: Instance Query with Poisson Scatter

```typescript
import { poissonDiskScatter } from './PoissonDisk';
import { createInstanceGroupFromScatter } from './Instance';
import { field } from './ScalarField';

function generateChunkInstances(
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  seed: number
): Instance[] {
  // 1. Create density field (deterministic based on seed)
  const forestDensity = field.clamp(
    field.noise2d(seed, 0.05, 1.0),
    0, 1
  );
  
  // 2. Scatter trees (deterministic based on bounds + seed)
  const scatterSeed = hashCoords(bounds.minX, bounds.minZ, seed);
  const treePoints = poissonDiskScatter(bounds, {
    minDistance: 5.0,
    densityField: forestDensity,
    densityThreshold: 0.4,
    seed: scatterSeed
  });
  
  // 3. Create instances
  const group = createInstanceGroupFromScatter(
    treePoints.points,
    'Tree',
    scatterSeed,
    { randomRotation: true, scaleVariation: 0.3 }
  );
  
  return group.instances;
}

// Coordinate hashing for deterministic seeding
function hashCoords(x: number, z: number, seed: number): number {
  // Simple hash function (use better one in production)
  let hash = seed;
  hash = ((hash << 5) - hash) + x;
  hash = ((hash << 5) - hash) + z;
  return Math.abs(hash) >>> 0; // Ensure positive
}
```

### Example 3: Boundary-Safe Generation

```typescript
function generateChunkSafe(
  chunkBounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  seed: number,
  padding: number = 5.0
): Instance[] {
  // 1. Expand bounds for padding
  const queryBounds = {
    minX: chunkBounds.minX - padding,
    maxX: chunkBounds.maxX + padding,
    minZ: chunkBounds.minZ - padding,
    maxZ: chunkBounds.maxZ + padding
  };
  
  // 2. Generate in expanded bounds
  const allInstances = generateChunkInstances(queryBounds, seed);
  
  // 3. Filter to actual chunk bounds (center must be inside)
  const chunkInstances = allInstances.filter(inst => {
    const pos = inst.transform.position;
    return pos.x >= chunkBounds.minX &&
           pos.x < chunkBounds.maxX &&
           pos.z >= chunkBounds.minZ &&
           pos.z < chunkBounds.maxZ;
  });
  
  return chunkInstances;
}
```

## Boundary Consistency Patterns

### Pattern 1: Center Rule
**Rule:** Object belongs to chunk where its center point lies.

```typescript
// Tree at x=49.9 → Chunk A (0-50)
// Tree at x=50.1 → Chunk B (50-100)
```

**Pros:** Simple, no overlap
**Cons:** Large objects may appear to pop in

### Pattern 2: Overlap Rule
**Rule:** Object appears in all chunks it touches.

```typescript
// Tree at x=48 with radius 5 → Both chunks A and B
```

**Pros:** Smooth appearance
**Cons:** Duplicate rendering (need deduplication)

### Pattern 3: Hybrid Rule (Recommended)
**Rule:** Padding for generation, center rule for ownership.

```typescript
// Generate with padding → see all nearby objects
// Filter by center → each chunk owns its objects
// Renderer uses AABB → draws objects that touch viewport
```

**Pros:** Best of both worlds
**Cons:** Slightly more complex

## DSL Commands

### world.sampleHeight
**Query height at a point**

```bash
world.sampleHeight x=100 z=200 seed=42

# Returns:
{
  "x": 100,
  "z": 200,
  "height": 12.5,
  "seed": 42
}
```

### world.instances
**Query instances in a region**

```bash
world.instances bounds={minX:0,maxX:50,minZ:0,maxZ:50} seed=42

# Returns:
{
  "bounds": { "minX": 0, "maxX": 50, "minZ": 0, "maxZ": 50 },
  "seed": 42,
  "instances": [
    {
      "id": "Tree_5.2_10.8",
      "builderName": "Tree",
      "transform": {
        "position": { "x": 5.2, "y": 0, "z": 10.8 },
        "rotation": { "x": 0, "y": 45, "z": 0 },
        "scale": 1.2
      },
      "seed": 12345
    },
    // ... more instances
  ],
  "count": 47
}
```

### world.query (Advanced)
**Combined query for streaming**

```bash
world.query bounds={...} seed=42 include=[height,instances,terrain]

# Returns everything needed to render a chunk
```

## Coordinate Hash Functions

### Simple Hash (For Demo)
```typescript
function simpleHash(x: number, z: number, seed: number): number {
  let hash = seed;
  hash = ((hash << 5) - hash) + Math.floor(x);
  hash = ((hash << 5) - hash) + Math.floor(z);
  return Math.abs(hash) >>> 0;
}
```

### Quality Hash (For Production)
```typescript
function cantor(x: number, z: number): number {
  // Cantor pairing function - bijective mapping
  return ((x + z) * (x + z + 1)) / 2 + z;
}

function hashCoords(x: number, z: number, seed: number): number {
  const paired = cantor(Math.floor(x), Math.floor(z));
  // Mix with seed using FNV-1a style hash
  let hash = 2166136261 ^ seed;
  hash = (hash ^ paired) * 16777619;
  return hash >>> 0;
}
```

## Future Extensions

### Multi-Resolution (LOD)
```typescript
// Different detail levels for different distances
world.instances bounds={...} seed=42 lod=2  // Medium detail
world.instances bounds={...} seed=42 lod=0  // Full detail
```

### Streaming Protocol
```typescript
// Request multiple chunks at once
world.stream center={x:100,z:200} radius=5 seed=42
→ Returns chunks in spiral order from center
```

### Caching Strategy
```typescript
// Cache chunks in memory/disk
cache.get(chunkId) ?? world.generate(bounds, seed)
```

## Testing Checklist

- [ ] Same coordinates → same output (determinism test)
- [ ] Adjacent chunks have no gaps
- [ ] Adjacent chunks have no overlaps (center rule)
- [ ] Height query matches terrain in instance query
- [ ] Hash function has good distribution
- [ ] Padding eliminates boundary artifacts

## References

- Scalar Fields: `src/core/ScalarField.ts`
- Poisson Scatter: `src/core/PoissonDisk.ts`
- Instancing: `src/core/Instance.ts`
- Math Service (hashing): `src/core/MathService.ts`

