# Master Plan - Procedurable

> This document is the source of truth for what we're building and in what order.
> We follow this plan. We don't freestyle. We only deviate for serious blockers.

## Related Documents

**Artist Perspective (What to Build):**
- `PROBLEM_DOMAIN.md` - Target builders and their requirements
- `SOLUTION_DOMAIN.md` - Geometry tools inventory
- `ALIGNMENT_MATRIX.md` - Builder × Tool mapping

**Programmer Perspective (How to Author):**
- `AUTHORING_PROBLEM_DOMAIN.md` - Builder authoring challenges
- `AUTHORING_SOLUTION_DOMAIN.md` - Authoring infrastructure inventory
- `AUTHORING_ALIGNMENT_MATRIX.md` - Feature prioritization

**Scale & Algorithms (How to Think Big):**
- `PROCEDURAL_TECHNIQUES.md` - Noise, patterns, layout algorithms
- `SCALE_AMBITION.md` - Infinite worlds, Doom levels, architecture

---

# PHASE 1: Infrastructure (MCP + Authoring Server)

> Goal: Stable v1.0.0 release candidate for MCP server and authoring API.
> After this phase, the static API is frozen. Extensions happen via command payloads.

## Current Status (January 13, 2026)

### Completed Milestones
- ✅ **M1**: Agent Inspection Enhanced - DSL command system working
- ✅ **M2**: Real-Time Dashboard - Single seed view with navigation
- ✅ **M3**: Agent Builder Editing - Measurements/decisions via DSL
- 🟡 **M4**: Builder Composition - Core `compose()` working, examples created

### Frozen for Later
- PersonBuilder prototype (advanced geometry tools built, frozen until Phase 2)
- Spline, Subdivision, Sweep, MeshTransform tools (built, frozen until needed)

---

## M4: Builder Composition ✅ COMPLETE
**Status**: All tasks done!

**Completed Tasks**:
1. [x] Update M4_CHECKLIST.md with accurate status
2. [x] Verify Table works in dashboard
3. [x] Add Scene composition (table + chairs together) ✅ DiningScene
4. [x] Document composition API ✅ COMPOSITION_API.md
5. [x] Add command console widget to dashboard ✅ Shows agent commands

**Exit Criteria** (all met):
- ✅ TableBuilder works in dashboard
- ✅ Can compose a simple scene (table + chairs) - DiningScene with up to 6 chairs
- ✅ Dashboard shows command history from agent - Console widget added

---

## M5: Storage & YAML Builders
**Status**: ✅ COMPLETE

**Completed Tasks**:
1. [x] Define YAML builder definition format specification
2. [x] Implement builder definition parser (basic)
3. [x] FileSystemStorage provider (read/write YAML from disk)
4. [x] Convert DiningChair to YAML - DiningChair.yaml
5. [x] Convert Table to YAML (rectangular + round) - Table.yaml
6. [x] Enhanced expression engine (sin, cos, pi, negation) - MathService
7. [x] Repeat construct for iterative geometry
8. [x] If/else blocks for conditional geometry
9. [x] DiningScene YAML with composition
10. [x] DSL commands: `storage.*`, `math.*`
11. [x] StorageProvider interface (prep for S3 later)
12. [x] YAML priority over TypeScript when both exist
13. [x] TypeScript builders removed (except Person - Phase 2)

**Exit Criteria**: ✅ ALL MET
- Expression engine supports trig functions
- Table.yaml works for rectangular AND round styles
- DiningScene.yaml composes Table + Chairs
- TypeScript DiningChair, Table, DiningScene can be removed

---

## M6: MCP v1.0.0 Release Candidate
**Status**: ✅ COMPLETE

**Tasks**:
1. [x] Finalize MCP tool signatures (freeze static API)
2. [x] Document all DSL commands comprehensively → docs/DSL_COMMANDS.md
3. [x] Version the protocol (v1.0.0) - API_VERSION in system.ts
4. [x] Add `version` command to return API version
5. [x] Deprecation policy for future changes → docs/DEPRECATION_POLICY.md
6. [x] Integration test suite for MCP commands → src/tests/mcp-integration.test.ts (29 tests, all passing)
7. [x] README for MCP setup and usage → MCP_SETUP.md

**Exit Criteria**: ✅ ALL MET
- MCP tools are stable and documented
- Breaking changes require major version bump (policy documented)
- All current DSL commands have tests (29 tests passing)

---

# PHASE 2: Toolkit Expansion (Domain-Driven)

> Goal: Build geometry/material tools by implementing builders across domains.
> Each domain requires specific tools. We pick domains strategically to build a complete toolkit.
> PersonBuilder is the capstone - it uses everything.

## Philosophy

