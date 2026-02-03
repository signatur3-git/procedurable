# Geometry & Texture Pipeline Investigation

**Date:** 2026-02-07  
**Status:** Reverted problematic changes, kept performance fixes

## Executive Summary

Attempted fixes for smooth shading made things **worse** (bevel box rendered incorrectly, dining chair had extreme smoothing). The position-based normal grouping was too aggressive - it smoothed everything including intentional hard edges.

**Lesson learned:** Mesh topology (shared vs duplicated vertices) already encodes smooth vs hard edge intent. The fix should be in the geometry primitives (lathe should share vertices where smooth shading is desired), NOT in the normal computation.

---

## Current State (After Reverts)

| Issue | Status |
|-------|--------|
| Normal computation | ✅ Reverted to simple index-based averaging (respects mesh topology) |
| Normal map baking | ✅ Using flat normals (128,128,255) - works reliably |
| AO skip for large meshes | ✅ Kept - improves ChessBoard performance |
| Per-material baking function | ⚠️ Function exists but NOT INTEGRATED into pipeline |

### Per-Material Baking Status

The `bakeTexturesPerMaterial()` function exists in `TextureBaker.ts` and returns a `PerMaterialBakeResult` with separate textures per material.

**NOW INTEGRATED:**
1. ✅ `bake_textures` command now uses `bakeTexturesPerMaterial()` for multi-material meshes
2. ✅ Saves separate texture files per material: `{builder}_{materialName}_{channel}.png`
3. ✅ New `exportMultiMaterialTexturedGLB()` function creates GLTF with multiple materials, each with its own textures
4. ✅ Solid color materials get 1×1 textures (4 bytes vs 4MB)

**Usage:**
- For ChessBoard: `builder.open ChessBoard; builder.run; builder.bake_textures` will now create separate textures for each material slot
- Dashboard still needs to use the multi-material export function to see the benefit

---

## What Was Tried and Why It Failed

### Failed: Position-Based Normal Grouping

**Idea:** Group vertices by position and share normals between all vertices at same position.

**Problem:** This smoothed EVERYTHING including intentional hard edges:
- Box corners became smooth (wrong)
- Bevel edges became smooth (wrong)  
- Chair seat edges became smooth (wrong)

**Root cause:** The mesh topology (duplicated vertices) is intentional - it encodes where hard edges should be. Overriding this globally breaks the design.

### Failed: Tangent-Space Normal Interpolation

**Idea:** Interpolate vertex normals across triangles and transform to tangent space for normal maps.

**Problem:** Visual artifacts, inconsistent results across different meshes.

**Root cause:** Complex math that's easy to get wrong, and the vertex normals themselves were wrong due to the position-grouping issue above.

---

## What Actually Works

### Flat Normal Maps
Using constant `(128, 128, 255)` for all normal map pixels:
- Renders correctly in dashboard
- No visual artifacts
- Consistent across all meshes

### AO Skip for Large Meshes
Skipping AO computation for meshes >5000 vertices:
- ChessBoard bakes much faster
- Acceptable quality tradeoff

### Index-Based Normal Averaging
Original simple algorithm that averages face normals per vertex INDEX:
- Respects mesh topology intent
- Hard edges stay hard (duplicated vertices)
- Smooth edges stay smooth (shared vertices)

---

## The Right Fix (Future Work)

The seam issue on vases/lathe objects is real but needs to be fixed at the **geometry level**, not the normal computation level:

### Option: Add `smooth` parameter to `lathe()`

```typescript
export function lathe(
  profile: Array<{ x: number; y: number }>,
  segments: number = 16,
  arcAngle: number = Math.PI * 2,
  smooth: boolean = true  // NEW: share vertices at seam for smooth shading
): Mesh {
  // ...
  if (smooth && closed) {
    // Share vertices between segment 0 and segment N
    // This makes the normal averaging work correctly
  }
}
```

This respects the principle: **mesh topology should encode the smoothing intent**.

---

## Files Modified This Session

| File | Final State |
|------|-------------|
| `MeshAnalysis.ts` | Reverted to simple index-based normal averaging |
| `TextureBaker.ts` | Flat normals, AO skip kept, tangent code removed, per-material baking fixed |
| `GLTFExporter.ts` | Added `exportMultiMaterialTexturedGLB()` function |
| `builder.ts` | `bake_textures` command now uses per-material baking |
| `export/index.ts` | Exports new multi-material function |

---

## Related Documentation

- **[COMPOSITE_TEXTURE_SUPPORT.md](./COMPOSITE_TEXTURE_SUPPORT.md)** - Analysis of what's needed for texture support in composite builders (scenes)

---

## Test Results

All tests pass after changes:
- **Test Suites:** 76 passed
- **Tests:** 1185 passed

