# G3-004: Texture Atlasing for Composed Scenes

## Problem

When builders compose sub-builders (e.g., ChessBoard with 32 chess pieces, StyledRoom with table + 4 chairs), each sub-builder's mesh independently uses UV space [0,1]. During `TracedBuilder.compose()`, vertices are cloned with UV attributes unchanged. After merging 32 pieces, all UV islands overlap — pieces share texture pixels, producing garbled textures.

**Root cause**: `TracedBuilder.compose()` (line 2202-2205 of TracedBuilder.ts) clones vertices preserving their original [0,1] UVs. No UV repacking happens after composition.

## Approach: Post-Build UV Repack

The existing `repackExistingUVs()` in `UVUnwrapper.ts` already does 90% of what we need — it detects islands via flood-fill, deduplicates near-identical islands (e.g., 16 identical pawns → 1 island), and packs them via MaxRects. The fix is to call it automatically after composition completes.

**Key**: `applyIslandsToMesh()` already preserves materialSlotIndex, face colors, smooth groups, and normals. This is safe.

## Implementation Steps

### Step 1: Export `repackExistingUVs` and add utility functions to UVUnwrapper.ts

**File**: `src/platform/geometry/UVUnwrapper.ts`

- Export the existing `repackExistingUVs` function (currently private, line 769)
- Add new exported `detectUVOverlap(mesh)` function that uses the same flood-fill + duplicate detection to determine if UV islands overlap, returning `{ hasOverlap, islandCount, uniqueIslandCount }`
- Add new exported `computeAtlasResolution(mesh, baseResolution)` that auto-scales: <100 tri/material → 512, 100-1000 → 1024, 1000+ → 2048

### Step 2: Add `atlas_uvs` option to YamlBuilderTypes.ts

**File**: `src/generation/builder/YamlBuilderTypes.ts`

Add `atlas_uvs?: boolean | 'auto'` to `YamlBuilderDefinition` (after line 49). Default behavior is `'auto'` — detect overlapping UVs after composition and repack if needed.

### Step 3: Add post-build UV repack phase in YamlBuilderExecutor.ts

**File**: `src/generation/builder/YamlBuilderExecutor.ts`

Insert after `const output = builder.build()` (line 988) and before `output.sceneGraph = sceneGraph` (line 989):

- Guard: only run when `atlas_uvs !== false` AND `output.subBuilders.size > 0` AND mesh has UVs
- In `'auto'` mode: call `detectUVOverlap()` — only repack if overlapping
- In `true` mode: always repack
- Call `unwrapMesh(output.mesh, { preserveExistingUVs: true, margin: 0.02, normalize: true })`
- Replace `output.mesh` with the repacked mesh
- Update `output.validation.vertexCount` and `output.validation.faceCount`

### Step 4: Update `builder.bake_textures` auto-resolution

**File**: `src/servers/authoring/commands/builder.ts`

Change `const resolution = getNumberOption(cmd, 'resolution') ?? 512` (line 1540) to auto-detect using `computeAtlasResolution()` when no explicit resolution is provided.

### Step 5: Update dashboard hardcoded resolution

**File**: `src/servers/dashboard/main.ts`

Change lines 221-222 from `'builder.bake_textures resolution=512'` / `'builder.uv_debug resolution=512'` to `'builder.bake_textures'` / `'builder.uv_debug'` (auto-resolution).

### Step 6: Add `builder.atlas_uvs` DSL command

**File**: `src/servers/authoring/commands/builder.ts`

Add a manual `builder.atlas_uvs [margin=<value>]` command near the existing `unwrap` command. This allows agents to manually trigger UV repacking and see stats (island count, utilization, deduplication count, suggested resolution).

### Step 7: Write tests

**File**: `src/tests/__tests__/TextureAtlasing.test.ts` (new)

Tests:
1. `detectUVOverlap` returns `hasOverlap: true` for mesh with overlapping UV islands (two boxes merged)
2. `detectUVOverlap` returns `hasOverlap: false` for single-box mesh
3. `repackExistingUVs` produces non-overlapping UVs for composed mesh
4. Duplicate island deduplication: N identical shapes → 1 unique island
5. `computeAtlasResolution` returns correct resolution tiers
6. Post-repack per-material UV isolation: no overlap within material groups
7. No-UVs mesh: graceful skip (no crash)
8. Single builder (no composition): auto mode skips repack
9. Material slots and face colors preserved after repack

### Step 8: Update BACKLOG.md

Mark G3-004 acceptance criteria as complete, update status to ✅.

## Files Modified
- `src/platform/geometry/UVUnwrapper.ts` — export `repackExistingUVs`, add `detectUVOverlap`, `computeAtlasResolution`
- `src/generation/builder/YamlBuilderTypes.ts` — add `atlas_uvs` field
- `src/generation/builder/YamlBuilderExecutor.ts` — post-build UV repack phase
- `src/servers/authoring/commands/builder.ts` — auto-resolution + `atlas_uvs` command
- `src/servers/dashboard/main.ts` — remove hardcoded resolution=512
- `docs/BACKLOG.md` — mark G3-004 complete

## Files Created
- `src/tests/__tests__/TextureAtlasing.test.ts`

## Edge Cases Handled
| Case | Handling |
|---|---|
| No UVs at all | Skip repack (hasExistingUVs check) |
| No composition (single builder) | Skip repack (subBuilders.size === 0) |
| Already-packed UVs (no overlap) | detectUVOverlap returns false, skip |
| `asInstance: true` compositions | Instances not merged into mesh, no overlap |
| `atlas_uvs: false` opt-out | Skip all repack logic |
| Very large scenes (100+ pieces) | MaxRects handles it; auto-resolution scales to 2048 |

## Estimated Scope
~200 lines new code, ~20 lines modifications. Leverages existing infrastructure heavily.
