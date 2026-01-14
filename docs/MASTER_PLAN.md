# Master Plan - Procedurable

> This document is the source of truth for what we're building and in what order.
> We follow this plan. We don't freestyle. We only deviate for serious blockers.

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

### P2-M2: Scene Constraints & Packing ⬜
**Required for**: DiningScene quality (no overlaps), set dressing, environments
**Status**: ⬜ Not Started

> Rationale: This is the single fastest path to believable scenes and fixes the recurring
> "chairs overlap / orientation wrong" class of issues. It also becomes the foundation
> for clutter placement and later environment builders.

#### Step 1: Spatial Primitives
- [ ] AABB bounds for meshes and sub-meshes (per composed sub-builder)
- [ ] Distance checks (AABB overlap, min distance)
- [ ] Simple ray cast against planes (for "rest this prop on table")

#### Step 2: Packing / Placement API
- [ ] Add a reusable placement helper (library, not builder-specific)
- [ ] Inputs: candidates (transforms), minDistance, attempts, seed
- [ ] Output: chosen transforms that satisfy constraints

#### Step 3: DiningScene Fixes (Acceptance Test)
- [ ] Ensure chairs never overlap (min distance based on chair width)
- [ ] Ensure chairs face the table center (round & rectangular cases)
- [ ] Ensure number of chairs respects available space (reduce chair count when needed)

#### Step 4: Debug/Inspection
- [ ] Add traces for placement decisions (why a chair was rejected)
- [ ] Optional: expose a `measurement` for min chair spacing for debugging

**Exit Criteria**:
- DiningScene seeds 1-50: no chair overlaps, chairs oriented correctly
- Placement logic is reusable for future clutter/environment builders

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

## Rules

1. **Follow the plan** - Don't add features not in the current milestone
2. **Fix bugs immediately** - But don't pivot the entire architecture
3. **Document decisions** - Update this file when plans change
4. **One milestone at a time** - Finish before starting the next
5. **Exit criteria matter** - Milestone isn't done until criteria are met
6. **Expose before building** - DSL-expose built tools before writing new ones
7. **Domain-driven tools** - Build tools by implementing real builders
8. **PersonBuilder is capstone** - It comes last, uses everything

---

## Summary: Milestone Order

| # | Milestone | Status | Domains Unlocked |
|---|-----------|--------|------------------|
| P2-M1 | Procedural Materials (Steps 1-3) | ✅ COMPLETE | All (enhanced) |
| **P2-M1b** | **Expose Built Tools** | 🟡 **Steps 1-4 Done** | **Vessels, Pipes, Organic** |
| P2-M2 | Scene Constraints & Packing | ⬜ | DiningScene Quality |
| P2-M3 | 2D Shapes & Extrusion | ⬜ | Mechanical, Signage |
| P2-M4 | Text & Advanced 2D | ⬜ | Full Signage |
| P2-M5 | 3D Boolean CSG | ⬜ | Architecture |
| P2-M6 | Botanical Systems | ⬜ | Trees, Plants |
| P2-M7 | Advanced Materials | ⬜ | All (polished) |
| P2-M8 | Cloth & Soft Bodies | ⬜ | Clothing |
| P2-M9 | Characters (Capstone) | ⬜ | People, Animals |
| P2-M10 | Renderer Package | ⬜ | Deployment |

**Total: 25 target builders, 10 milestones, ~12 tool categories**

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
- **Next: P2-M1b Step 5** - Integration tests & cleanup

