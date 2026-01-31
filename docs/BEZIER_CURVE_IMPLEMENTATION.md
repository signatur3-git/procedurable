# Bezier Curve Support Implementation Plan

**Story:** P2M4-003
**Status:** ✅ Complete
**Backlog:** Updated in `docs/BACKLOG.md`

## Current Problem

We're doing **polygon approximation** instead of **true vector graphics**:
- FontParser converts bezier curves → line segments (approximation)
- LetterH uses straight lines (looks bad)
- No smooth scaling
- Larger file sizes

## Architecture

```
Sources (Font, SVG, YAML) → Path2D (curves) → tessellate → Shape2D (polygon) → extrude → Mesh
```

**Key Principle:** Store curves, tessellate late (only when rendering/extruding).

## What Needs To Be Done (Properly)

### Phase 1: Path2D Foundation ✅ COMPLETE
**File:** `src/platform/geometry/Path2D.ts`

**Status:** Created and functional

**What's done:**
- [x] `Path2D` type with curve segments
- [x] `PathSegment` types: moveTo, lineTo, quadraticCurveTo, cubicCurveTo, closePath
- [x] `tessellateQuadraticCurve()` function
- [x] `tessellateCubicCurve()` function
- [x] `pathToPolygon()` function
- [x] `calculatePathBounds()` function
- [x] `createRectPath()` helper
- [x] `createCirclePath()` helper (using cubic bezier approximation)

**What's needed:**
- [x] Unit tests for tessellation functions
- [x] Unit tests for path helpers

### Phase 2: Shape2D Integration ✅ COMPLETE
**File:** `src/generation/text/FontParser.ts`

**Status:** Complete

**Done:**
1. Added `getGlyphPath()` method (curves preserved)
2. Kept existing `getGlyphOutline()` for backward compatibility
3. Added path contour extraction for bezier segments
4. Returning `Path2DContour[]` with hole detection

### Phase 3: Update TextToShape (Deferred)
**File:** `src/generation/text/TextToShape.ts`

**Status:** Deferred - current pipeline keeps polygon-based text for extrusion

**Note:** Path-based text output can be added later to preserve curves end-to-end,
but the current P2M4-003 scope focuses on bezier-preserving Path2D infrastructure.

### Phase 4: Integrate with Shape2D ✅ COMPLETE
**File:** `src/platform/geometry/Shape2D.ts`

**Status:** Complete

**Done:**
1. Added `path` type to Shape2D
2. Added Path2D-backed Shape2D definitions
3. Extrude2D supports path shapes with tessellation options
4. Adaptive tolerance support for tessellation

### Phase 5: Update YAML Parser ✅ COMPLETE
**File:** `src/generation/builder/YamlBuilderParser.ts`

**Status:** Complete

**Done:**
1. Added `path` shape type to YAML
2. Parsed path segments from YAML
3. Supported both `polygon` and `path` types
4. Added curve tolerance + max segment controls

### Phase 6: Create Proper Letter Library ✅ COMPLETE (Initial Set)
**Files:** `builders/letters/*.yaml`, `builders/icons/*.yaml`

**Status:** Added bezier-based samples

**Done:**
1. Added bezier-based letter examples
2. Updated icon samples to use path shapes
3. Verified path tessellation in extrusions

## Proper Implementation Order

### Step 1: Finish Path2D (1-2 hours)
- Fix type exports
- Add unit tests
- Verify tessellation works

### Step 2: Update FontParser Properly (2-3 hours)
- Fix `extractPathWithCurves` as proper method
- Add `getGlyphPath()` 
- Keep backward compatibility
- Add tests

### Step 3: Update TextToShape (1-2 hours)
- Add `textToPath()` using new API
- Keep old textToShape()
- Add tests

### Step 4: Extend Shape2D (2-3 hours)
- Add path support
- Update extrusion
- Add tests

### Step 5: YAML Integration (2-3 hours)
- Add path type to YAML schema
- Update parser
- Add tests

### Step 6: Create Letter Library (4-6 hours)
- Design nice bezier-based letters
- Test scaling/quality
- Build full alphabet

**Total estimated time: 12-20 hours of focused work**

## Alternative: Shortcut (What We Should NOT Do)

Keep using polygon approximation:
- Faster to implement (2 hours)
- Works "good enough"
- Technical debt forever
- Never truly vector graphics

## Recommendation

**DO THE PROPER IMPLEMENTATION**

Reasons:
1. This is a core feature - worth doing right
2. Vector graphics are about curves, not polygons
3. We'll regret shortcuts later
4. Learning opportunity to do quality work

## Current State

**Compilation:** ✅ Clean
**Tests:** ✅ Path2D + YAML path coverage
**Integration:** ✅ Shape2D + YAML + FontParser path extraction
**Backlog:** ✅ Updated

---

**Decision Point:** Resolved - implementation completed with adaptive tessellation and YAML integration.
