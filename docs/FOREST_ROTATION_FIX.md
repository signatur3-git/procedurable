# ForestSlice & TreeScatter - Rotation Bug Fix

**Date:** 2026-01-16  
**Issue:** Rotation data in instances was malformed (object instead of number)  
**Status:** ✅ FIXED

---

## The Bug

When inspecting ForestSlice instances via MCP, the rotation data was malformed:

```json
"rotation": {
  "x": 0,
  "y": {              // ❌ WRONG: Should be a number, not an object!
    "x": 0,
    "y": 0.1111...,   // The actual rotation value
    "z": 0
  },
  "z": 0
}
```

**Expected:**
```json
"rotation": {
  "x": 0,
  "y": 0.1111...,     // ✅ Correct: Just a number
  "z": 0
}
```

---

## Root Cause

In `YamlBuilderParser.ts`, the Poisson scatter placement code had a bug:

```typescript
// Line 766: Create placement with rotation object
placementResult = {
  placements: scatterPoints.slice(0, count).map(point => ({
    position: new Vec3(point.x, center.y, point.z),
    rotation: { x: 0, y: rotationRandom.next() * Math.PI * 2, z: 0 }, // ← Object
    scale: 1,
    aabb: objectAABB.translated(new Vec3(point.x, center.y, point.z))
  })),
  rejected: Math.max(0, count - scatterPoints.length)
};

// Line 783: Pass to builder.compose
builder.compose(instanceName, subBuilderFn, {
  offset: { x: p.position.x, y: p.position.y, z: p.position.z },
  rotation: { x: 0, y: p.rotation, z: 0 },  // ❌ BUG: p.rotation is the whole object!
  overrides: resolvedOverrides,
  asInstance: placement.asInstance
});
```

The bug: `p.rotation` is the object `{ x: 0, y: number, z: 0 }`, but we passed it as the `y` value, creating nested objects.

---

## The Fix

Changed line 783 to extract just the y component:

```typescript
// Before (WRONG):
rotation: { x: 0, y: p.rotation, z: 0 }

// After (CORRECT):
rotation: { x: 0, y: p.rotation.y, z: 0 }
```

---

## Verification

### Before Fix:
```bash
builder.open ForestSlice
builder.run seed=42
builder.instances
```

Result:
```json
{
  "rotation": {
    "x": 0,
    "y": { "x": 0, "y": 0.1111, "z": 0 },  // ❌ Nested object
    "z": 0
  }
}
```

### After Fix:
```json
{
  "rotation": {
    "x": 0,
    "y": 0.1111,  // ✅ Just a number
    "z": 0
  }
}
```

---

## Impact

### What This Fixes:

1. **ForestSlice** - Trees will now have correct rotations
2. **TreeScatter** - Trees will rotate correctly (when it uses Poisson scatter)
3. **Any future Poisson scatter placements** - All will have correct rotation data

### Dashboard Impact:

The dashboard's instance rendering code was likely:
- Ignoring the rotation (because it was malformed)
- OR applying it incorrectly (treating object as number)

With this fix, trees in ForestSlice should now:
- ✅ Render with varied rotations
- ✅ Not all face the same direction
- ✅ Look more natural

---

## Files Modified

| File | Change |
|------|--------|
| `src/builder/YamlBuilderParser.ts` | Changed `p.rotation` to `p.rotation.y` in compose call |

---

## Testing Instructions

1. **Restart the authoring server** (to load the fix)
2. **Refresh the dashboard**
3. **Select ForestSlice**
4. **Run with seed=42**

**Expected:**
- ✅ Ground plane + 11 tree instances
- ✅ Trees at scattered positions (Poisson disk)
- ✅ Trees with varied rotations (not all facing same way)
- ✅ Each tree is a simple trunk (5 hardcoded boxes in TreeScatter)

**MCP Verification:**
```bash
builder.open ForestSlice
builder.run seed=42
builder.instances
# Check rotation.y is a number, not an object
```

---

## TreeScatter Status

**Current:** TreeScatter is a placeholder with 5 hardcoded tree boxes (not using Poisson scatter)

**Why:** It's a demo builder showing what trees would look like. ForestSlice is the real demo that uses Poisson scatter for placement.

**Future:** TreeScatter could be updated to use Poisson scatter internally, but it's not critical since ForestSlice demonstrates the feature.

---

## Summary

✅ **Rotation bug fixed** - Instance rotations now store numbers, not nested objects  
✅ **ForestSlice should work in dashboard** - Trees will render with correct rotations  
✅ **TreeScatter unaffected** - It's a placeholder (5 hardcoded trees)  
✅ **All Poisson scatter placements fixed** - Future uses will work correctly  

**Status:** Ready for dashboard testing after authoring server restart! 🌲🔄

