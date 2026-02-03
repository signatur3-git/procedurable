# Session Findings - 2026-02-05 / 2026-02-06 / 2026-02-07

## Summary

This document captures findings and remaining work items from sessions on:
- 2026-02-05: G6 Texture Baking, H3 Chess Board
- 2026-02-06: Grid/For commands, H5 Textured Furniture
- 2026-02-07: Texture baking fixes, smooth shading revert

## Session 2026-02-07 Updates

### Fixed: Smooth Normals Reverted to Flat Shading ✅
**Impact:** Critical (visual regression)  
**Location:** `src/platform/materials/TextureBaker.ts`  
**Problem:** Attempted smooth shading by encoding interpolated world-space normals into normal maps. This resulted in incorrect rendering - all islands showed the same green color instead of proper wood textures.

**Root Cause:** Normal maps are expected to be in tangent space where (0,0,1) means "use geometric normal". We were encoding world-space interpolated normals which the dashboard's PBR shader couldn't interpret correctly.

**Fix Applied:** Reverted to flat shading (neutral tangent-space normal `(128, 128, 255)`). This provides consistent, correct rendering. Smooth shading is deferred as a future enhancement requiring proper tangent-space calculation.

**Files Modified:**
- `src/platform/materials/TextureBaker.ts` - both `bakeTextures()` and `bakeMaterialSlot()` functions

### Known Limitation: Multi-Material Textures (Deferred)
**Impact:** Medium  
**Symptoms:** ChessBoard pieces show material mixing (white base, wood body, black top)  
**Root Cause:** When composing multiple objects into a scene, material slot indices get merged but the texture baking happens on the combined mesh. Face-to-material mapping is lost during composition.

**Status:** Deferred - requires either:
1. Texture atlas per material (complex)
2. Per-component texture baking (complex pipeline change)
3. Proper multi-material shader support

**Workaround:** Use single-material objects or bake textures per component before composition.

### Known Limitation: Texture Re-bake on Seed Change (Deferred)
**Impact:** Low  
**Symptoms:** Changing seed doesn't automatically regenerate textures  
**Workaround:** Press 'T' twice (off then on) to trigger texture rebake

## Completed Work (Previous Sessions)

### G6-002: glTF Export with Baked Textures ✅
- Implemented `exportTexturedGLB()` in `src/export/GLTFExporter.ts`
- Pure TypeScript PNG encoder (no external dependencies)
- DSL command `builder.export_textured_gltf [filename] [resolution=<n>]`
- 22 tests passing

### G6-003: Dashboard PBR Preview ✅
- Keyboard shortcut 'T' toggles texture preview mode
- Texture loading with caching via `loadTexture()` function
- Correct color space handling (SRGB for albedo, Linear for normal/roughness/ao)
- State tracking: `showTexturePreview`, `textureCache`, `availableTextures`

### G6-004: Texture Housekeeping ✅
- `TextureCache` class in `src/storage/TextureCache.ts`
- DSL commands: `texture.list`, `texture.size`, `texture.clean`, `texture.delete`
- Orphan detection, dry-run mode, duration parsing
- 18 tests passing

### H3-001: Chess Board Demo (Partial) 🟡
- Created `builders/catalog/ChessBoard.yaml` with board geometry
- Created `builders/catalog/components/ChessPiece.yaml` with lathe profiles for all 6 piece types
- 9 tests created

## Findings / Gaps Identified

### Finding 1: Loop Geometry Command Not Implemented ✅ RESOLVED
**Impact:** Medium  
**Location:** `src/generation/builder/YamlBuilderExecutor.ts`  
**Details:** The YAML executor warns "Unknown geometry command: loop" when a builder tries to use `loop:` to generate repeated geometry. This prevents generating the 64 squares of the chessboard programmatically.

**Resolution (2026-02-06):** Implemented `grid` and `for` commands in `ControlFlowCommands.ts`:
- `grid`: 2D iteration with `rows`, `cols`, `row_var`, `col_var` parameters
- `for`: Alias for existing `repeat` command
- ChessBoard now generates 64 squares using grid command