Instead of building tools in isolation, we:
1. Identify **target scenes/builders** across different domains (see `PROBLEM_DOMAIN.md`)
2. List **tools required** for each (see `SOLUTION_DOMAIN.md`)
3. Build **alignment matrix** to find optimal path (see `ALIGNMENT_MATRIX.md`)
4. **Expose built tools before building new ones** - maximize value, minimize effort
5. PersonBuilder comes last as it combines all tools

---

## Domain Analysis ✅ COMPLETE

See supporting documents:
- `docs/PROBLEM_DOMAIN.md` - 25 target builders across 8 domains
- `docs/SOLUTION_DOMAIN.md` - Tool inventory with build status
- `docs/ALIGNMENT_MATRIX.md` - Cross-reference and optimal ordering

### Key Insight from Analysis

**4 high-impact tools are already built but not exposed via DSL:**
- Spline/Profiles (unlocks 8 builders)
- Lathe (unlocks 6 builders)  
- Sweep (unlocks 8 builders)
- Subdivision (unlocks 7 builders)

**Action:** Expose these BEFORE building new tools.

---

## Phase 2 Milestones (Restructured based on Alignment Analysis)

### P2-M1: Procedural Materials (Steps 1-3) ✅ COMPLETE
**Status**: Steps 1-3 complete. Steps 4-6 deferred to P2-M6.

#### Step 1: Per-Part Colors ✅ COMPLETE
- [x] Add color property to Face class
- [x] Update TracedBuilder methods to accept color
- [x] Update mesh serialization to include vertex colors
- [x] Update dashboard to render vertex colors
- [x] Add `materials` section to YAML schema
- [x] Create ColoredChair.yaml test builder

#### Step 2: Material Decisions ✅ COMPLETE
- [x] Create MaterialLibrary.ts with named colors
- [x] Implement conditional materials (when/default)
- [x] Create WoodChair.yaml with wood_type decision
- [x] All integration tests passing

#### Step 3: Mesh-Derived Map Baking ✅ COMPLETE
- [x] AO map, curvature map, height map generation
- [x] DSL commands: `material.bake-maps`, `material.maps`, `material.maps-stats`
- [x] MeshMapBaker.ts implementation

**Steps 4-6 (Layer Stack, Smart Materials, Material Editor) → Deferred to P2-M6**

---

### P2-M1b: Expose Built Geometry Tools 🟡 IN PROGRESS
**Required for**: Vessels, organic shapes, pipes, characters
**Status**: 🟡 In Progress - Steps 1-3 complete, Steps 4-5 remaining

**Rationale**: We have Spline, Lathe, Sweep, Subdivision already implemented in TypeScript.
Exposing them via DSL/YAML unlocks ~15 builders with minimal new code.

#### Step 1: Spline & Profile DSL ✅ COMPLETE
- [x] Add `profiles:` YAML section for defining 2D profiles
- [x] Support types: circle, ellipse, rect, polygon
- [x] Support expression evaluation for profile point coordinates
- [x] Add `splines:` YAML section for 3D paths (sweep paths)
- [ ] DSL commands: `geometry.spline`, `geometry.profile` (optional - YAML works)

#### Step 2: Lathe DSL ✅ COMPLETE
- [x] Add `lathe:` YAML geometry command
- [x] Parameters: profile reference, segments, angle (axis defaults to Y)
- [x] Integrate with TracedBuilder via mergeMesh()
- [x] Test builder: Vase.yaml (simple lathe) ✅ 192 vertices, 168 faces

#### Step 3: Sweep DSL ✅ COMPLETE
- [x] Add `sweep:` YAML geometry command
- [x] Parameters: profile, path (spline), segments, twist, scale
- [x] Handle orientation frames along path
- [x] Test builder: Mug.yaml (lathe body + sweep handle) ✅ 248 vertices, 218 faces

#### Step 4: Subdivision DSL ✅ COMPLETE
- [x] Add `subdivide:` YAML geometry command
- [x] Parameters: iterations
- [x] Integrate with TracedBuilder via replaceMesh()
- [x] Test builder: Cushion.yaml (box → subdivide → soft cushion) ✅ 98 vertices, 96 faces

#### Step 5: Integration Tests & Cleanup
- [ ] Add integration tests for lathe, sweep, subdivide commands
- [ ] Clean up test builders (MugBody can be removed)
- [ ] Update DSL_COMMANDS.md with new geometry commands
- [ ] Verify all new builders work in dashboard

**Exit Criteria**:
- Lathe creates smooth rotational solids
- Sweep creates tubes along arbitrary paths
- Subdivision smooths control cages
- Vase, Bottle, Bowl, Mug builders work in dashboard
- All new DSL commands have integration tests

---

### P2-M2: Scene Constraints & Packing ✅
**Required for**: DiningScene quality (no overlaps), set dressing, environments
**Status**: ✅ COMPLETE

> Rationale: This is the single fastest path to believable scenes and fixes the recurring
> "chairs overlap / orientation wrong" class of issues. It also becomes the foundation
> for clutter placement and later environment builders.

