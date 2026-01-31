# Procedurable Backlog

> **Version:** 2.0 (2026-01-31 revision)
> **Purpose:** Tactical work items for AI coding agents and human developers.
> **Strategy:** See `MASTER_PLAN.md` for vision and track definitions.
> **Quality:** See `QUALITY_TIERS.md` for tier definitions and gate criteria.
> **Supersedes:** Previous backlog (archived in git history).

---

## How to Use This Backlog

### For Agents
1. Read `MASTER_PLAN.md` first to understand the tracks and priorities
2. Pick the next unblocked story from the recommended execution order
3. Read acceptance criteria carefully -- they are the definition of done
4. Run quality gates where applicable
5. Mark stories complete only when ALL criteria are met

### Story Format

```
### [ID]: Story Title
**Track:** A/B/C/D  |  **Status:** ⬜/🟡/✅  |  **Size:** XS/S/M/L/XL
**Dependencies:** [story IDs or "None"]

#### Context
Why this work matters.

#### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

#### Files to Modify
- `path/to/file.ts`

#### Notes
Implementation hints.
```

---

## Quick Status

| Track | Milestone | Stories | Done | Status |
|-------|-----------|---------|------|--------|
| A: Quality | A1: Quality Declaration | 3 | 0 | ⬜ Next |
| A: Quality | A2: Quality Gates | 3 | 0 | ⬜ |
| A: Quality | A3: Decision Coverage | 2 | 0 | ⬜ |
| A: Quality | A4: Sophistication Plans | 2 | 0 | ⬜ |
| B: Platform | B1: Foundation Cleanup | 4 | 0 | ⬜ Next |
| B: Platform | B2: Scene Description | 3 | 0 | ⬜ |
| B: Platform | B3: World Metadata | 3 | 0 | ⬜ |
| B: Platform | B4: Builder Authoring via DSL | 3 | 0 | ⬜ |
| C: Geometry | C1: 2D Booleans | 3 | 0 | ⬜ |
| C: Geometry | C2: Bevel & Chamfer | 3 | 0 | ⬜ |
| C: Geometry | C3: Material Slots | 2 | 0 | ⬜ |
| C: Geometry | C4: Basic UV Generation | 2 | 0 | ⬜ |
| C: Geometry | C5: Deformers | 3 | 0 | ⬜ |
| C: Geometry | C6: glTF Export | 2 | 0 | ⬜ |
| D: Demos | D1: DiningChair Tier 2 | 1 | 0 | ⬜ |
| D: Demos | D2: Vase Tier 2 | 1 | 0 | ⬜ |
| D: Demos | D3: Gear Tier 2 | 1 | 0 | ⬜ |
| D: Demos | D4: Furnished Room Tier 2 | 1 | 0 | ⬜ |

---

# TRACK A: QUALITY & STANDARDS

## A1: Quality Declaration

> **Goal:** Add `quality:` section to YAML builder format. Retrofit all existing builders with honest tier assessments. No code changes needed -- this is purely format + content.

### A1-001: Define Quality YAML Schema

**Track:** A | **Status:** ⬜ | **Size:** S
**Dependencies:** None

#### Context
The `quality:` section must be parseable by YamlBuilderParser but doesn't need to affect execution yet. It's metadata that agents and humans read to understand gaps.

#### Acceptance Criteria
- [ ] Define `quality:` YAML schema (target_tier, current_tier, tier_gaps, parts, decision_coverage)
- [ ] Document schema in `YAML_BUILDER_FORMAT.md`
- [ ] YamlBuilderParser accepts `quality:` section without errors (passthrough, not validated)
- [ ] Add one example builder with full `quality:` section as reference

#### Files to Modify
- `docs/YAML_BUILDER_FORMAT.md`
- `src/builder/YamlBuilderParser.ts` (allow quality section passthrough)

---

### A1-002: Retrofit Existing Builders

**Track:** A | **Status:** ⬜ | **Size:** M
**Dependencies:** A1-001

#### Context
Every committed builder needs an honest `quality:` assessment. This forces a review of what each builder actually produces vs what it claims to produce.

#### Acceptance Criteria
- [ ] All builders in `builders/` have `quality:` section
- [ ] Each builder has `target_tier`, `current_tier`, `tier_gaps` (if gap exists)
- [ ] Each builder has per-part tier assessment
- [ ] Decision coverage documented: which decisions change output, which are decorative
- [ ] At least 3 builders identify specific upgrade paths to next tier

#### Files to Modify
- All files in `builders/*.yaml`

#### Notes
Be brutally honest. If DiningChair's back is a floating quad, `current_tier: 1` and the gap says so. If a decision doesn't change geometry, document it as decorative.

---

### A1-003: Quality Tier Reference Builders

**Track:** A | **Status:** ⬜ | **Size:** M
**Dependencies:** A1-001