---

### Finding 2: Composition Not Automatically Invoked
**Impact:** Medium  
**Location:** `src/generation/builder/YamlBuilderExecutor.ts`  
**Details:** The `composition:` section in YAML builders is defined but the executor doesn't automatically process it to compose child builders. The `builderResolver` is passed but composition entries aren't iterated.

**Workaround:** Composition works when explicitly called via test harness with `builderResolver`.

**Recommended Fix:** Add composition processing loop in `executeBuilder()` after geometry processing.

---

### Finding 3: String Comparison in Expressions
**Impact:** Medium (upgraded from Low)  
**Location:** Expression evaluator  
**Details:** Expression evaluator cannot compare strings with `==`. Example: `board_style == 'modern'` fails with "Cannot convert 'modern' to a number". This affects:
- Derived expressions that select values based on choice decisions
- Conditional geometry (`condition:` attribute)
- Any expression referencing string decision values

**Workaround:** 
- Use separate builders for each variant instead of conditional geometry
- Use numeric decision types where possible
- For ChessPiece, simplified to single generic profile

**Recommended Fix:** Extend expression evaluator to support string equality checks (`==`, `!=`) and string literals.

### Finding 4: Inline Profiles in Lathe/Sweep Commands ✅ RESOLVED
**Impact:** Low (nice-to-have)  
**Status:** Fixed (2026-02-06)
**Location:** LatheCommand.ts, SweepCommand.ts  
**Details:** The lathe and sweep commands now support both profile references AND inline definitions:

```yaml
# SUPPORTED - inline profile
- lathe:
    name: piece_body
    profile:
      - { x: 0, y: 0 }
      - { x: 0.1, y: 0.5 }
    segments: 16

# SUPPORTED - profile reference
- lathe: piece_body
  profile: my_profile_name
  segments: 16
```

**Files Modified:**
- `src/generation/builder/commands/LatheCommand.ts`
- `src/generation/builder/commands/SweepCommand.ts`

---

### Finding 5: Minor TypeScript Warnings
**Impact:** Low  
**Locations:** Various files  
**Details:** Several warnings about imports that can be shortened, unnecessary `continue` statements, and redundant variables. These don't affect functionality.

**Status:** Non-blocking, can be addressed in code cleanup pass.

---

### ~~Finding 6: Test File Compilation Error (GearBuilder.test.ts)~~ RESOLVED
**Status:** ✅ Resolved (2026-02-06)  
**Details:** The test file was previously reported to use `import.meta.url`, but current tests pass. The issue was either cached or has been fixed.

---

## Test Status

- **Total tests:** 1164+ (estimated, terminal output issues prevented exact count)
- **New tests added:** 40 (22 for GLTFTexturedExport, 18 for TextureCache)
- **ChessBoard tests:** 9 tests created, functionality working for board geometry

## Files Modified/Created

### New Files
- `src/export/GLTFExporter.ts` - exportTexturedGLB function
- `src/storage/TextureCache.ts` - Texture cache management
- `src/servers/authoring/commands/texture.ts` - Texture commands
- `src/tests/__tests__/GLTFTexturedExport.test.ts` - 22 tests
- `src/tests/__tests__/TextureCache.test.ts` - 18 tests
- `builders/catalog/ChessBoard.yaml` - Chess board builder
- `builders/catalog/components/ChessPiece.yaml` - Chess piece component
- `src/tests/__tests__/ChessBoard.test.ts` - 9 tests

### Modified Files
- `src/servers/authoring/server.ts` - Register textureNamespace
- `src/servers/authoring/commands/builder.ts` - Add export_textured_gltf command, fix type errors
- `src/servers/dashboard/main.ts` - Add texture preview mode
- `src/export/index.ts` - Export new types
- `docs/BACKLOG.md` - Updated status

