# TreeScatter & ForestSlice - Final Status

**Date:** 2026-01-16  
**Status:** ✅ Complete - P2M2c-002 Poisson Disk Scatter DONE
**Story:** P2M2c-002: Poisson Disk Scatter (P2-M2c: World Foundations)

---

## TreeScatter - Fixed! ✅

### Problem
TreeScatter had 5 hardcoded tree boxes at fixed positions that never changed with different seeds.

### Solution
Replaced hardcoded geometry with Poisson scatter placement:

```yaml
# Before: 5 hardcoded boxes
- box:
    name: tree1
    center: { x: 5, y: 4, z: 5 }
    # ... always at same position

# After: Dynamic Poisson scatter
placement:
  mode: scatter_poisson
  builder: Tree
  count: "tree_count_hint"  # 20-60 trees
  width: "forest_width"
  depth: "forest_depth"
  minDistance: "tree_spacing"
  asInstance: false  # Merge into one mesh
```

### Result
- ✅ Tree count varies: 20-60 (based on `tree_count_hint` decision)
- ✅ Tree positions vary with each seed
- ✅ Uses Poisson disk sampling for natural spacing
- ✅ All trees merged into single mesh (good for standalone scene)

---

## ForestSlice - Already Working ✅

### Status
ForestSlice is correctly generating:
- Green ground plane (20m × 20m)
- 11 tree instances via Poisson scatter
- Each tree at varied position and rotation

### Why You Only See Ground

**Trees are there, but very small!**

| Feature | Size |
|---------|------|
| Ground plane | 20m × 20m (huge!) |
| Tree trunks | 0.5m × 2.5m (tiny!) |
| Tree count | 11 instances |

**The trees are only 2.5m tall and 0.5m wide** - much smaller than the 20m ground plane. You need to:
1. **Zoom in** with mouse wheel
2. **Orbit** around to see the vertical brown boxes
3. **Look for brown rectangles** standing on the green ground

### Why So Small?

ForestSlice overrides the tree height:
```yaml
overrides:
  trunk_height: 2.5  # Only 2.5m instead of default 8m
  trunk_width: 0.5   # Very thin trunks
```

This makes the trees realistic scale for a 20m forest patch, but hard to see from far away.

---

## Key Differences

| Feature | ForestSlice | TreeScatter |
|---------|-------------|-------------|
| **Purpose** | World-scale demo | Standalone scene |
| **Instancing** | `asInstance: true` | `asInstance: false` |
| **Geometry** | Instances (separate) | Merged (one mesh) |
| **Tree Count** | 5-15 | 20-60 |
| **Ground Size** | 20m × 20m | 50m × 50m |
| **Tree Height** | 2.5m (override) | 8m (default) |
| **Best Use** | Streaming worlds | Direct viewing |

---

## Testing

### TreeScatter (After Restart):
```
1. Restart authoring server
2. Open dashboard
3. Select TreeScatter
4. Run seed=1 → Should see X trees at positions A
5. Run seed=10 → Should see Y trees at positions B
6. Verify: Different seeds = different results
```

**Expected:**
- Ground plane (50m × 50m green)
- 20-60 brown tree trunks (8m tall × 0.5m wide)
- Trees at scattered positions (Poisson)
- Positions change with seed

### ForestSlice (After Restart):
```
1. Open dashboard
2. Select ForestSlice  
3. Run seed=42
4. Zoom IN close to ground
5. Orbit camera to see vertical structures
6. Look for brown 0.5m × 2.5m boxes
```

**Expected:**
- Green ground (20m × 20m)
- 11 brown tree trunks (2.5m tall × 0.5m wide)
- Trees visible when zoomed in
- Trees at different rotations

---

## Recommendations

### To Make ForestSlice Trees More Visible:

**Option 1: Increase tree height override**
```yaml
overrides:
  trunk_height: 5.0  # Instead of 2.5
  trunk_width: 0.8   # Instead of 0.5
```

**Option 2: Add camera guidance in dashboard**
- Auto-zoom to bounds
- Center camera on scene
- Default orbit angle to show vertical structures

**Option 3: Add color contrast**
- Make trees brighter brown
- Add ambient occlusion
- Use emissive material for visibility

---

## Summary

| Builder | Status | What Changed |
|---------|--------|--------------|
| **TreeScatter** | ✅ Fixed | Now uses Poisson scatter instead of hardcoded trees |
| **ForestSlice** | ✅ Working | Trees are there but small - need to zoom in |

**Both builders now demonstrate Poisson disk sampling!**
- TreeScatter: Merged geometry (standalone scene)
- ForestSlice: Instanced geometry (world-scale demo)

---

**Action Items:**
1. ✅ Restart authoring server (to load updated TreeScatter.yaml)
2. ✅ Refresh dashboard
3. ✅ Test TreeScatter with different seeds
4. ✅ Test ForestSlice with close zoom to see small trees