#### Context
Create reference builders that exemplify each tier so agents and humans have concrete targets to compare against.

#### Acceptance Criteria
- [ ] Create `builders/examples/ChairTier0.yaml` -- bounding volumes only
- [ ] Create `builders/examples/ChairTier1.yaml` -- silhouette correct (current DiningChair level)
- [ ] Create `builders/examples/ChairTier2.yaml` -- form-resolved (proper back variants, thickness, multi-material)
- [ ] Each reference builder has `quality:` section documenting why it's that tier
- [ ] Reference builders linked from `QUALITY_TIERS.md`

#### Notes
Tier 2 reference may require C2 (bevel) to be fully complete. If so, build as much as possible with current tools and document what's blocked.

---

## A2: Quality Gates

> **Goal:** Automated quality checks in ValidationAPI that verify builders meet their declared tier.

### A2-001: Tier 1 Gate Implementation

**Track:** A | **Status:** ⬜ | **Size:** M
**Dependencies:** A1-001

#### Context
Tier 1 gates are basic checks that every builder should pass: parts exist, proportions are reasonable, output varies with seed.

#### Acceptance Criteria
- [ ] `evaluateQualityTier()` function in ValidationAPI
- [ ] Tier 1 checks: all declared parts produce geometry, bounding box within expected range, no degenerate faces > 10%
- [ ] Returns structured `QualityGateResult` (tier, gates_passed, gates_failed, suggestions)
- [ ] DSL command `builder.quality <name>` returns gate results
- [ ] At least 3 existing builders pass Tier 1 gates
- [ ] Integration test for quality gate system

#### Files to Modify
- `src/validation/ValidationAPI.ts`
- `src/authoring/commands/builder.ts` (add quality command)
- `src/tests/mcp-integration.test.ts`

---

### A2-002: Tier 2 Gate Implementation

**Track:** A | **Status:** ⬜ | **Size:** L
**Dependencies:** A2-001

#### Context
Tier 2 gates enforce form quality: no single-face parts, multiple materials, closed meshes, decision coverage.

#### Acceptance Criteria
- [ ] Tier 2 checks: min 6 faces per named part, >= 2 distinct materials, >= 80% closed meshes, >= 90% decisions affect output
- [ ] Gate checks run incrementally (Tier 1 must pass before Tier 2 is evaluated)
- [ ] Suggestions are specific and actionable ("back part has 1 face, needs >= 6 for Tier 2")
- [ ] Integration test with a builder that fails Tier 2 (to verify failure output)

#### Files to Modify
- `src/validation/ValidationAPI.ts`

---

### A2-003: Quality Gate in Builder Execution

**Track:** A | **Status:** ⬜ | **Size:** S
**Dependencies:** A2-001

#### Context
Quality gates should run automatically when a builder executes and appear in trace output, so agents encounter them without explicitly requesting them.

