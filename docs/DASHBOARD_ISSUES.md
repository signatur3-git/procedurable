# Dashboard Rendering Issues - Investigation Report

**Date:** 2026-01-16  
**Status:** Issues identified, backlog stories created

## Summary

The backend (builders, YAML parser, MCP server) is working correctly and generating proper geometry data. However, the **dashboard visualization has limitations** that prevent it from displaying all features correctly.

## Issues Identified

### 1. ❌ Instance Rendering Not Implemented

**Symptom:** ForestSlice only shows ground plane, not the scattered trees.

**Root Cause:** The dashboard only renders `builder.mesh` (merged geometry). Builders using `asInstance: true` store trees as instance data, not in the merged mesh.

**Backend Status:** ✅ Working correctly
- ForestSlice generates 21 traces (11 tree instances + ground geometry)
- Instance data includes correct positions, rotations, scales
- `builder.instances` command returns instance data

**Dashboard Status:** ❌ Not rendering instances
- Only shows merged mesh (the ground plane: 4 vertices, 1 face)
- Instance data is fetched but not visualized
- Need to implement instance mesh rendering

**Fix Required:** Dashboard-001 (see BACKLOG.md)

---

### 2. ❌ No Decision Override UI

**Symptom:** ConditionalTest always shows square even when `is_round: true` because you can't manually override decisions in the UI.

**Root Cause:** Dashboard displays decision values but has no UI controls to change them. The only way to vary decisions is by changing the seed and hoping the random value is what you want.

**Backend Status:** ✅ Working correctly
- ConditionalTest with seed=100 gives `is_round: true`
- Geometry correctly uses `final_radius: 0.75` (calculated via if() expressions)
- `decision.override` command works perfectly via MCP

**Dashboard Status:** ❌ No interactive controls
- Decisions are display-only
- No toggles, dropdowns, or sliders
- Can't manually test `is_round: true` vs `false`

**Fix Required:** Dashboard-002 (see BACKLOG.md)

---

### 3. ❓ Mesh Update Reliability

**Symptom:** Some builders appear to show same geometry for different seeds.

**Root Cause:** Unclear - possibly caching or incomplete mesh refresh logic.

**Status:** Needs investigation

**Testing Done:**
- ConditionalTest shows different decision values with different seeds ✅
- Mesh data has correct vertex count and bounds ✅
- Visual appearance in dashboard may not reflect data changes ❓

**Fix Required:** Dashboard-003 (see BACKLOG.md)

---

### 4. ℹ️ TreeScatter Hardcoded Trees (By Design)

**Symptom:** TreeScatter shows the same 5 tree trunks for all seeds.

**Root Cause:** TreeScatter is a placeholder demo with 5 manually placed boxes. It's not using Poisson scatter yet.

**Backend Status:** ✅ Working as designed (placeholder)
- TreeScatter.yaml has 5 hardcoded `box` commands
- Comments say "TODO: When scatter system is integrated into YAML"
- This is intentional - it's a demo/placeholder

**Dashboard Status:** ✅ Rendering correctly (showing the 5 hardcoded boxes)

**Notes:**
- Poisson scatter IS implemented and working (P2M2c-002 complete)
- ForestSlice uses Poisson scatter via `placement: scatter_poisson`
- TreeScatter could be updated to use Poisson scatter (see Dashboard-001)
- Currently not a bug, just incomplete feature

---

## Verified Working Features

### ✅ Backend (All Working Correctly)

1. **Poisson Disk Sampling** (P2M2c-002)
   - Full Bridson algorithm implemented
   - 13 tests passing
   - Integrated as `scatter_poisson` placement mode

2. **Conditional Expressions** (P2M2b-003)
   - `if()` expressions work in derived measurements
   - Boolean and choice decisions evaluated correctly
   - ConditionalTest produces correct geometry data

3. **Instancing Output** (P2M2c-003)
   - Instance data generated correctly
   - `builder.instances` command returns proper data
   - Transform data (position, rotation, scale) correct

4. **Hot Reload System** (Infrastructure-001)
   - File changes detected automatically
   - Webhook notifications working
   - Retry logic handles transient failures

5. **All Builders Generate Correct Data**
   - DiningScene: 536 vertices, 298 faces ✅
   - Vase: 192 vertices (lathe working) ✅
   - Cushion: 98 vertices (subdivide working) ✅
   - Mug: 248 vertices (lathe + sweep) ✅
   - ConditionalTest: Geometry adapts to decisions ✅
   - ForestSlice: 21 traces with 11 tree instances ✅

### ❌ Dashboard (Visualization Gaps)

1. **Instance Rendering** - Not implemented
2. **Decision Override UI** - Not implemented
3. **Mesh Refresh** - May have caching issues

---

## Testing Procedure

### To Verify Backend Works:

```bash
# Test ConditionalTest with different decisions
curl -X POST http://127.0.0.1:4200/api/execute \
  -H "Content-Type: application/json" \
  -d '{"commands":["builder.open ConditionalTest","builder.run seed=1","builder.decisions"]}'

curl -X POST http://127.0.0.1:4200/api/execute \
  -H "Content-Type: application/json" \
  -d '{"commands":["builder.run seed=100","builder.decisions"]}'

# Seed 1 gives is_round: false, seed 100 gives is_round: true
```

### To Verify Poisson Scatter:

```bash
curl -X POST http://127.0.0.1:4200/api/execute \
  -H "Content-Type: application/json" \
  -d '{"commands":["builder.open ForestSlice","builder.run seed=42","builder.traces"]}'

# Returns 21 traces: 10 ground geometry + 11 tree instances (compose:tree_1 through tree_11)
```

### To Verify Instance Data:

```bash
curl -X POST http://127.0.0.1:4200/api/execute \
  -H "Content-Type: application/json" \
  -d '{"commands":["builder.open ForestSlice","builder.run seed=42","builder.instances"]}'

# Returns instance array with 11 trees, each with position/rotation/scale
```

---

## Recommended Next Steps

### Priority Order:

1. **Dashboard-001: Instance Rendering** (M - 4-8hr)
   - Highest visual impact
   - Unlocks ForestSlice visualization
   - Demonstrates Poisson scatter feature

2. **Dashboard-002: Decision Override UI** (M - 4-8hr)
   - Essential for testing variations
   - Makes ConditionalTest interactive
   - Better developer/designer experience

3. **Dashboard-003: Mesh Update** (S - 1-4hr)
   - Quick investigation
   - Ensures reliability
   - May be partially addressed by #1 and #2

### Lower Priority:

4. **Update TreeScatter.yaml** (XS - <1hr)
   - Replace hardcoded trees with Poisson scatter
   - Part of Dashboard-001 scope
   - Nice-to-have demo improvement

---

## Conclusion

**The rendering issues are NOT bugs in the builders or backend logic.** They are gaps in the dashboard visualization layer. The geometry data is correct, the decisions work properly, and the Poisson scatter is implemented and functional.

The dashboard needs 3 enhancements to fully visualize all features:
1. Render instance data (not just merged mesh)
2. Add UI controls for decision overrides
3. Ensure mesh updates reliably on seed changes

All issues are documented in BACKLOG.md with clear acceptance criteria and implementation hints.