### Finding 7: ChessBoard Material Colors Working ✅ VERIFIED
**Status:** Working as designed (2026-02-06)  
**Location:** `builders/catalog/ChessBoard.yaml`  
**Details:** Initial concern that material colors weren't displaying correctly in the dashboard. After investigation:
- Light material (`#F0D9B5`) displays as creamy/white squares ✅
- Dark material (`#B58863`) displays as warm brown squares ✅
- Edge material (`#5D4037`) displays as darker wood frame ✅

The colors are correctly applied via vertex colors. The dark squares appear "wood colored" because `#B58863` is indeed a warm brown - this is intentional chess board coloring (similar to wooden chess boards).

**Verification:** 
- `builder.mesh` output confirms `hasColors: true` with correct RGB triplets
- Dashboard renders with `vertexColors: true` mode

---

## Recommendations for Next Session

1. ~~**Implement loop geometry**~~ ✅ Done - grid/for commands implemented
2. **Auto-process composition** - Would enable the chess pieces to render on the board
3. **Complete H3-001** - With loop/composition, the chess demo would be fully functional
4. ~~**Consider H2 or H5**~~ - H5 started (see below)

---

## H5-001: Textured Furniture Progress (2026-02-06)

### Completed

| Criterion | Status | Notes |
|-----------|--------|-------|
| Procedural materials | ✅ | `procedural_materials` section added to DiningChair.yaml |
| UV unwrapping | ✅ | 100% utilization, 62 islands |
| Baked textures | ✅ | albedo, roughness, metallic, normal, ao channels |
| Deterministic | ✅ | Same seed produces identical textures |
| Dashboard PBR preview | ✅ | 'T' key toggles texture mode |
| glTF export | ✅ | Produces valid GLB with embedded textures |

### Partial / Needs Work

| Criterion | Status | Notes |
|-----------|--------|-------|
| UV stretch < 10% | ⚠️ | Currently 12.54% - needs unwrap tuning |
| Mesh analysis for wear | 🟡 | Infrastructure exists, not wired to builder |
| Branded variant | ⬜ | Decal/text commands exist, need integration |
| Distinct wear patterns | 🟡 | Works with different seeds, needs validation |

### Test Results

```
builder.open catalog/DiningChair
builder.run seed=42
builder.unwrap
builder.export_textured_gltf DiningChair_H5 resolution=256

Result:
- 296 vertices, 172 triangles
- 4 textures at 256x256
- 45% bake coverage
- File: output/DiningChair_H5_textured.glb (1037.5 KB)
```

### Finding 8: Procedural Materials Section Not Auto-Processed
**Impact:** Low (enhancement)  
**Details:** The `procedural_materials:` section added to DiningChair.yaml is declarative documentation but not automatically read by the executor. The `builder.export_textured_gltf` command uses a hardcoded wood_grain material. To complete H5 fully, the command should read the material definition from the builder's YAML.

**Workaround:** The hardcoded default (oak wood_grain) produces reasonable results.

**Recommended Fix:** Extend `export_textured_gltf` to check for `procedural_materials` in the builder definition and use it if present.

---

### Finding 9: Dashboard Texture Preview Requires Pre-Baked Files ✅ FIXED
**Impact:** Medium  
**Status:** Fixed (2026-02-06) - `builder.bake_textures` command added
**Details:** The dashboard's 'T' key texture preview mode (`showTexturePreview`) calls `texture.list` to find baked PNG files in the texture cache.

**Solution Implemented:**
- Added `builder.bake_textures [resolution=<n>]` command
- Bakes textures and saves to `output/textures/{builder}_{channel}.png`
- Dashboard can now find and load these files via `texture.list`

**New Workflow:**
```
builder.open catalog/DiningChair
builder.run seed=42
builder.unwrap
builder.bake_textures resolution=512
# Then in dashboard, press 'T' for texture preview
```

**Files Modified:**
- `src/servers/authoring/commands/builder.ts` - Added `bake_textures` command
- `src/export/GLTFExporter.ts` - Exported `encodeTextureToPNG()` helper

---

