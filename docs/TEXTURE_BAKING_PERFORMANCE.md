# Texture Baking Performance Analysis

**Date**: 2026-02-07
**Status**: ✅ MAJOR IMPROVEMENT - ChessBoard now bakes in ~1 second!

## Summary

We achieved **>90x speedup** for complex scenes like ChessBoard through:
1. Auto-skipping expensive mesh analysis for large meshes
2. Per-material parallel baking
3. SolidColorGenerator fast path (skips noise for solid colors)
4. NoiseLUT for faster procedural noise evaluation

## Actual Timing Results

### DiningChair (48 faces, 176 vertices)

| Resolution | Time |
|------------|------|
| 512×512 | **307ms** |
| 1024×1024 | **1347ms** |

### ChessBoard (7,558 faces, 9,880 vertices) - BEFORE vs AFTER

| Resolution | BEFORE | AFTER | Speedup |
|------------|--------|-------|---------|
| 256×256 | TIMEOUT (>30s) | **334ms** | >90x |
| 512×512 | TIMEOUT (>30s) | **300ms** | >100x |
| 1024×1024 | TIMEOUT (>60s) | **1312ms** | >45x |

## Implemented Optimizations

### 1. NoiseLUT ✅

Pre-computed noise lookup tables for faster procedural texture evaluation.

**Files:** `src/platform/materials/NoiseLUT.ts`, `generators/WoodGrainGenerator.ts`

| Operation | Original | LUT-based | Speedup |
|-----------|----------|-----------|---------|
| perlin2D | 20.44ms | 10.03ms | **2.04x** |
| domainWarp2D | 51.78ms | 14.40ms | **3.60x** |

### 2. SolidColorGenerator Fast Path ✅

Skips noise calculation when `variation < 0.001`. Chess piece ivory/ebony colors bake instantly.

### 3. Per-Material Parallel Baking ✅

Triangles grouped by `materialSlotIndex`, each material processed independently.

**Files:** `src/platform/materials/TextureBaker.ts` (`bakeTexturesParallel()`)

### 4. Auto-Skip Mesh Analysis ✅ (BIGGEST WIN!)

**The Bottleneck**: `analyzeMesh()` does O(V × aoRays × F) ray casting for AO.
For ChessBoard: 9,880 × 16 × 7,558 = **1.19 billion ray tests!**

**Solution**: Auto-skip expensive AO for meshes with >5000 vertices, but **still compute vertex normals**:
```typescript
const shouldSkipAnalysis = mesh.vertices.length > 5000;

if (shouldSkipAnalysis) {
  // Fast O(V+F) vertex normal calculation - essential for smooth shading
  const vertexNormals = computeVertexNormals(mesh);
  
  analysis = {
    vertices: mesh.vertices.map((v, i) => ({
      position: v.position,
      normal: vertexNormals[i],  // Smooth shading!
      curvature: 0,              // Skip curvature
      ambientOcclusion: 1        // Skip expensive AO
    })),
    ...
  };
}
```

**Trade-off**: No curvature-based wear or AO for large meshes (acceptable for most cases).
**Preserved**: Smooth shading via interpolated vertex normals!

## UV Quality Analysis

**Answer to your question**: Scaling to 1024×1024 just gives more pixels per island - the **layout stays the same**. The overlaps and density variance don't improve.

### ChessBoard UV Issues
- **582 UV islands** cramped into one [0,1] UV space
- **943,854 overlaps** between triangles from different materials
- **Density variance 381x** - some islands get tiny, others huge
- **12,800 degenerate triangles** - body sections scaled to essentially zero

### Why Body Islands Disappear

The UV packer uses a "guillotine" algorithm that:
1. Sorts islands by size (largest first)
2. Places each island in the first available space
3. **Scales down islands** when no space remains

With 582 islands competing for space, later islands (often the piece bodies) get scaled to `minIslandSize` (essentially zero). This is why you see only round/square islands - the complex body shapes got crushed.