#### Acceptance Criteria
- [ ] Quality gate results included in TracedOutput when `quality:` section is present
- [ ] Dashboard shows quality tier badge (T0/T1/T2) next to builder name
- [ ] Gate failures appear in trace output as warnings (not errors -- don't block execution)
- [ ] Builder.run DSL command includes quality summary in response

#### Files to Modify
- `src/builder/TracedBuilder.ts`
- `src/dashboard/main.ts`

---

## A3: Decision Coverage

> **Goal:** Verify that every declared decision actually produces different output.

### A3-001: Decision Coverage Testing

**Track:** A | **Status:** ⬜ | **Size:** L
**Dependencies:** A2-001

#### Context
The biggest quality problem: decisions that don't do anything. Run builder with each option forced, diff the outputs.

#### Acceptance Criteria
- [ ] `testDecisionCoverage(builderName)` function that runs builder with each decision option forced
- [ ] Compares mesh vertex/face counts between options (different count = covered)
- [ ] Returns per-decision coverage report (covered/uncovered/partial)
- [ ] DSL command `builder.coverage <name>` returns coverage report
- [ ] Integration test demonstrating covered and uncovered decisions

#### Files to Modify
- `src/validation/ValidationAPI.ts`
- `src/authoring/commands/builder.ts`
- `src/tests/mcp-integration.test.ts`

---

### A3-002: Coverage Enforcement

**Track:** A | **Status:** ⬜ | **Size:** S
**Dependencies:** A3-001

#### Context
Wire coverage results into quality gates so uncovered decisions are flagged.

#### Acceptance Criteria
- [ ] Tier 2 gate includes decision coverage check (>= 90% covered)
- [ ] Uncovered decisions listed in quality gate suggestions
- [ ] `quality.decision_coverage` section in YAML documents expected behavior per option

#### Files to Modify
- `src/validation/ValidationAPI.ts`

---

## A4: Sophistication Plans

> **Goal:** First-class format for planning what a builder should achieve at each tier.

### A4-001: Sophistication Plan Schema

**Track:** A | **Status:** ⬜ | **Size:** S
**Dependencies:** A1-001

#### Context
Before writing geometry, agents should produce a plan describing each tier's parts, tools, and decisions. This format makes the plan structured and verifiable.

#### Acceptance Criteria
- [ ] Define YAML schema for sophistication plans (per-tier: parts, tools_needed, decisions, upgrades)
- [ ] Document in `QUALITY_TIERS.md`
- [ ] Create example plan for DiningChair
- [ ] Create example plan for Vase

#### Files to Modify
- `docs/QUALITY_TIERS.md`

---

### A4-002: Plan-to-Gate Comparison

**Track:** A | **Status:** ⬜ | **Size:** M
**Dependencies:** A4-001, A2-002

#### Context
Compare builder output against its sophistication plan to verify the plan was followed.

#### Acceptance Criteria
- [ ] Function that loads sophistication plan and compares against builder output
- [ ] Checks: planned parts exist, planned decisions are covered, planned tools are used
- [ ] DSL command `builder.check_plan <name>` returns comparison
- [ ] Integration test

#### Files to Modify
- `src/validation/ValidationAPI.ts`
- `src/authoring/commands/builder.ts`

---

# TRACK B: PLATFORM COMPONENTS

## B1: Foundation Cleanup

> **Goal:** Resolve known gaps and inconsistencies before building new platform features.

### B1-001: Architecture & Flow Consolidation

**Track:** B | **Status:** ⬜ | **Size:** M
**Dependencies:** None

#### Context
The old P2-M3b was never started. Service ownership is unclear: which module owns profiles? Which owns expressions? This needs resolution before adding more services.

#### Acceptance Criteria
- [ ] System flow diagram showing data flow from YAML → parse → build → output
- [ ] Service inventory: each .ts file has documented ownership (what it does, what depends on it)
- [ ] Identify and document any duplicated functionality
- [ ] Create consolidation plan for overlapping code (don't execute yet, just plan)

#### Files to Modify
- `docs/SYSTEM_FLOW.md` (update)
- `docs/ARCHITECTURE.md` (update)

---

### B1-002: Fix Text Glyph Holes

**Track:** B | **Status:** ⬜ | **Size:** M
**Dependencies:** None

#### Context
Text-to-shape only uses outer contours. Letters A, O, P, R, etc. don't have their holes subtracted. This blocks the signage domain.

#### Acceptance Criteria
- [ ] TextToShape correctly identifies outer vs inner contours
- [ ] Inner contours subtracted from outer contours in extruded text
- [ ] Letters A, B, D, O, P, Q, R render correctly with holes
- [ ] Test with at least 2 fonts
- [ ] Integration test

#### Files to Modify
- `src/text/TextToShape.ts`
- `src/tests/__tests__/TextToShape.test.ts`

#### Notes
This likely requires 2D boolean subtraction of contours. May share implementation with C1 (2D Booleans) -- consider building C1 first or extracting a shared 2D polygon clip operation.

---

### B1-003: Complete Goal-Seeking Primitives (M2d-007)

**Track:** B | **Status:** ⬜ | **Size:** M
**Dependencies:** None

#### Context
Last unfinished story from the agent authoring layer. Goal-seeking commands like "place N chairs around table" that agents can use instead of manual coordinate math.

#### Acceptance Criteria
- [ ] `scene.place_around` command: place N objects in ring around center point
- [ ] `scene.place_along` command: place objects along a line/path with spacing
- [ ] `scene.fill_area` command: scatter-fill an area with objects at density
- [ ] Each command returns placed positions for further composition
- [ ] Integration tests for each command

#### Files to Modify
- `src/authoring/commands/scene.ts`
- `src/tests/mcp-integration.test.ts`

---

### B1-004: Gear Builder Demo Completion

**Track:** B | **Status:** ⬜ | **Size:** S
**Dependencies:** None (or C1 if tooth profile needs 2D booleans)

#### Context
The Gear builder demo from the old M3 was started but never finished. Complete it with current tools or document what's blocked.

#### Acceptance Criteria
- [ ] `builders/Gear.yaml` produces a recognizable gear shape
- [ ] Decisions: tooth count, module (size), bore diameter
- [ ] Quality section declares tier and gaps
- [ ] If blocked by missing 2D booleans, document the block and create simplified version

#### Files to Modify
- `builders/Gear.yaml`

---

## B2: Scene Description Format (PSD)

> **Goal:** Define a serializable scene graph format that builders output and tools consume.

### B2-001: PSD v0.1 Schema Definition

**Track:** B | **Status:** ⬜ | **Size:** M
**Dependencies:** B1-001

#### Context
The Procedurable Scene Description format is the intermediate representation between builders and consumers (renderers, exporters, agents). Inspired by USD but scoped to what we need now.

#### Acceptance Criteria
- [ ] YAML schema for PSD v0.1 covering: scene hierarchy, prims (Mesh, Instance), transforms, tags, bounds, material slots
- [ ] Schema documented in new `docs/PSD_FORMAT.md`
- [ ] TypeScript interfaces for PSD types
- [ ] Skeleton/weight fields stubbed (empty arrays, ready for Phase 3)
- [ ] Example PSD file for DiningScene

#### Files to Modify
- `docs/PSD_FORMAT.md` (new)
- `src/builder/PSD.ts` (new -- type definitions)

---

### B2-002: Builder Output to PSD Serialization

**Track:** B | **Status:** ⬜ | **Size:** L
**Dependencies:** B2-001

#### Context
Builder TracedOutput should be serializable to PSD format. This is the bridge between authoring and consumption.

#### Acceptance Criteria
- [ ] `serializeToPSD(output: TracedOutput): PSDScene` function
- [ ] Mesh geometry serialized with vertices, faces, normals
- [ ] Instances serialized as prototype references + transforms
- [ ] Tags, bounds, material assignments preserved
- [ ] Round-trip test: serialize → deserialize → compare
- [ ] DSL command `builder.export_psd <name>` writes PSD file

#### Files to Modify
- `src/builder/PSD.ts`
- `src/builder/TracedBuilder.ts`
- `src/authoring/commands/builder.ts`

---

### B2-003: PSD Scene Queries

**Track:** B | **Status:** ⬜ | **Size:** M
**Dependencies:** B2-002

#### Context
Agents need to query PSD scenes to reason about builder output: find parts by tag, get bounds, check spatial relationships.

#### Acceptance Criteria
- [ ] `scene.query_by_tag <tag>` returns matching prims from last PSD output
- [ ] `scene.get_bounds <prim_path>` returns AABB for a prim
- [ ] `scene.list_prims` returns hierarchy
- [ ] `scene.get_materials` returns material assignments
- [ ] Integration tests for each query

#### Files to Modify
- `src/authoring/commands/scene.ts`

---

## B3: World Metadata Collector

> **Goal:** Persistent knowledge store where agents accumulate domain knowledge across sessions.

### B3-001: Metadata Store Implementation

**Track:** B | **Status:** ⬜ | **Size:** M
**Dependencies:** None

#### Context
Agents need to record and retrieve knowledge: style palettes, builder relationships, spatial rules, domain standards. This is a structured key-value store with domain schemas, backed by the existing storage system.

#### Acceptance Criteria
- [ ] `MetadataStore` class with get/set/list/delete operations
- [ ] Namespaced keys (e.g., `styles/modern`, `rules/furniture/clearance`)
- [ ] Values are typed YAML documents (not arbitrary blobs)
- [ ] Persistent to filesystem via StorageProvider
- [ ] Unit tests for CRUD operations

#### Files to Modify
- `src/storage/MetadataStore.ts` (new)
- `src/storage/index.ts`

---

### B3-002: Metadata DSL Commands

**Track:** B | **Status:** ⬜ | **Size:** S
**Dependencies:** B3-001

#### Context
Expose metadata store through DSL so agents can use it during authoring sessions.

#### Acceptance Criteria
- [ ] `metadata.set <key> <value>` stores a metadata entry
- [ ] `metadata.get <key>` retrieves a metadata entry
- [ ] `metadata.list [prefix]` lists keys, optionally filtered by prefix
- [ ] `metadata.delete <key>` removes an entry
- [ ] Integration tests

#### Files to Modify
- `src/authoring/commands/metadata.ts` (new)
- `src/authoring/command-registry.ts`

---

### B3-003: Pre-Built Domain Knowledge

**Track:** B | **Status:** ⬜ | **Size:** M
**Dependencies:** B3-002

#### Context
Seed the metadata store with useful domain knowledge that agents can reference when building.

#### Acceptance Criteria
- [ ] Furniture domain: standard dimensions (chair heights, table widths, clearances)
- [ ] Style palettes: modern, rustic, industrial (colors, materials, proportions)
- [ ] Builder relationships: which builders compose into which scenes
- [ ] Material associations: wood types → colors, metal types → finishes
- [ ] All metadata queryable via DSL

#### Files to Modify
- `metadata/` directory (new, with YAML knowledge files)

---

## B4: Builder Authoring via DSL

> **Goal:** Agents can create new YAML builders through DSL commands, not just file edits.

### B4-001: Builder Template Generation

**Track:** B | **Status:** ⬜ | **Size:** M
**Dependencies:** A1-001

#### Context
An agent should be able to say "create a new builder for a bookshelf" and get a properly structured YAML file with quality section, decision placeholders, and measurement scaffolding.

#### Acceptance Criteria
- [ ] `builder.create <name> --domain <domain>` generates template YAML
- [ ] Template includes: decisions (from domain knowledge), measurements (standard for domain), quality section (target_tier: 2), geometry placeholder
- [ ] Template is valid YAML that parses without errors
- [ ] Domain-specific templates for: furniture, vessel, signage, mechanical
- [ ] Integration test

#### Files to Modify
- `src/authoring/commands/builder.ts`

---

### B4-002: Builder Section Editing

**Track:** B | **Status:** ⬜ | **Size:** L
**Dependencies:** B4-001

#### Context
Agents should be able to add decisions, measurements, and geometry to a builder through DSL commands rather than raw file editing.

#### Acceptance Criteria
- [ ] `builder.add_decision <builder> <name> <type> [options...]` adds a decision
- [ ] `builder.add_measurement <builder> <name> <value>` adds a measurement
- [ ] `builder.add_geometry <builder> <type> <params...>` adds a geometry command
- [ ] Each command modifies the YAML file and triggers hot-reload
- [ ] Validation: refuse to add duplicate names, invalid types
- [ ] Integration tests

#### Files to Modify
- `src/authoring/commands/builder.ts`

---

### B4-003: Sophistication-Guided Creation

**Track:** B | **Status:** ⬜ | **Size:** M
**Dependencies:** B4-001, A4-001

#### Context
When creating a builder, an agent should be guided by a sophistication plan. The creation workflow should reference the plan at each step.

#### Acceptance Criteria
- [ ] `builder.create` accepts `--plan <plan_file>` to load sophistication plan
- [ ] Plan tiers shown in creation output ("Tier 1 requires: seat, legs, back")
- [ ] Generated template includes planned parts as geometry placeholders
- [ ] Quality section pre-filled from plan
- [ ] Integration test

#### Files to Modify
- `src/authoring/commands/builder.ts`

---

# TRACK C: FOUNDATIONAL GEOMETRY TOOLS

## C1: 2D Booleans

> **Goal:** Union, subtract, intersect operations on 2D shapes/polygons.

### C1-001: 2D Polygon Clipping Library

**Track:** C | **Status:** ⬜ | **Size:** L
**Dependencies:** None

#### Context
2D booleans are needed for: glyph holes in text, gear tooth profiles, mechanical parts, architectural floor plans. This is the most-requested missing geometry tool.

#### Acceptance Criteria
- [ ] Implement or port polygon clipping (Greiner-Hormann or Martinez-Rueda algorithm)
- [ ] Operations: union, subtract, intersect
- [ ] Handle: convex and concave polygons, polygons with holes
- [ ] Output: polygon with holes representation (outer boundary + hole boundaries)
- [ ] Unit tests for each operation with edge cases (shared edges, containment, touching)

#### Files to Modify
- `src/geometry/PolygonBoolean.ts` (new)
- `src/tests/__tests__/PolygonBoolean.test.ts` (new)

#### Notes
Consider using Clipper2 (Angus Johnson) concepts. Martinez-Rueda is more robust for complex cases. Keep it 2D only -- 3D CSG is deferred.

---

### C1-002: 2D Boolean DSL Integration

**Track:** C | **Status:** ⬜ | **Size:** M
**Dependencies:** C1-001

#### Context
Expose 2D booleans in YAML builders so profiles can be combined.

#### Acceptance Criteria
- [ ] YAML syntax for 2D boolean operations on profiles
- [ ] `profile_boolean:` command with `operation: union|subtract|intersect`
- [ ] Result usable as input to lathe, extrude, sweep
- [ ] DSL command documentation
- [ ] Integration test

#### Files to Modify
- `src/builder/YamlBuilderParser.ts`
- `docs/DSL_COMMANDS.md`

---

### C1-003: Wire Text Glyph Holes Through 2D Booleans

**Track:** C | **Status:** ⬜ | **Size:** S
**Dependencies:** C1-001, B1-002

#### Context
Once 2D booleans work, use them to subtract inner contours from outer contours in text glyphs. This resolves B1-002 properly.

#### Acceptance Criteria
- [ ] TextToShape uses PolygonBoolean.subtract for glyph holes
- [ ] All tested letters (A, B, D, O, P, Q, R) render correctly
- [ ] Works with extruded text

#### Files to Modify
- `src/text/TextToShape.ts`

---

## C2: Bevel & Chamfer

> **Goal:** Edge treatment operations for hard-surface finish quality.

### C2-001: Edge Selection

**Track:** C | **Status:** ⬜ | **Size:** M
**Dependencies:** None

#### Context
Before beveling, we need to identify which edges to bevel. Artists typically bevel by angle threshold ("bevel all edges sharper than 30 degrees") or by explicit selection.

#### Acceptance Criteria
- [ ] `Mesh.getSharpEdges(angleThreshold)` returns edge list
- [ ] `Mesh.getEdgesByTag(tag)` returns tagged edges (for explicit selection)
- [ ] Edge represented as `[vertexA, vertexB, faceLeft, faceRight]`
- [ ] Unit tests

#### Files to Modify
- `src/geometry/Mesh.ts`
- `src/geometry/MeshOperations.ts`

---

### C2-002: Bevel Operation

**Track:** C | **Status:** ⬜ | **Size:** L
**Dependencies:** C2-001

#### Context
Bevel adds geometry at edges to create smooth light-catching transitions. Essential for any hard-surface asset that doesn't look like a programmer's cube.

#### Acceptance Criteria
- [ ] `MeshOperations.bevel(mesh, edges, width, segments)` returns beveled mesh
- [ ] 1 segment = chamfer (flat cut), 2+ segments = smooth bevel
- [ ] Works on box primitives (most common case)
- [ ] Works on extruded shapes
- [ ] Preserves existing vertex colors/materials
- [ ] Unit tests with vertex/face count validation

#### Files to Modify
- `src/geometry/MeshOperations.ts`

---

### C2-003: Bevel DSL Integration

**Track:** C | **Status:** ⬜ | **Size:** S
**Dependencies:** C2-002

#### Context
Expose bevel in YAML builders.

#### Acceptance Criteria
- [ ] YAML `bevel:` command with `width`, `segments`, `angle_threshold` parameters
- [ ] Applies to preceding geometry command's output
- [ ] DSL command documentation
- [ ] Integration test with a builder that uses bevel

#### Files to Modify
- `src/builder/YamlBuilderParser.ts`
- `docs/DSL_COMMANDS.md`

---

## C3: Material Slots

> **Goal:** Named material regions instead of just vertex colors.

### C3-001: Material Slot System

**Track:** C | **Status:** ⬜ | **Size:** M
**Dependencies:** None

#### Context
Currently materials are vertex colors only. For proper asset output (glTF, PSD), we need named material slots that map face ranges to material definitions.

#### Acceptance Criteria
- [ ] `MaterialSlot` type: name, color, roughness, metalness (PBR-ready)
- [ ] `Mesh.materialSlots: MaterialSlot[]` with per-face slot index
- [ ] YAML `materials:` section defines named slots
- [ ] Geometry commands reference slots by name
- [ ] Backward compatible (vertex colors still work as fallback)
- [ ] Unit tests

#### Files to Modify
- `src/geometry/Mesh.ts`
- `src/builder/MaterialLibrary.ts`
- `src/builder/YamlBuilderParser.ts`

---

### C3-002: Dashboard Material Rendering

**Track:** C | **Status:** ⬜ | **Size:** S
**Dependencies:** C3-001

#### Context
Dashboard should render material slots, not just vertex colors.

#### Acceptance Criteria
- [ ] Dashboard reads material slots from mesh
- [ ] Each slot rendered with its color (PBR properties can be visualized later)
- [ ] Fallback to vertex colors when no slots defined
- [ ] Works with existing builders (no visual regression)

#### Files to Modify
- `src/dashboard/main.ts`

---

## C4: Basic UV Generation

> **Goal:** Automatic UV coordinates for common geometry operations.

### C4-001: Operation-Specific UV Generation

**Track:** C | **Status:** ⬜ | **Size:** L
**Dependencies:** None

#### Context
Lathe, sweep, and extrude have natural UV mappings (parametric). Generate UVs automatically during these operations rather than needing a separate unwrap step.

#### Acceptance Criteria
- [ ] Lathe: UV mapped as (angle/2pi, height_t) -- cylindrical projection
- [ ] Sweep: UV mapped as (path_t, profile_t)
- [ ] Extrude: UV mapped as (x, y) on caps, (perimeter_t, height_t) on sides
- [ ] Box: UV mapped per-face (standard box unwrap)
- [ ] UV stored as `Vec2` on vertices
- [ ] Unit tests verifying UV range [0,1] and continuity

#### Files to Modify
- `src/geometry/Vertex.ts` (add UV field)
- `src/geometry/MeshOperations.ts`
- `src/geometry/Sweep.ts`
- `src/geometry/Extrude.ts`

---

### C4-002: UV in Dashboard and Export

**Track:** C | **Status:** ⬜ | **Size:** S
**Dependencies:** C4-001, C3-001

#### Context
UVs should be visible in dashboard (checkerboard preview) and included in export.

#### Acceptance Criteria
- [ ] Dashboard can show checkerboard texture on UV-mapped meshes (toggle)
- [ ] PSD format includes UV data
- [ ] glTF export includes UV data (when C6 is built)

#### Files to Modify
- `src/dashboard/main.ts`
- `src/builder/PSD.ts`

---

## C5: Deformers

> **Goal:** Parametric deformations that break the CG-perfect look.

### C5-001: Noise Displacement

**Track:** C | **Status:** ⬜ | **Size:** M
**Dependencies:** None

#### Context
The simplest deformer: displace vertices along their normals by a noise function. Makes surfaces look hand-shaped, weathered, or organic.

#### Acceptance Criteria
- [ ] `MeshOperations.displaceByNoise(mesh, amplitude, frequency, seed)` returns deformed mesh
- [ ] Uses existing Perlin noise infrastructure (ScalarField)
- [ ] Displacement along vertex normals
- [ ] Normals recalculated after displacement
- [ ] YAML `displace:` command
- [ ] Unit test + integration test

#### Files to Modify
- `src/geometry/MeshOperations.ts`
- `src/builder/YamlBuilderParser.ts`

---

### C5-002: Bend & Twist

**Track:** C | **Status:** ⬜ | **Size:** M
**Dependencies:** None

#### Context
Parametric deformers that bend or twist geometry along an axis. Used for organic shapes, cables, stylized forms.

#### Acceptance Criteria
- [ ] `MeshOperations.bend(mesh, axis, angle, center)` bends mesh around axis
- [ ] `MeshOperations.twist(mesh, axis, angle)` twists mesh along axis
- [ ] Both preserve mesh topology
- [ ] YAML `bend:` and `twist:` commands
- [ ] Unit tests

#### Files to Modify
- `src/geometry/MeshOperations.ts`
- `src/builder/YamlBuilderParser.ts`

---

### C5-003: Taper

**Track:** C | **Status:** ⬜ | **Size:** S
**Dependencies:** None

#### Context
Scale geometry progressively along an axis. Already partially available via loft with different-sized loops, but a post-hoc taper is useful for existing meshes.

#### Acceptance Criteria
- [ ] `MeshOperations.taper(mesh, axis, startScale, endScale)` applies progressive scale
- [ ] Works on any mesh (not just lofted)
- [ ] YAML `taper:` command
- [ ] Unit test

#### Files to Modify
- `src/geometry/MeshOperations.ts`
- `src/builder/YamlBuilderParser.ts`

---

## C6: glTF Export

> **Goal:** Export builder output to standard 3D format.

### C6-001: Basic glTF Exporter

**Track:** C | **Status:** ⬜ | **Size:** L
**Dependencies:** C3-001, C4-001

#### Context
glTF is the standard interchange format. Exporting to it makes Procedurable output usable in any 3D tool, game engine, or web viewer.

#### Acceptance Criteria
- [ ] `exportGLTF(mesh | PSDScene)` produces valid .gltf + .bin files
- [ ] Geometry: positions, normals, UVs (when available)
- [ ] Materials: PBR material from material slots (color, roughness, metalness)
- [ ] Instances exported as nodes referencing shared mesh data
- [ ] Validates with glTF validator
- [ ] DSL command `builder.export_gltf <name> <path>`
- [ ] Integration test

#### Files to Modify
- `src/export/GLTFExporter.ts` (new)
- `src/authoring/commands/builder.ts`

---

### C6-002: Scene Export

**Track:** C | **Status:** ⬜ | **Size:** M
**Dependencies:** C6-001, B2-002

#### Context
Export composed scenes (multiple builders) as a single glTF with proper hierarchy.

#### Acceptance Criteria
- [ ] Composed scene exports with parent-child transform hierarchy
- [ ] Instances share mesh data (not duplicated)
- [ ] Material slots preserved across composed parts
- [ ] DiningScene exports as valid glTF with table + chairs

#### Files to Modify
- `src/export/GLTFExporter.ts`

---

# TRACK D: DOMAIN DEMOS (QUALITY PROOF)

> Each demo is a single story that rebuilds an existing builder to Tier 2 quality, proving the platform and tools work together.

### D1-001: DiningChair at Tier 2

**Track:** D | **Status:** ⬜ | **Size:** XL
**Dependencies:** A2-001, C2-003

#### Context
The DiningChair is the poster child for "stick figure quality." Rebuild it so every decision produces different geometry, every part has proper volume, and it passes Tier 2 quality gates.

#### Acceptance Criteria
- [ ] `back_style` decision produces 4 genuinely different back geometries (solid panel, slats, ladder, spindles)
- [ ] `leg_style` decision produces different cross-sections (round, square, turned)
- [ ] `seat_shape` decision affects seat geometry (flat, contoured, rounded)
- [ ] All parts have thickness (no single-face geometry)
- [ ] Seat has edge radius or bevel
- [ ] At least 2 materials (wood body + optional cushion)
- [ ] Passes Tier 2 quality gates
- [ ] Decision coverage >= 90%
- [ ] Quality section documents Tier 3 upgrade path
- [ ] Renders well in dashboard across 5+ seeds

#### Files to Modify
- `builders/DiningChair.yaml` (rewrite)

---

### D2-001: Vase at Tier 2

**Track:** D | **Status:** ⬜ | **Size:** L
**Dependencies:** A2-001, C5-001

#### Context
The Vase builder has good bones (lathe) but minimal variety and no surface detail.

#### Acceptance Criteria
- [ ] `vase_style` decision produces genuinely different profiles (not just height variation)
- [ ] Lip and foot detail: rim profile, foot ring, transition curves
- [ ] Surface variation via noise displacement (subtle, not random)
- [ ] At least 2 materials (body, glaze accent)
- [ ] Passes Tier 2 quality gates
- [ ] Quality section with honest Tier 3 gaps

#### Files to Modify
- `builders/Vase.yaml` (rewrite)

---

### D3-001: Gear at Tier 2

**Track:** D | **Status:** ⬜ | **Size:** L
**Dependencies:** A2-001, C1-002

#### Context
The Gear builder was never completed. Build it properly with 2D boolean tooth profiles.

#### Acceptance Criteria
- [ ] Involute tooth profile (or simplified trapezoidal) via 2D booleans
- [ ] Decisions: tooth count, module, pressure angle, bore diameter
- [ ] All decisions produce measurably different geometry
- [ ] Hub/web/rim structure (not just a flat disc with teeth)
- [ ] Passes Tier 2 quality gates

#### Files to Modify
- `builders/Gear.yaml` (rewrite)

---

### D4-001: Furnished Room at Tier 2

**Track:** D | **Status:** ⬜ | **Size:** XL
**Dependencies:** D1-001, D2-001, B2-002

#### Context
A composed scene where every component passes Tier 2 quality. This is the integration proof.

#### Acceptance Criteria
- [ ] Room with table, chairs, and at least one decorative object (vase)
- [ ] All composed builders pass Tier 2 individually
- [ ] Composition itself is quality-gated (no overlapping objects, reasonable layout)
- [ ] Exports to PSD format
- [ ] Decision variety: style decisions cascade through components (modern room → modern chair)
- [ ] Renders in dashboard across 5+ seeds with no visual glitches

#### Files to Modify
- `builders/ThemedRoom.yaml` or `builders/DiningScene.yaml` (rewrite)

---

# DEFERRED WORK

> These items are from the old backlog. They remain valid but are explicitly deferred. They are listed here for reference so nothing is lost. Each includes the reason for deferral and what would need to change for it to be picked up.

## Deferred: 3D Boolean CSG (was P2-M5)
**Reason:** Complex implementation, error-prone, only needed for architecture domain (doors/windows in walls). 2D booleans (C1) are more broadly useful and prove the approach.
**Pick up when:** Architecture domain becomes a priority and C1 is complete.

## Deferred: Botanical / L-Systems (was P2-M6)
**Reason:** Only needed for vegetation. The existing scatter + instancing system handles tree placement. L-systems add tree *generation* which is a separate domain.
**Pick up when:** Tree/plant quality matters and C5 (deformers) is complete.

## Deferred: Advanced Materials (was P2-M7)
**Reason:** Layer stacks, PBR textures, and procedural textures need material slots (C3) and UVs (C4) as prerequisites.
**Pick up when:** C3 and C4 are complete and domain demos (Track D) expose material limitations.

## Deferred: Cloth & Soft Bodies (was P2-M8)
**Reason:** Only needed for characters. Static drape is the first useful step but requires deformers.
**Pick up when:** Character domain becomes a priority and C5 (deformers) is complete.

## Deferred: Characters / PersonBuilder (was P2-M9)
**Reason:** Capstone that requires nearly everything else. Cannot be built well until materials, deformers, and ideally cloth are available.
**Pick up when:** Tracks A-D are substantially complete.

## Deferred: Renderer Package (was P2-M10)
**Reason:** Deployment concern, not authoring. The dashboard serves current visualization needs.
**Pick up when:** External consumers need to embed Procedurable output and C6 (glTF export) is complete.

## Deferred: Text & Advanced 2D (remaining P2-M4 stories)
**Reason:** Text-on-path, typography domain model, and calligraphy strokes are nice-to-have. The basic text-to-shape pipeline works. Glyph holes (B1-002/C1-003) are the critical fix.
**Pick up when:** Signage domain builders expose specific typography limitations.

## Deferred: Animation & Physics (Phase 3)
**Reason:** Rigging, animation, physics are Phase 3. Vertex weight stubs should be added in C4 (UV work touches Vertex class).
**Pick up when:** Phase 2 revised is complete.

## Deferred: Asset Analyzer Framework (P3-Advanced)
**Reason:** Research-grade work for importing external assets. Not needed for the authoring platform.
**Pick up when:** Users request batch import of large asset libraries.