#### Step 1: Spatial Primitives ✅ COMPLETE
- [x] AABB class with overlap, distance, padding methods (`src/core/AABB.ts`)
- [x] Mesh.getAABB() method for computing bounds
- [x] XZ-plane distance checks for floor placement

#### Step 2: Packing / Placement API ✅ COMPLETE
- [x] `placeAroundRectangle()` - chairs around rectangular tables (`src/builder/Placement.ts`)
- [x] `placeAroundCircle()` - chairs around round tables
- [x] Collision avoidance with minDistance parameter
- [x] Centered candidate positions along each side
- [x] allowReducedCount option when space runs out

#### Step 3: YAML Integration ✅ COMPLETE
- [x] `YamlPlacement` interface in YamlBuilderParser
- [x] `placement:` section in YAML schema
- [x] Automatic AABB computation from sample build
- [x] DiningSceneV2.yaml using placement system

#### Step 4: DiningScene Fixes (Acceptance Test) ✅ COMPLETE
- [x] Test seeds 1-50: no chair overlaps
- [x] Chairs face table center correctly
- [x] Reduced count when space insufficient (expected behavior)

#### Step 5: Debug/Inspection
- [x] Composed instances visible in traces (chair_1, chair_2, etc.)
- [ ] Optional: Add placement stats trace (requested vs placed count)

**Exit Criteria**: ✅ MET
- DiningSceneV2 seeds 1-50: no chair overlaps, chairs oriented correctly
- Placement logic is reusable for future clutter/environment builders

**Note**: When requested chair count exceeds available space, the placement
system reduces the count rather than overlapping chairs. This is the intended
behavior with `allowReducedCount: true`.

---

### P2-M2b: Authoring Infrastructure 🟡
**Required for**: All future milestones, better debugging, optional parts
**Status**: 🟡 In Progress - Steps 1-2 complete, noise added
**Reference**: See `AUTHORING_ALIGNMENT_MATRIX.md` for full analysis

> These are foundational improvements to the builder authoring system that
> unblock patterns needed by multiple geometry milestones.

#### Step 1: Conditional Composition ✅ COMPLETE
- [x] Add `if:` wrapper for compose entries
- [x] Syntax: `compose: { cushion: { if: "$include_cushion", builder: Cushion } }`
- [x] Evaluate condition from decisions/measurements
- [x] Support: boolean checks, comparisons (>, <, >=, <=), equality (==, !=)
- [x] Dynamic builder resolver (all YAML builders available for composition)
- [x] Unblocks: Optional parts pattern (stretchers, arms, decorations)

#### Step 2: Iterative Composition ✅ COMPLETE
- [x] Add `repeat:` field to YamlComposition interface
- [x] Syntax: `repeat: { count: 4, as: "i" }`
- [x] Index available in expressions for offset: `x: "i * spacing"`
- [x] Generate unique instance names: `leg_0`, `leg_1`, etc.
- [x] Unblocks: Arrays/grids (teeth, slats, fence posts)

#### Step 2b: Noise Infrastructure ✅ COMPLETE
- [x] Add Perlin noise (2D and 3D) to MathService
- [x] Add FBM (fractal brownian motion) for layered noise
- [x] Add coordinateHash for deterministic coordinate-based seeding
- [x] DSL commands: `math.noise`, `math.fbm`, `math.hash`
- [x] Unblocks: Terrain, organic variation, infinite worlds

#### Step 3: Conditional Expressions
- [ ] Add `if(condition, then, else)` function to MathService
- [ ] Condition syntax: `is_round`, `value > 0.5`, `style == "modern"`
- [ ] Unblocks: Complex derived values

#### Step 4: Better Error Context
- [ ] Include YAML path in error messages
- [ ] Format: "Error at decisions.chair_count: min must be <= max"
- [ ] Track source locations during YAML parsing

**Exit Criteria**:
- Can create builders with optional parts via `if:` in compose
- Can create arrays via `repeat:` construct
- Error messages point to YAML location
- All existing builders still work

---

### P2-M2c: World Foundations (Fields + Scatter + Instancing + Chunk Contract) ⬜
**Required for**: Natural scenes, large worlds, streaming generation, believable clutter
**Status**: ⬜ Not Started
**Reference**: `AUTHORING_PROBLEM_DOMAIN.md` (Level 7), `AUTHORING_SOLUTION_DOMAIN.md` (Fields/Search)

> Goal: Add the minimum foundation needed to generate *world-scale* content from a single seed
> without rewriting the system later.
>
> This milestone intentionally focuses on **representations and determinism** (fields / instances)
> rather than building a full terrain engine.

#### Step 1: Scalar Field Abstraction (MVP)
- [ ] Introduce a minimal `ScalarField` concept (callable `sample(x,y,z)`)
- [ ] Provide built-in adapters:
  - [ ] `field.constant(value)`
  - [ ] `field.noise2d(seed, frequency, amplitude)` (wraps MathService perlin/fbm)
  - [ ] `field.remap(field, inMin, inMax, outMin, outMax)`
  - [ ] `field.clamp(field, min, max)`
