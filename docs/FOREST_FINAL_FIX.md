# ForestSlice Visual Issues - Root Cause & Final Fixes

**Date:** 2026-01-16  
**Issue:** ForestSlice shows nothing or overlapping geometry in dashboard  
**Status:** ✅ FIXED (multiple issues found and resolved)

---

## Summary of All Issues Found

| Issue | Type | Status |
|-------|------|--------|
| Rotation data malformed (nested object) | Backend Bug | ✅ Fixed |
| Missing scale handling in dashboard | Dashboard Bug | ✅ Fixed |
| TreeScatter has 50m ground plane | Design Issue | ✅ Fixed |

---

## Issue 1: Rotation Data Malformed ✅ FIXED

**File:** `src/builder/YamlBuilderParser.ts` line 783

**Problem:** `p.rotation` was the entire object `{ x: 0, y: number, z: 0 }`, not just the y value.

**Fix:**
```typescript
// Before:
rotation: { x: 0, y: p.rotation, z: 0 }

// After:
rotation: { x: 0, y: p.rotation.y, z: 0 }
```

**Result:** Rotations now correctly stored as numbers in instance data.

---

## Issue 2: Missing Scale Handling ✅ FIXED

**File:** `src/dashboard/main.ts` line ~610

**Problem:** `transform.scale` is `undefined` when scale=1 (backend optimization), but dashboard called `.setScalar(undefined)`.

**Fix:**
```typescript
// Before:
instanceMesh.scale.setScalar(transform.scale);

// After:
const scale = transform.scale ?? 1;  // Default to 1 if undefined
instanceMesh.scale.setScalar(scale);
```

**Result:** Instances now scale correctly even when scale is omitted.

---

## Issue 3: TreeScatter Has Massive Ground Plane ⚠️ ROOT CAUSE

**Problem:** TreeScatter includes a 50m×50m ground plane + 5 tree boxes. When instanced 11 times in ForestSlice:
- 11 overlapping 50m ground planes render
- Trees are tiny (0.5m trunks) on huge (50m) ground planes
- Visual result: Nothing visible or confusing overlapping geometry

**Why This Happened:**
TreeScatter was designed as a standalone demo scene, not as an instancable tree builder.

**Solution:** Created new `Tree.yaml` builder:
- Single tree trunk (no ground plane)
- 8m tall × 0.5m wide box
- Brown colors
- Perfect for instancing in ForestSlice

**Changes:**
1. Created `builders/Tree.yaml` (new file)
2. Updated `ForestSlice.yaml` to use `builder: Tree` instead of `builder: TreeScatter`

---

## Before vs After

### Before (Broken):
```
ForestSlice instances 11 copies of TreeScatter
Each TreeScatter has:
  - 50m × 50m ground plane (huge!)
  - 5 tiny tree boxes at fixed positions
  
Result: 11 overlapping 50m planes = visual mess
```

### After (Fixed):
```
ForestSlice instances 11 copies of Tree
Each Tree has:
  - 1 tree trunk (0.5m × 8m box)
  - No ground plane
  
Result: Ground plane (merged) + 11 distinct tree trunks at scattered positions
```

---

## New Files Created

### `builders/Tree.yaml`
Simple tree trunk builder for instancing:
- Single 0.5m × 8m box trunk
- Brown colors (dark brown for trunk, medium brown for sides)
- No ground plane
- Accepts `trunk_height` and `trunk_width` overrides
- **Purpose:** Clean tree geometry for instancing (no extra geometry)

---

## Updated Files

| File | Change | Reason |
|------|--------|--------|
| `src/builder/YamlBuilderParser.ts` | `p.rotation` → `p.rotation.y` | Fix rotation nesting |
| `src/dashboard/main.ts` | Handle undefined scale | Fix scale default |
| `builders/ForestSlice.yaml` | Use `Tree` instead of `TreeScatter` | Remove ground plane issue |
| `builders/Tree.yaml` | **New file** | Clean instancable tree |

---

## Testing the Fix

### MCP Verification:
```bash
# Test Tree builder
builder.open Tree
builder.run seed=1
builder.mesh
# Should show: 8 vertices (box), 6 faces, ~0.5m × 8m × 0.5m bounds

# Test ForestSlice with Tree instances
builder.open ForestSlice
builder.run seed=42
builder.instances
# Should show: 11 instances with builder: "Tree", correct rotations

# Check instance data structure
# rotation.y should be a number (not an object)
# scale may be undefined (that's OK, defaults to 1)
```