## Future: Shared UV Space for Identical Pieces

Your observation about twins/identical pieces is excellent! Currently:
- 16 pawns × 6 islands = 96 pawn islands (but all identical geometry!)
- 4 rooks × 6 islands = 24 rook islands (but only 1 unique shape)

### Potential Reduction with UV Sharing

| Piece Type | Count | Without Sharing | With Sharing |
|------------|-------|-----------------|--------------|
| Pawn | 16 | 96 islands | **6 islands** |
| Rook | 4 | 24 islands | **6 islands** |
| Knight | 4 | 24 islands | **6 islands** |
| Bishop | 4 | 24 islands | **6 islands** |
| Queen | 2 | 12 islands | **6 islands** |
| King | 2 | 12 islands | **6 islands** |
| **Total pieces** | 32 | **192 islands** | **36 islands** |

That's a **5x reduction** in piece islands!

### Implementation Complexity

**Option A: Per-material textures (simpler, ~1 day)**
- Each material gets its own texture file
- No UV sharing complexity
- Solid-color pieces get 1×1 textures

**Option B: UV sharing for identical instances (complex, ~3 days)**
- Builder declares `shareUV: true` or `prototype: white_pawn`
- UV unwrapper identifies identical geometry
- Assigns same UVs to all instances of a prototype
- Requires tracking prototype→instance relationships through merge
- Risk: Complexity could introduce bugs

### Recommendation

**Per-material textures (Option A)** is the better first step because:
1. Solid-color pieces (white/black) don't need textures at all → 1×1 pixel
2. Only the board tiles actually need wood grain → ~2 textures
3. Much simpler implementation
4. Can add UV sharing later if needed for procedural pieces

UV sharing would be valuable if pieces had **procedural textures that vary per piece** (like scratches, wear, or individual grain). For solid-color pieces, it adds complexity without benefit.

## Future: Per-Material Textures (G3-004)

Instead of one shared texture, generate **separate texture per material slot**:

| Material | Triangles | Texture | Notes |
|----------|-----------|---------|-------|
| light_material | 192 | 512×512 wood | Board tiles |
| dark_material | 192 | 512×512 wood | Board tiles |
| edge_material | 6 | 64×64 wood | Board edge |
| white_piece | 3,584 | **1×1 solid** | No texture needed! |
| black_piece | 3,584 | **1×1 solid** | No texture needed! |

### Benefits
- Each material gets **full UV space** [0,1]
- No overlaps between materials
- Solid colors → 1×1 texture (4 bytes vs 1MB!)
- Much better quality per material
- Total: 2× 512×512 + 1× 64×64 + 2× 1×1 ≈ **1.1 MB** (vs 4MB shared)

## Texture Sharing by Channel Type (G3-005)

**Key insight**: Not all texture channels depend on material color!

### Channel Dependencies

| Channel | Depends On | Sharing Potential |
|---------|------------|-------------------|
| **Albedo** | Material color | Per-material only |
| **Normal** | **Geometry only** | All identical geometry can share! |
| **AO** | **Geometry only** | All identical geometry can share! |
| **Roughness** | Material + optional geometry | Per-material, but often uniform |
| **Metallic** | Material | Per-material, but often uniform |

### Chess Pieces: What Can Share?