- [ ] DSL command group: `field.*` (optional in Phase 2 if YAML-only is cleaner)

#### Step 2: Scatter / Point Sampling (Poisson Disk)
- [ ] Implement Bridson Poisson disk sampling (2D) for scatter points within bounds
- [ ] Support field-driven density masks (thin adapter):
  - [ ] “higher density where mask(x,z) is high”
- [ ] Output: a list of points + optional orientation (future: flow field)

#### Step 3: Instancing Output (Non-merged meshes)
- [ ] Define an output representation for **instances**:
  - [ ] `{ builder: "Tree", transform: {pos, rot, scale}, overrides }`
- [ ] Dashboard support: render instances without merging into one mesh
- [ ] Rationale: required for large scenes (memory/perf) and scattering

#### Step 4: Chunk / Query Contract (Design-first)
- [ ] Define a minimal *query-based* contract (no full streaming implementation yet):
  - [ ] `world.sampleHeight x=<x> z=<z> seed=<seed>`
  - [ ] `world.instances bounds=<...> seed=<seed> lod=<n>`
- [ ] Document boundary consistency patterns (padding/border overlap)

#### Step 5: Demo Builder (WorldSlice)
- [ ] Create `WorldSlice.yaml` demo:
  - [ ] uses field(noise) as terrain height
  - [ ] uses poisson scatter for trees/rocks
  - [ ] returns instances

**Exit Criteria**:
- Deterministic results by coordinate (same worldSeed + coords → same outputs)
- Can scatter thousands of instances without merging meshes
- A clear contract exists for eventual chunk streaming + LOD

---

### P2-M3: 2D Shapes & Extrusion ⬜
**Required for**: Gears, signs, moldings, patterns
**Status**: ⬜ Not Started

#### Step 1: 2D Shape Primitives
- [ ] Add `shape2d:` YAML construct
- [ ] Support: rect, circle, polygon (point list), ellipse
- [ ] Store as array of 2D points (closed loop)
- [ ] DSL command: `geometry.shape2d`

#### Step 2: 2D Extrusion
- [ ] Add `extrude2d:` YAML geometry command
- [ ] Parameters: shape reference, depth, cap options
- [ ] Generate proper normals for extruded faces
- [ ] Test: Simple sign backplate

#### Step 3: Bevel & Chamfer
- [ ] Add bevel option to extrude: `bevel: { size: 0.02, segments: 2 }`
- [ ] Chamfer as bevel with segments=1
- [ ] Test: Sign with beveled edges

#### Step 4: Radial Array
- [ ] Add `radialArray:` YAML construct
- [ ] Parameters: element, count, center, axis, radius
- [ ] Test builder: Gear.yaml (tooth shape × count)

#### Step 5: Combined Test - Gear Builder
- [ ] 2D tooth profile
- [ ] Radial array around center
- [ ] Extrude to 3D
- [ ] Add center bore (prepare for boolean)

**Exit Criteria**:
- 2D shapes extrude to 3D with proper normals
- Bevel creates smooth edge transitions
- Radial array creates gear-like patterns
- Gear.yaml works in dashboard

---

### P2-M4: Text & Advanced 2D ⬜
**Required for**: Signage, labels, engravings
**Status**: ⬜ Not Started

#### Step 1: Font Integration
- [ ] Integrate opentype.js for font parsing
- [ ] Bundle 1-2 default fonts (sans, serif)
- [ ] DSL command: `text.outline` - get glyph outlines

#### Step 2: Text to 2D Path
- [ ] Add `text:` YAML construct
- [ ] Parameters: content, font, size
- [ ] Convert glyphs to 2D shape (with holes for O, A, etc.)

#### Step 3: 2D Boolean Operations
- [ ] Implement 2D polygon boolean (union, subtract, intersect)
- [ ] Use for text holes (letter A has inner triangle)
- [ ] Use for complex profiles

#### Step 4: Text Extrusion
- [ ] Extrude text shapes to 3D
- [ ] Handle multi-component glyphs (holes)
- [ ] Test: "HELLO" sign

#### Step 5: Combined Test - Wall Sign Builder
- [ ] Background plate (2D extrude with bevel)
- [ ] Text content (text → extrude, positioned on plate)
- [ ] Material decisions (wood sign vs metal sign)

**Exit Criteria**:
- Text renders as 2D outline correctly
- Multi-component letters (A, O, R) have proper holes
- WallSign.yaml works in dashboard

---

### P2-M5: 3D Boolean CSG ⬜
**Required for**: Architecture (windows), mechanical (assemblies)
**Status**: ⬜ Not Started

#### Step 1: CSG Library Integration
- [ ] Evaluate: csg.js port vs custom implementation
- [ ] Implement mesh → CSG solid conversion
- [ ] Implement CSG solid → mesh conversion