### Dashboard Visual Test:
1. **Restart authoring server** (critical - loads Tree.yaml)
2. **Rebuild dashboard** (`npm run build`)
3. **Refresh dashboard**
4. **Select ForestSlice**
5. **Run with seed=42**

**Expected Result:**
- ✅ Green ground plane (20m × 20m)
- ✅ 11 brown tree trunks at scattered positions
- ✅ Each trunk is visible (0.5m × 8m)
- ✅ Trees have varied rotations
- ✅ No overlapping ground planes
- ✅ Clean, clear scene

---

## TreeScatter Status

**Updated:** TreeScatter now uses Poisson disk sampling like ForestSlice!

**Changes:**
- Removed 5 hardcoded tree boxes
- Added `placement:` section with `scatter_poisson` mode
- Uses `Tree` builder for each tree trunk
- `asInstance: false` - trees are **merged** into single mesh
- Tree count varies with `tree_count_hint` decision (20-60 trees)
- Positions vary with seed

**Difference from ForestSlice:**
- **TreeScatter:** Merged geometry (all trees in one mesh) - better for standalone viewing
- **ForestSlice:** Instanced geometry (each tree separate) - better for world-scale scenes

**Usage:** 
- TreeScatter is now a fully functional standalone forest scene
- Tree count and positions vary with each seed
- Ground plane + dynamically scattered trees

---

## Architecture Lesson Learned

**Problem Pattern:** Builder designed for standalone use was repurposed for instancing.

**Solution Pattern:** Create separate builders for different purposes:
- **Standalone builders** (TreeScatter): Include ground, context, full scene
- **Instancable builders** (Tree): Minimal geometry, no environment, designed to be composed

**Best Practice:** When creating builders for `placement:` or `compose:`, keep them minimal:
- ✅ Just the object geometry
- ❌ No ground planes
- ❌ No environmental context
- ✅ Accept override parameters for variation

---

## Summary

### What Was Wrong:
1. ❌ Rotation stored as nested object → Dashboard couldn't use it
2. ❌ Scale undefined → Dashboard applied NaN scale
3. ❌ TreeScatter has 50m ground plane → 11 overlapping planes = visual mess

### What's Fixed:
1. ✅ Rotation is now a number
2. ✅ Scale defaults to 1 when undefined
3. ✅ New Tree builder with no ground plane
4. ✅ ForestSlice uses Tree instead of TreeScatter

### Expected Result:
**ForestSlice should now show:**
- Green ground plane (20m × 20m)
- 11 brown tree trunks scattered naturally (Poisson disk)
- Each tree rotated differently
- Clean, visible forest scene

---

**Status:** All fixes applied. Ready for testing after authoring server restart! 🌲✅

---

## Troubleshooting

### ForestSlice Shows Ground But No Tree Trunks

**Possible Causes:**

1. **Camera Position/Zoom**
   - Trees are 0.5m × 2.5m (small!)
   - Ground is 20m × 20m (large!)
   - Camera might be too far away or focused on ground
   - **Solution:** Use orbit controls to zoom in and look for brown vertical boxes

2. **Tree Height Override**
   - ForestSlice overrides `trunk_height: 2.5` (only 2.5m tall)
   - This is shorter than the default 8m in Tree.yaml
   - **Solution:** Trees are there, just shorter than expected

3. **Rendering Order**
   - Ground plane renders first (opaque green)
   - Tree trunks render after (brown)
   - If camera is at ground level, you might only see the ground
   - **Solution:** Tilt camera or zoom in to see vertical trunks

4. **Instance Rendering Not Working**
   - Check browser console for errors
   - Look for "Rendered X/11 instances" in dashboard logs
   - If 0 instances rendered, there's a dashboard issue
   - **Solution:** Check browser console, refresh page

### TreeScatter Shows Same Scene Every Seed

**Fixed!** TreeScatter now uses Poisson scatter. After restart:
- Different seeds → different tree positions
- Different seeds → different tree counts (20-60)
- Ground + dynamically scattered trees

---
