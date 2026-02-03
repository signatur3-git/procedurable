# Issue Stack - 2026-02-07

## Session Status: ✅ MAJOR FIXES IMPLEMENTED

---

## Executive Summary

This session made significant progress on the geometry-to-texture pipeline:
- **Position-based normal smoothing** - Fixes seams on lathe/vase shapes
- **Performance optimizations** - ChessBoard bakes in <2 seconds
- **Per-material baking** - Properly implemented with solid color optimization
- **All 1185 tests pass**

See `GEOMETRY_TEXTURE_PIPELINE_INVESTIGATION.md` for detailed technical analysis.

---

## Fixes Applied This Session

### 1. ✅ Position-Based Normal Grouping (MeshAnalysis.ts)
**Problem:** Vertices at same position but different indices got separate normals → hard edges/seams  
**Solution:** Group vertices by position, share averaged normals between all vertices at same position  
**Impact:** Smooth shading now works across seams in lathe, loft, and merged meshes

### 2. ✅ Performance - Skip AO for Large Meshes (TextureBaker.ts)  
**Problem:** AO computation O(V × rays × F) took 30+ seconds for ChessBoard  
**Solution:** Skip AO for meshes >5000 vertices  
**Impact:** ChessBoard bakes in <2 seconds

### 3. ✅ Performance - Tangent Basis Per-Triangle (TextureBaker.ts)
**Problem:** `computeTangentBasis()` called per-pixel (millions of times)  
**Solution:** Move computation outside pixel loop, compute once per triangle  
**Impact:** Major performance improvement for normal map baking

### 4. ✅ Per-Material Texture Baking (TextureBaker.ts)
**Problem:** `bakeTexturesPerMaterial()` was returning wrong type, not creating separate textures  
**Solution:** Complete rewrite to properly:
- Group triangles by material slot
- Create 1×1 textures for solid colors (4 bytes vs 4MB!)
- Create sub-meshes for textured materials
- Return proper `PerMaterialBakeResult`  
**Impact:** ChessBoard can have separate white/black/wood textures

---

## Test Results

```
Test Suites: 76 passed, 76 total
Tests:       1185 passed, 1185 total
```

---

## Remaining Issues (For Future Sessions)

### Dark Areas in Textures
**Status:** Under investigation  
**Hypothesis:** UV overlap or degenerate triangles  
**Next step:** Add UV diagnostics

### Blurry/Distorted Textures  
**Status:** Under investigation  
**Hypothesis:** Poor UV utilization or inconsistent scaling  
**Next step:** Check UV space utilization

### Multi-Material Dashboard Rendering
**Status:** Not started  
**Need:** Load and display multiple textures per object  
**Blocked by:** Shader changes needed

---

## Files Modified

| File | Changes |
|------|---------|
| `MeshAnalysis.ts` | Position-based normal grouping |
| `TextureBaker.ts` | AO skip, tangent optimization, per-material baking |

---

## Key Insight

The **root cause** of the seam problem was not in texture baking - it was in **normal computation**. Mesh primitives like `lathe()` create duplicate vertices at seams (same position, different index). The old normal code only averaged normals for vertices with the same INDEX, so seam vertices got unaveraged normals.

The fix groups by POSITION instead of INDEX, ensuring all vertices at the same physical location share the same averaged normal → smooth shading across seams.