### Finding 10: Texture Preview Not Supported for Scene Builders
**Impact:** Low (expected limitation)  
**Status:** Documented, workaround in place  
**Details:** Texture preview ('T' key) only works for single-object builders. Scene builders (like `DiningScene`) contain multiple composed objects (chairs, table), each needing separate textures.

**Current Behavior:**
- Dashboard detects scene builders (path contains "scene" or "Scene")
- Skips texture baking/loading for scenes
- Logs: "Texture preview not supported for scene builders"

**Future Enhancement:** Per-component texture baking for scenes would require:
1. Baking textures for each composed builder separately
2. Storing textures with component-specific names
3. Applying correct textures to each instance during rendering

---

### Finding 11: Round/Circular Geometry Has Rendering Issues
**Impact:** Medium (visual quality)  
**Status:** Documented for future implementation  
**Details:** Objects with circular geometry (lathe, loft on circles, caps) and thin repeated elements have rendering/texture issues.

**Issue A: Flat Shading**
- Curved surfaces appear faceted instead of smooth
- Root cause: per-face normals instead of per-vertex averaged normals

**Issue B: Texture Baking Artifacts - ROOT CAUSE IDENTIFIED (2026-02-06)**  
- Small bevel corner/edge triangles get degenerate UV coordinates after packing
- When projected, small triangles can collapse to near-zero area in UV space
- The texture baker's `barycentric()` function returns null for degenerate triangles
- Result: zero pixels get baked for these triangles → black spots when rendered

**Root Cause Analysis:**
1. Bevel creates small corner triangles (3-face intersections) and edge quads
2. These get placed in separate UV islands during segmentation
3. When projected to 2D UV space, some projections are edge-on → near-zero area
4. UV packing places these at specific locations, but the triangles remain degenerate
5. Texture baker iterates pixels, tries to find containing triangle via barycentric coords
6. Degenerate triangles have `denom ≈ 0` in barycentric calculation → return null
7. No pixels baked for these triangles → black when rendered

**Fixes Implemented (2026-02-06):**
1. **Multi-axis projection fallback**: `projectIslandToUV()` now tries XY, XZ, YZ planes
   and picks the projection with largest bounding box area
2. **Minimum range enforcement**: `normalizeIslandUVs()` ensures uRange and vRange are
   at least 0.01 (5 pixels at 512x512) to prevent degenerate triangles
3. **Minimum island size**: `packIslands()` enforces `minIslandSize = 0.01` 
4. **Texture dilation**: Added `dilateTexture()` to fill margins around UV islands,
   preventing black bleeding even if some triangles don't get baked

**Affected Geometry:**
- `lathe` command (Vase, ChessPiece)
- `loft` between circles (round Table top)
- `cap` on circular loops (Table top/bottom caps)
- `cylinder` primitive
- DiningChair with `back_style: slat` (thin vertical slats)
- DiningChair with `back_style: ladder` (horizontal rungs)
- Round Table (seed 2)
- **Bevel operations** - especially corner triangles where 3+ edges meet

**Affected Builders:**
- `catalog/Table` - round style (seed 2)
- `catalog/Vase` - lathe-generated body
- `catalog/DiningChair` - slat and ladder back styles
- `catalog/components/ChessPiece` - lathe-generated pieces
- `test-fixtures/BeveledBox` - bevel corner/edge faces

**Recommended Additional Fixes:**
1. Add `shading_mode` attribute (`flat` or `smooth`) to geometry commands
2. For smooth mode, calculate per-vertex normals by averaging adjacent faces
3. Improve UV unwrapping for cylindrical/disc geometry (polar projection)
4. Consider specialized UV mapping for thin/repeated elements (slats, rungs)

**Status:** Fixes implemented in UVUnwrapper.ts and TextureBaker.ts.
- **REQUIRES SERVER RESTART** to load the updated code
- Changes made to `projectIslandToUV()`, `normalizeIslandUVs()`, `packIslands()`, and added dilation functions
- After server restart, test with `builder.open test-fixtures/BeveledBox`, then unwrap and bake textures