#### Step 2: Boolean Operations
- [ ] Implement union (combine two meshes)
- [ ] Implement subtract (cut one from another)
- [ ] Implement intersect (keep overlap only)

#### Step 3: DSL Integration
- [ ] Add `boolean:` YAML construct
- [ ] Parameters: operation, meshA, meshB
- [ ] Handle result as new named mesh

#### Step 4: Edge Cases
- [ ] Handle coincident faces
- [ ] Handle non-manifold results
- [ ] Add mesh cleanup/repair step

#### Step 5: Architecture Tests
- [ ] SimpleRoom.yaml with window opening (box - box)
- [ ] Door.yaml with panel details
- [ ] Window.yaml with frame and panes

**Exit Criteria**:
- Boolean operations produce clean meshes
- Can cut rectangular holes in walls
- SimpleRoom.yaml, Door.yaml work in dashboard

---

### P2-M6: Botanical Systems ⬜
**Required for**: Trees, plants, organic branching
**Status**: ⬜ Not Started

#### Step 1: L-System Grammar
- [ ] Implement L-system string rewriting
- [ ] Support: F (forward), + - (turn), [ ] (push/pop), custom symbols
- [ ] Define grammar in YAML

#### Step 2: Turtle Interpretation
- [ ] Convert L-system string to 3D points/segments
- [ ] Track position, direction, branch stack
- [ ] Output: list of branch segments with positions/radii

#### Step 3: Branch Geometry
- [ ] Convert segments to swept cylinders (using sweep from P2-M1b)
- [ ] Taper radius along branches
- [ ] Generate bark material regions

#### Step 4: Foliage
- [ ] Leaf placement at branch tips
- [ ] Simple leaf geometry (quad or shaped)
- [ ] Instance leaves for performance

#### Step 5: Tree Builder
- [ ] SimpleTree.yaml with species decision
- [ ] Season decision (full, autumn colors, bare)
- [ ] Age/size variation

**Exit Criteria**:
- L-system produces branching structures
- Trees look organic with natural randomness
- SimpleTree.yaml works with multiple species

---

### P2-M7: Advanced Materials ⬜ (Moved from P2-M1 Steps 4-6)
**Required for**: Realistic surfaces across all builders
**Status**: ⬜ Not Started - Deferred until geometry tools mature

#### Step 1: Layer Stack System
- [ ] Define layer structure (base + overlays)
- [ ] Implement mask types (AO, curvature, noise)
- [ ] Implement blend modes (multiply, overlay, add)

#### Step 2: Smart Materials
- [ ] Worn wood preset (edge wear from curvature map)
- [ ] Dirty/aged preset (dirt from AO map)
- [ ] Metal presets (clean, rusted, brushed)

#### Step 3: Procedural Textures
- [ ] Noise functions (perlin, simplex, worley)
- [ ] Pattern generators (wood grain, marble)
- [ ] Integrate with layer masks

#### Step 4: PBR Output
- [ ] Generate albedo, roughness, metalness, normal maps
- [ ] Export as texture files or embedded
- [ ] Standard PBR material format

#### Step 5: Material Editor UI
- [ ] Preview panel in dashboard
- [ ] Layer stack visualization
- [ ] Real-time parameter adjustment

**Exit Criteria**:
- Smart materials create realistic wear/aging
- PBR textures export correctly
- Material editor allows visual tweaking

---

### P2-M8: Cloth & Soft Bodies ⬜
**Required for**: Clothing, curtains, tablecloths
**Status**: ⬜ Not Started

#### Step 1: Static Drape Approximation
- [ ] Simple gravity-based vertex displacement
- [ ] Collision with simplified body/object mesh
- [ ] No physics simulation (too complex)

#### Step 2: 2D Pattern Definition
- [ ] Define flat pattern pieces in YAML
- [ ] Mark seam edges (which edges connect)
- [ ] Pattern library for common garments

#### Step 3: Pattern to 3D
- [ ] Place patterns on body reference
- [ ] Stitch seam edges together
- [ ] Apply static drape deformation

#### Step 4: Garment Builders
- [ ] TShirt.yaml (simple tube + sleeves)
- [ ] Pants.yaml (two tubes + waist)
- [ ] Hat.yaml (may use subdivision instead)

**Exit Criteria**:
- Clothing sits on body mesh plausibly
- Seams are visible but not gaping
- TShirt, Pants work in dashboard

---

### P2-M9: Characters (Capstone) ⬜
**Required for**: Human and animal figures
**Status**: ⬜ Not Started - Uses all previous milestones

#### Step 1: PersonBuilder Polish
- [ ] Integrate anatomy proportions with subdivision
- [ ] Head with basic facial features
- [ ] Hands with fingers (or simplified mittens)
- [ ] Proper edge loop topology at joints

