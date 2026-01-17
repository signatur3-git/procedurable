# Bezier Curve Support Implementation Plan

**Story:** P2M4-003
**Status:** 🔄 In Progress
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
**File:** `src/geometry/Path2D.ts`

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
- [ ] Unit tests for tessellation functions
- [ ] Unit tests for path helpers

### Phase 2: Shape2D Integration
**File:** `src/text/FontParser.ts`

**Status:** Started, not finished

**What needs to be done:**
1. Add `getGlyphPath()` method (WITH curves, not approximated)
2. Keep old `getGlyphOutline()` for backward compatibility
3. `extractPathWithCurves()` method ✅ Added but has errors
4. Return `MultiPath2D` instead of `GlyphContour[]`

**Currently broken:**
- Missing imports
- `extractPathWithCurves` is added but not a class method
- Type mismatches

### Phase 3: Update TextToShape
**File:** `src/text/TextToShape.ts`

**Status:** Half-modified, broken

**What needs to be done:**
1. Add `textToPath()` - returns paths with curves
2. Keep old `textToShape()` for backward compatibility
3. Handle kerning with paths
4. Offset paths for positioning

**Currently broken:**
- Type mismatches
- Missing GlyphContour type
- Incomplete implementation

### Phase 4: Integrate with Shape2D
**File:** `src/geometry/Shape2D.ts`

**Status:** Not started

**What needs to be done:**
1. Add `path` type to Shape2D
2. Add `PathShape` interface
3. Update `extrude2D` to handle paths
4. Tessellate paths before extrusion

### Phase 5: Update YAML Parser
**File:** `src/builder/YamlBuilderParser.ts`

**Status:** Not started

**What needs to be done:**
1. Add `path` shape type to YAML
2. Parse path segments from YAML
3. Support both `polygon` (old) and `path` (new)
4. Update extrude2d to handle path shapes

### Phase 6: Create Proper Letter Library
**Files:** `builders/letters/*.yaml`

**Status:** LetterH exists but uses polygons

**What needs to be done:**
1. Create letters with bezier curves:
   ```yaml
   shapes:
     letter_h:
       type: path
       segments:
         - { type: moveTo, point: {...} }
         - { type: lineTo, point: {...} }
         - { type: cubicCurveTo, control1: {...}, control2: {...}, end: {...} }
   ```
2. Make letters look smooth and professional
3. Build alphabet (A-Z, 0-9)

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

**Compilation:** ❌ Broken (type errors, incomplete implementations)
**Tests:** ❌ None written
**Integration:** ❌ Not done
**Backlog:** ❌ Not documented

## Next Actions

1. **Revert broken changes** OR **finish the implementation properly**
2. **Create P2M4-006 story** in backlog with this plan
3. **Allocate proper time** instead of rushing
4. **Test each phase** before moving to next

---

**Decision Point:** Should we:
- A) Revert to working state, add story to backlog, do later?
- B) Commit to finishing this properly NOW (12-20 hours)?
- C) Do the shortcut (keep polygons) and move on?

**My recommendation: Option A** - Revert, document properly, tackle when we have dedicated time.