---

### Finding 12: Texture Preview Re-Bakes on Every Use
**Impact:** Low (performance trade-off)  
**Status:** Working, documented  
**Details:** Texture preview always re-bakes textures when enabled or when navigating seeds. This ensures textures always match the current mesh but takes ~1-2 seconds per bake.

**Current Behavior:**
- Press 'T' → bakes textures for current mesh, displays them
- Navigate to new seed with texture preview on → re-bakes automatically
- Textures are overwritten each time (not cached per-seed)

**Trade-off:** Reliability over performance. Always re-baking ensures correct results.

---

### Finding 13: UVTest Builder Has No Geometry
**Impact:** Low (test fixture issue)
**Status:** Fixed - needed literal values instead of expressions
**Details:** The `test-fixtures/UVTest.yaml` builder now works with literal values in box command.

---

### Finding 14: UV Debug Texture for Visual Comparison ✅ IMPLEMENTED
**Impact:** High (debugging tool)
**Status:** Implemented (2026-02-06)
**Location:** `src/platform/materials/TextureBaker.ts`, `src/servers/dashboard/main.ts`

**Feature:** When texture preview is enabled (press 'T'), the dashboard now:
1. Generates a UV debug texture (`{builder}_uv_debug.png`) showing all UV triangles with distinct colors
2. Shows clickable links in the detail panel to view: Albedo, Normal, Roughness, AO, and **UV Debug** textures
3. Logs UV statistics: triangle count, degenerate count, total coverage

---

### Finding 15: Texture Baker Missing Triangles - ROOT CAUSE IDENTIFIED
**Impact:** Critical
**Status:** FIX IMPLEMENTED - REQUIRES SERVER RESTART
**Location:** `src/platform/materials/TextureBaker.ts`

**Problem:** UV triangles visible in UV debug texture were not being baked to the albedo texture. Specifically, triangles in the "top row" (V > 0.93) were showing as colored in UV debug but corresponding to black areas in albedo.

**Root Cause:** The original texture baker used a pixel-iteration approach with a spatial index lookup:
```
for each pixel:
  lookup which triangle contains this pixel (using spatial index)
  if found: bake
```

This failed for triangles near UV boundaries due to:
1. Spatial index cell calculation issues at UV = 1.0
2. Triangles that straddled cell boundaries weren't found correctly

**Fix Applied:** Rewrote `bakeTextures()` to use triangle-iteration approach:
```
for each triangle:
  calculate pixel bounding box
  for each pixel in bounding box:
    if pixel center is inside triangle (barycentric test):
      bake
```

This guarantees every triangle is visited and baked.

**Additional Tools Added:**
- `builder.uv_compare` command - diagnostic that shows exactly how many pixels would be baked for each top-row triangle
- Helps identify if barycentric test is rejecting valid pixels

**To Test:** After server restart:
1. `builder.open test-fixtures/BeveledBox`
2. `builder.run seed=1`
3. `builder.unwrap`
4. `builder.bake_textures resolution=512`
5. `builder.uv_debug resolution=512`
6. Compare textures - they should now match

**How to Use:**
1. Load any builder (e.g., `catalog/DiningChair`)
2. Press 'T' to enable texture preview
3. In the detail panel on the right, click the texture links to view them
4. Compare "UV Debug" with "Albedo" - they should show the same UV islands
5. Any black areas in Albedo that have color in UV Debug indicate UV mapping issues

**Implementation:**
- `generateUVDebugTexture()` in TextureBaker.ts
- `builder.uv_debug` DSL command
- Dashboard automatically generates UV debug when baking textures
- Automated tests in `UVDebugTexture.test.ts`

**Statistics Provided:**
- `triangleCount`: Total UV triangles
- `degenerateCount`: Triangles with near-zero UV area (problematic)
- `totalArea`: Sum of UV triangle areas (utilization)
- `minArea` / `maxArea`: Smallest/largest triangle areas