#### Step 2: Body Variations
- [ ] Body type decisions (slim, average, muscular, heavy)
- [ ] Height variation
- [ ] Gender expression options
- [ ] Age indicators

#### Step 3: Clothing Integration
- [ ] Apply TShirt, Pants from P2-M7
- [ ] Clothing adapts to body size
- [ ] Layer properly (shirt under jacket)

#### Step 4: Materials & Finishing
- [ ] Skin material
- [ ] Clothing materials with decisions
- [ ] Full baked maps

#### Step 5: Stylized Characters
- [ ] Simplified proportions (chibi, cartoon)
- [ ] Exaggerated features
- [ ] Consistent style options

#### Step 6: Animal Builder
- [ ] Quadruped body plan
- [ ] Species variations (dog, cat, horse)
- [ ] Fur/skin material hints

**Exit Criteria**:
- Person looks professional quality
- Clothing fits and drapes properly
- Animal species are recognizable
- No uncanny valley effect

---

### P2-M10: Renderer Package ⬜
**Required for**: Deployment in games/apps
**Status**: ⬜ Not Started

#### Step 1: Package Split
- [ ] Extract `@procedurable/core` (math, geometry primitives)
- [ ] Extract `@procedurable/renderer` (mesh display only)
- [ ] Keep `@procedurable/authoring` separate

#### Step 2: Minimal Bundle
- [ ] Tree-shake unused code
- [ ] Target ~50KB for renderer
- [ ] No MCP/authoring dependencies

#### Step 3: Builder Loading
- [ ] Load YAML builders from URL/CDN
- [ ] Cache compiled builders
- [ ] Lazy load on demand

#### Step 4: Export Formats
- [ ] glTF export (meshes + materials)
- [ ] OBJ export (meshes only)
- [ ] JSON scene format

#### Step 5: Integration Examples
- [ ] React component wrapper
- [ ] Three.js integration
- [ ] Babylon.js integration

**Exit Criteria**:
- Renderer works standalone
- Bundle size under 100KB
- glTF export produces valid files
- Example integrations documented

---

# PHASE 3: Animation & Physics (Future)

> Goal: Enable rigged characters, keyframe animation, and physics-based procedural animation.
> Depends on Phase 2 foundation work.

## Phase 3 Prerequisites (MUST be done in Phase 2)

These foundation items must be implemented in Phase 2, even if the features aren't used yet:

1. **Extended Vertex class** - Add optional fields:
   - `normal?: Vec3`
   - `uv?: Vec2`, `uv2?: Vec2`
   - `boneIndices?: number[4]`, `boneWeights?: number[4]`
   - `tangent?: Vec4`

2. **Mesh.morphTargets** - `Map<string, Vec3[]>` for blend shapes
   - Used by Characters (P2-M9) for ethnicity/body type interpolation
   - glTF morph target compatible

3. **Mesh.skeleton** - Reference to bone hierarchy (null until Phase 3)

4. **Material.density** - For future mass calculation

5. **Volume calculation** - For closed meshes (stability checks now, physics later)

6. **glTF-compatible structures** - All internal data maps cleanly to export

## Phase 3 Milestones (not yet planned in detail)

| Milestone | Description | Dependencies |
|-----------|-------------|--------------|
| P3-M1 | Rigging (skeleton definition, weights, LBS skinning) | Extended Vertex, P2-M9 Characters |
| P3-M2 | Animation (keyframes, clips, interpolation curves) | P3-M1 Rigging |
| P3-M3 | Physics Integration (rapier.js, rigid body, bake to keyframes) | P3-M2 Animation |
| P3-M4 | Procedural Animation (walk cycles, ragdoll, secondary motion) | P3-M3 Physics |

**Note:** Physics will likely use an external library (rapier.js recommended).
We bake physics to keyframes rather than real-time simulation.

---

## Rules

1. **Follow the plan** - Don't add features not in the current milestone
2. **Fix bugs immediately** - But don't pivot the entire architecture
3. **Document decisions** - Update this file when plans change
4. **One milestone at a time** - Finish before starting the next
5. **Exit criteria matter** - Milestone isn't done until criteria are met
6. **Expose before building** - DSL-expose built tools before writing new ones
7. **Domain-driven tools** - Build tools by implementing real builders
8. **PersonBuilder is capstone** - It comes last, uses everything
9. **All DSL commands require integration tests** - No shipping untested commands
10. **Phase 3 foundation in Phase 2** - Design structures for future rigging/animation/physics

---

## Summary: Milestone Order