| Texture | White Pawn | Black Pawn | Share? |
|---------|------------|------------|--------|
| Albedo | Ivory (#FFFFF0) | Dark (#1C1C1C) | ❌ Different |
| **Normal** | Curved surface | Curved surface | ✅ **Same!** |
| **AO** | Self-shadowing | Self-shadowing | ✅ **Same!** |
| Roughness | 0.3 | 0.3 | ✅ Same |
| Metallic | 0.0 | 0.0 | ✅ Same |

### Optimal Texture Strategy for ChessBoard

| Texture Type | Strategy | Files | Size |
|--------------|----------|-------|------|
| **Normal** | 1 per piece type (shared by white/black) | 6 | 6× 256×256 |
| **AO** | 1 per piece type (shared by white/black) | 6 | 6× 256×256 |
| **Albedo** | 1×1 solid per material | 5 | 5× 1×1 |
| **Roughness** | 1×1 uniform per material | 5 | 5× 1×1 |
| **Board Albedo** | Per tile material (wood grain) | 2 | 2× 512×512 |

**Total for pieces**: 12× 256×256 normal/AO + tiny albedo/roughness = ~3 MB
**Benefit**: Smooth shading on all pieces via normal maps!

### Smooth Shading via Normal Maps ✅ IMPLEMENTED

The texture baker now uses **interpolated vertex normals** for smooth shading!

**Before**: Normal maps were flat (0, 0, 1) everywhere - same color for entire islands
**After**: Normal maps contain the actual interpolated vertex normal at each pixel

```typescript
// Interpolate vertex normals (averaged from adjacent faces)
const interpolatedNormal = interpolateVec3(a0.normal, a1.normal, a2.normal, bary).normalize();

// Use directly - this IS the smooth shading data
const finalNormal = interpolatedNormal;
```

**How it works:**
1. Each vertex has a normal averaged from its adjacent faces (computed by `computeVertexNormals()`)
2. For each pixel in the UV space, we interpolate these vertex normals using barycentric coordinates
3. The interpolated normal is encoded into the normal map

**Result**: Normal maps now show color variation across each island - curved surfaces have smoothly varying normals, giving the appearance of smooth shading even on low-poly geometry.

**Note**: Material normals (like wood grain bumps) are currently ignored because proper blending would require tangent space transformation. The geometry normals alone provide excellent smooth shading.

### Implementation for Shared Normal/AO Maps

With smooth shading now implemented, the sharing strategy becomes even more valuable:

1. **Identify piece prototypes** - pawn, rook, knight, bishop, queen, king
2. **UV unwrap once per prototype** - not per instance
3. **Bake normal/AO for prototype** - shared by all instances of that type
4. **Reference in GLTF** - all pawns reference `pawn_normal.png`

This requires tracking which faces belong to which prototype, but we already have this info from the `compose` section of the builder.

**Note**: Normal maps now include interpolated vertex normals for smooth shading, making them much more valuable to share!

### Complexity Assessment

| Task | Effort | Notes |
|------|--------|-------|
| Per-material albedo | 2-3 hours | Already have per-material baking |
| Shared normal/AO by prototype | 4-6 hours | Need prototype tracking |
| GLTF multi-texture export | 4-6 hours | Separate texture refs per channel |
| Dashboard rendering | 2-3 hours | Load multiple textures |
| **Total** | ~1.5-2 days | |

### What's Needed

1. **Per-material UV unwrapping** - Filter triangles by material, unwrap each separately
2. **Per-material baking** - ✅ Already implemented in `bakeTexturesParallel()`
3. **Separate texture output** - `ChessBoard_light_albedo.png`, etc.
4. **GLTF multi-texture export** - GLTF supports this natively
5. **Dashboard multi-texture rendering** - Load N textures, select by materialSlotIndex

### Implementation Effort
- UV unwrapping per material: 2-3 hours
- GLTF export with per-material textures: 4-6 hours  
- Dashboard rendering: 2-3 hours
- **Total: ~1 day of work**

## Future Optimizations (Not Implemented)

### Worker Threads (2-4x more speedup)
Parallelize pixel evaluation across CPU cores. Medium effort.

### WebGPU Compute (50-100x speedup)
Port noise to WGSL shaders for massive GPU parallelism. High effort.

### Resolution-Adaptive Baking
Auto-select resolution based on triangle count:
```typescript
if (triangles < 200) return 256;
if (triangles < 1000) return 512;
if (triangles < 5000) return 1024;
```
