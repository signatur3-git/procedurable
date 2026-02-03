# ChessBoard Multi-Material Investigation

**Date**: 2026-02-07
**Status**: Verified - Data Correct, **Texture Atlasing Never Implemented**

## Issue Summary

When viewing the ChessBoard in the dashboard WITH texture preview enabled, chess pieces display a mixture of materials:
- Base and top sections show correct white/black piece colors
- Middle body sections show wood texture (the default color) instead of the piece color

## Root Cause Analysis

After extensive investigation, the **data layer is 100% correct**. All tests pass:
- All 7,558 faces have correct material slot assignments
- `builder.mesh` returns `hasColors: true` with correct vertex colors
- Material slots are correctly remapped during composition

### ⚠️ GAP IDENTIFIED: Texture Atlasing Never Implemented

**The Master Plan and G3 goal both mention "texture atlasing" but no task was created for it.**

From `MASTER_PLAN.md`:
> G3: UV Pipeline | Fix per-operation UVs, smart unwrapping, **texture atlasing**, UV quality gates

From `BACKLOG.md` G3 goal:
> Fix UV generation, add smart unwrapping, **texture atlasing**, and UV quality gates.

**Actual G3 Tasks:**
- G3-001: Per-Operation UV Fixes ✅
- G3-002: Smart UV Unwrapping ✅
- G3-003: UV Quality Gates ✅
- **G3-004: Texture Atlasing - NEVER CREATED**

This is a planning oversight. Texture atlasing for composed scenes (multiple objects sharing texture space) was mentioned in scope but never broken out as an implementable task.

## Why This Matters for ChessBoard

When texture preview is enabled on composed scenes:
1. All 7,558+ triangles share a single 512×512 texture
2. Without proper atlasing, UV islands from 32 chess pieces + board overlap or get too small
3. Per-face material rasterization fails when islands are degenerate
4. Result: mixed materials, wrong textures on wrong faces

## Test Results (Data Layer ✅)

```
Material slot assignment counts:
  edge_material: 6
  light_material: 192
  dark_material: 192
  white_piece: 3584
  black_piece: 3584

ChessBoard faces without materials: 0
```

All 7,558 faces have correct material assignments. The problem is texture baking, not data.

## Verified Components ✅

| Component | Status | Notes |
|-----------|--------|-------|
| ChessPiece.yaml conditionals | ✅ | String comparison `piece_color == "white"` works |
| Material slot assignment | ✅ | All 224 faces per piece have correct slot |
| ChessBoard composition | ✅ | Material slots correctly remapped |
| Face.triangulate() | ✅ | Preserves materialSlotIndex |
| Mesh.triangulate() | ✅ | Preserves materialSlots array |
| resolveFaceColor() | ✅ | Uses materialSlotIndex first, then fallback |
| builder.mesh serialization | ✅ | Returns hasColors=true with correct RGB |
| Dashboard vertex colors | ✅ | Uses vertexColors when hasColors=true |

## Workaround

**Without texture preview**, the ChessBoard renders correctly using vertex colors:
1. Press 'T' to toggle off texture preview
2. View ChessBoard with flat-shaded vertex colors showing correct white/black pieces
3. Individual ChessPiece works correctly with texture preview

## Required: G3-004 Texture Atlasing Task

This finding should result in a new backlog item:

### G3-004: Texture Atlasing for Composed Scenes
**Track:** G | **Status:** ⬜ | **Size:** L
**Dependencies:** G3-002 ✅

**Context:** Composed scenes (ChessBoard, DiningScene) contain multiple objects. Each object needs its own UV space and potentially different materials. Currently all triangles share one 512×512 texture, causing:
- UV island overlap
- Degenerate islands for small objects
- Material assignment confusion

**Acceptance Criteria:**
- [ ] Per-object UV unwrapping before composition
- [ ] Atlas packing: each composed object gets a region of the texture atlas
- [ ] Higher resolution textures for complex scenes (1024 or 2048)
- [ ] Material-aware baking: each atlas region uses correct material
- [ ] Alternative: Multi-material mesh with separate texture per material slot

## Files Involved

- `src/platform/geometry/UVUnwrapper.ts` - Needs per-object atlasing
- `src/platform/materials/TextureBaker.ts` - Needs atlas-aware baking
- `src/servers/dashboard/main.ts` - Texture preview toggle
- `builders/catalog/ChessBoard.yaml` - Complex scene with 5 materials