| # | Milestone | Status | Domains Unlocked |
|---|-----------|--------|------------------|
| P2-M1 | Procedural Materials (Steps 1-3) | ✅ COMPLETE | All (enhanced) |
| P2-M1b | Expose Built Tools | 🟡 IN PROGRESS | Vessels, Pipes, Organic |
| P2-M2 | Scene Constraints & Packing | ✅ COMPLETE | DiningScene Quality |
| **P2-M2b** | **Authoring Infrastructure** | 🟡 **Steps 1-2, Noise Done** | **Conditional/Iterative/Noise** |
| **P2-M2c** | **World Foundations** | ⬜ **Not Started** | **Natural Scenes, Large Worlds** |
| **P2-M2d** | **Agent Authoring Layer** | ⬜ **Not Started** | **Enables agent-driven content creation and validation.** |
| P2-M3 | 2D Shapes & Extrusion | ⬜ | Mechanical, Signage |
| P2-M4 | Text & Advanced 2D | ⬜ | Full Signage |
| P2-M5 | 3D Boolean CSG + Mesh Repair | ⬜ | Architecture |
| P2-M6 | Botanical Systems | ⬜ | Trees, Plants |
| P2-M7 | Advanced Materials | ⬜ | All (polished) |
| P2-M8 | Cloth & Soft Bodies | ⬜ | Clothing |
| P2-M9 | Characters (Capstone) | ⬜ | People, Animals |
| P2-M10 | Renderer Package | ⬜ | Deployment |
| --- | --- | --- | --- |
| P3-M1 | Rigging | ⬜ Future | Posed Characters |
| P3-M2 | Animation | ⬜ Future | Animated Characters |
| P3-M3 | Physics Integration | ⬜ Future | Dynamics |
| P3-M4 | Procedural Animation | ⬜ Future | Walk Cycles, Ragdoll |

**Phase 2: 26 target builders, 11 milestones, ~16 tool categories**
**Phase 3: 4 milestones (rigging, animation, physics, procedural animation)**

**New Builders Created in P2-M1b:**
- Vase.yaml (lathe) - 192 vertices
- Mug.yaml (lathe + sweep) - 248 vertices  
- Cushion.yaml (subdivision) - 98 vertices

---

## Session Log

### 2026-01-13
- Reviewed vision.md and ROADMAP.md
- Created Master Plan with two phases
- Phase 1: Infrastructure (MCP + Authoring) → v1.0.0 RC
- Phase 2: Toolkit Expansion (domain-driven)
- PersonBuilder frozen as capstone for Phase 2
- Created DOMAIN_BUILDERS.md for coverage matrix
- **M4 COMPLETE:**
  - DiningScene builder created (table + chairs)
  - Command console widget added to dashboard
  - COMPOSITION_API.md documentation created

### 2026-01-14
- **Phase 2 Restructured based on Alignment Analysis:**
  - Created PROBLEM_DOMAIN.md (25 target builders, 8 domains)
  - Created SOLUTION_DOMAIN.md (tool inventory, build status)
  - Created ALIGNMENT_MATRIX.md (optimal ordering)
- **Key insight:** 4 tools already built but not DSL-exposed (Lathe, Sweep, Spline, Subdivision)
- **Added P2-M1b:** Expose Built Tools (high value, low effort)
- **Deferred Materials Steps 4-6** to P2-M6 (nice-to-have)
- **Reordered milestones** for optimal domain unlock sequence
- **P2-M1b Progress:**
  - Step 1: Spline & Profile DSL ✅ COMPLETE
  - Step 2: Lathe DSL ✅ COMPLETE - Vase.yaml works (192 vertices, 168 faces)
  - Step 3: Sweep DSL ✅ COMPLETE - Mug.yaml works (248 vertices, 218 faces)
  - Step 4: Subdivision DSL ✅ COMPLETE - Cushion.yaml works (98 vertices, 96 faces)
  - Updated DSL_COMMANDS.md with new YAML geometry commands
  - All tools now exposed: Loft ✅, Lathe ✅, Sweep ✅, Spline ✅, Subdivision ✅
- **Added Phase 3 section:** Rigging, Animation, Physics (future)
- **Added Phase 2 Foundation for Phase 3:** Extended Vertex, morphTargets, skeleton
- **P2-M2 Implementation Started:**
  - Created `src/core/AABB.ts` - Axis-aligned bounding box with overlap/distance checks
  - Created `src/builder/Placement.ts` - Constraint-based placement system
  - Added `Mesh.getAABB()` method
  - Added `YamlPlacement` interface and `placement:` YAML section
  - Created `DiningSceneV2.yaml` using new placement system
  - Placement supports: around_rectangle, around_circle modes
  - Collision avoidance with minDistance parameter
- **P2-M2 COMPLETE:**
  - Fixed spacing calculation in Placement.ts (centered candidates per side)
  - Fixed ESM imports (replaced require() with ES imports)
  - Replaced old DiningScene.yaml with placement-based version
  - Tested seeds 1-50: no overlaps, correct orientation
  - `allowReducedCount` works correctly when space is insufficient
- **Authoring Domain Analysis:**
  - Created `AUTHORING_PROBLEM_DOMAIN.md` - Builder authoring challenges
  - Created `AUTHORING_SOLUTION_DOMAIN.md` - Authoring infrastructure inventory
  - Created `AUTHORING_ALIGNMENT_MATRIX.md` - Feature prioritization
  - Added P2-M2b milestone for authoring infrastructure improvements
  - Identified critical gaps: conditional composition, iterative composition, error context
- **Expanded Vision - Scale & Algorithms:**
  - Created `PROCEDURAL_TECHNIQUES.md` - Catalog of PCG algorithms:
    - Noise (Perlin, FBM), Voronoi, Poisson disk, L-Systems, WFC, Cellular automata
    - Space partitioning (chunks, quadtrees, BSP)
    - Streaming/infinite generation patterns
    - Level generation (mission graphs, inside-out)
  - Created `SCALE_AMBITION.md` - Architecture for large-scale generation:
    - What it takes to build a Doom level generator
    - What it takes to build an infinite world
    - Inside-out generation (characters first, then architecture)
    - Chunk-based streaming, lazy evaluation, LOD
  - Updated AUTHORING_SOLUTION_DOMAIN.md with new categories:
    - Category 9: Noise & Pattern Generation
    - Category 10: Scale & Streaming
    - Category 11: Layout & Level Generation
  - Updated DOMAIN_BUILDERS.md coverage matrix
- **Key Insight:** We need noise functions and coordinate-based seeding
  as foundational infrastructure before tackling larger scenes
- **P2-M2b Step 1 Implemented:**
  - Added `if:` field to YamlComposition interface
  - Implemented `evaluateCompositionCondition()` function
  - Supports: `$decision_name`, comparisons (`>`, `<`, `>=`, `<=`), equality (`==`, `!=`)
  - Added `box:` geometry command for convenient box creation
  - Updated builderResolver to dynamically load all YAML builders
  - Tested with ConditionalTest builder - works correctly!
- **P2-M2b Step 2 Implemented:**
  - Added `repeat:` field to YamlComposition interface
  - Refactored composition processing into `composeInstance()` helper
  - Repeat creates instances with names like `leg_0`, `leg_1`, etc.
  - Index variable available in expressions for offsets
- **P2-M2b Noise Infrastructure:**
  - Added Perlin noise (2D, 3D) to MathService
  - Added FBM (fractal brownian motion) for layered noise
  - Added coordinateHash for deterministic coordinate-based seeding
  - Added DSL commands: `math.noise`, `math.fbm`, `math.hash`
- **Next:** P2-M2c (World Foundations) or P2-M2d (Agent Authoring)

---
## M6: The Agent-Authoring Layer (NEW)

> **Goal:** Enable an AI agent to autonomously discover, utilize, and validate the procedural capabilities of the system. This is the bridge between having a toolbox and having a virtual artist.

This milestone focuses on the "meta" capabilities that allow an agent to reason about and interact with the builder ecosystem.

### Key Features

#### 1. **System Introspection and Discoverability**
- **`system.list_builders()`**: Agent can see all available builders (`DiningChair`, `Table`, etc.).
- **`builder.get_interface('DiningChair')`**: Agent can query a builder's "API," learning its parameters, decision points, and variation axes (e.g., `style: [modern, rustic]`, `seat_height: range(0.4, 0.6)`).
- **`system.list_tools()`**: Agent can see available low-level geometry commands (`loft`, `extrude`, `bevel`).

#### 2. **Semantic Scene Graph and Querying**
- **Problem**: An agent needs to understand the scene functionally, not just as a list of meshes.
- **Solution**: Introduce a semantic layer. Instead of just a mesh, a builder's output is a tree of named, tagged parts.
  - `DiningChair` -> `[ { part: 'leg', tag: 'structure' }, { part: 'seat', tag: 'surface' } ]`
- **`scene.query_by_tag('surface')`**: Agent can find all seating surfaces to check for clearance.
- **`scene.query_by_part('leg')`**: Agent can find all legs to apply a material change.

#### 3. **Builder Validation and Feedback**
- **Problem**: How does an agent know if it's doing a good job?
- **Solution**: A robust, queryable validation system.
- **`builder.validate()`**: Runs a suite of checks.
- **`validation.get_results()`**: Returns structured feedback the agent can parse:
  - `[{ check: 'stability', status: 'fail', reason: 'Center of mass is outside support polygon.' }]`
  - `[{ check: 'ergonomics', status: 'pass', metric: 'seat_height', value: 0.45 }]`
  - `[{ check: 'aesthetics', status: 'warning', reason: 'Color contrast ratio is low.' }]` (Future goal)

#### 4. **Explicit Goal-Seeking Primitives**
- **Problem**: An agent shouldn't have to manually position everything.
- **Solution**: High-level commands that encode artistic intent.
- **`scene.place_around('Table-1', 'DiningChair', { count: 4, spacing: 0.5 })`**: A constraint-based command that the system solves.
- **`scene.add_clutter('Table-1:surface', 'Mug', { density: 0.3 })`**: Scatters objects on a tagged surface, avoiding collisions.

---
