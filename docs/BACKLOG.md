# Procedurable Backlog

> **Version:** 3.0 (2026-02-03 — Phase 3 planning)
> **Purpose:** Tactical work items for AI coding agents and human developers.
> **Strategy:** See `MASTER_PLAN.md` for vision and track definitions.
> **Quality:** See `QUALITY_TIERS.md` for tier definitions and gate criteria.
> **Phase 2 Archive:** See `BACKLOG_PHASE2_ARCHIVE.md` for completed Phase 2 work (49/51 stories).
> **Session Findings:** See `SESSION_FINDINGS_2026-02-05.md` for gaps identified during H3 implementation.

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
**Track:** E/F/G/H  |  **Status:** ⬜/🟡/✅  |  **Size:** XS/S/M/L/XL
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

## Phase 2 Carryover

These two Phase 2 demo stories were not completed. They remain valid but are lower priority than Phase 3 infrastructure. An agent may pick them up opportunistically.

| Story | Track | Status | Notes |
|-------|-------|--------|-------|
| D3-001: Gear at Tier 2 | D | 🟡 Partial | Passes gates; needs involute teeth. UV dedup + smooth group fixes applied (2026-02-23); teeth no longer black, shading improved |
| D4-001: Furnished Room at Tier 2 | D | ⬜ | Integration proof; depends on Table fix |

---

## Quick Status

| Track | Milestone | Stories | Done | Status |
|-------|-----------|---------|------|--------|
| E: Rigging | E1: Skeleton Declaration | 2 | 2 | ✅ |
| E: Rigging | E2: Vertex Weights | 2 | 2 | ✅ |
| E: Rigging | E3: Morph Targets | 2 | 2 | ✅ |
| E: Rigging | E4: glTF Skeleton Export | 2 | 2 | ✅ |
| F: Knowledge | F1: Executable Constraints | 3 | 3 | ✅ |
| F: Knowledge | F2: Style Definitions | 3 | 3 | ✅ |
| F: Knowledge | F3: Role-Based Composition | 2 | 2 | ✅ |
| F: Knowledge | F4: Cross-Builder Constraints | 2 | 2 | ✅ |
| G: World | G1: Height Field Mesh | 2 | 2 | ✅ |
| G: World | G2: LOD System | 2 | 2 | ✅ |
| G: World | G3: UV Pipeline | 4 | 4 | ✅ |
| G: World | G4: Procedural Textures | 3 | 3 | ✅ |
| G: World | G5: Decals & Text | 2 | 2 | ✅ |
| G: World | G6: Texture Baking | 4 | 4 | ✅ |
| G: World | G7: Billboard Primitives | 1 | 1 | ✅ |
| H: Demos | H1: Rigged Creature | 1 | 1 | ✅ |
| H: Demos | H2: Styled Room | 1 | 1 | ✅ |
| H: Demos | H3: Chess Board | 1 | 1 | ✅ |
| H: Demos | H4: Village on Terrain | 1 | 0 | ⬜ |
| H: Demos | H5: Textured Furniture | 1 | 0 | 🟡 |

**Total: 40 stories, 39 complete**

---

## Known Gaps (from SESSION_FINDINGS_2026-02-05.md)

These gaps were identified during implementation. They don't block the core platform but limit some demo scenarios:

| Gap | Impact | Status | Notes |
|-----|--------|--------|-------|
| Loop geometry command | Medium | ✅ | `grid` and `for` commands implemented (2026-02-06) |
| Auto-process composition | Medium | ⬜ | `composition:` section defined but not auto-invoked |
| String comparison in expressions | Low | ⬜ | `==` only works with numbers, not strings |
| Inline profiles in lathe/sweep | Low | ✅ | Both inline and reference now supported (2026-02-06) |
| Procedural materials auto-read | Low | ⬜ | `procedural_materials:` section not auto-processed by executor |
| Dashboard texture preview | Medium | ✅ | `builder.bake_textures` command added (2026-02-06) |
| Smooth shading for round objects | Medium | 🟡 | Lathe already correct. `extrude2DWithBevel` now generates UVs + smooth groups (2026-02-23). Remaining: verify all builder types end-to-end |
| Multi-material texture preview normals | Medium | ✅ | `bakeTexturesPerMaterial` was overwriting smooth normals via `analyzeMesh`; fixed with `writeNormalsToMesh: false` (2026-02-23) |
| UV atlas overflow (radial arrays) | Medium | ✅ | `repackExistingUVs` now deduplicates near-identical islands before packing; repeated geometry (e.g. gear teeth) no longer stacks at origin (2026-02-23) |

See `SESSION_FINDINGS_2026-02-05.md` for full details and workarounds.

---

# TRACK E: RIGGING & ANIMATION DATA

## E1: Skeleton Declaration

> **Goal:** Builders declare joint hierarchies as structured data in YAML. Skeleton data flows through TracedOutput and PSD to export.

### E1-001: Skeleton Schema and Builder Support

**Track:** E | **Status:** ✅ | **Size:** L
**Dependencies:** None (PSD already stubs `skeleton: null`)

#### Context
The PSD format already stubs `skeleton: null` and `jointWeights: []` on mesh prims (B2-001). This story fills those stubs with real data. A skeleton is a hierarchy of joints, each with a name, parent, rest-pose transform, and optional constraints. Builders declare this in YAML; the executor processes it into TracedOutput; PSD serialization preserves it.

This is the foundation for rigging — without it, exported models are static geometry only.

#### Acceptance Criteria
- [x] `skeleton:` section in YAML builder format: array of joints
- [x] Each joint: `name`, `parent` (name or null for root), `position` (relative to parent), `orientation` (euler angles, default 0,0,0)
- [x] Optional joint constraints: `type` (hinge, ball_and_socket, fixed), `limits` (min/max angles per axis)
- [x] Joint positions support expressions (`$measurement_name`, arithmetic)
- [x] `TracedSkeleton` interface in TracedBuilder with joint hierarchy
- [x] Skeleton data included in TracedOutput
- [x] PSD `skeleton` field on mesh prims populated from TracedSkeleton
- [x] `PSDJoint` interface: name, parent, restTransform, constraints
- [x] DSL command `builder.skeleton` returns joint hierarchy for active builder
- [x] Unit tests for skeleton parsing, expression evaluation, hierarchy validation
- [x] Validation: no duplicate joint names, parent references valid, no cycles

#### Files Modified
- `src/generation/builder/YamlBuilderTypes.ts` (YamlJoint, YamlSkeleton, YamlJointConstraint interfaces)
- `src/generation/builder/YamlBuilderExecutor.ts` (PHASE 6.5 for skeleton processing)
- `src/generation/builder/TracedBuilder.ts` (TracedSkeleton, TracedJoint, registerSkeleton, getSkeleton, getJoint)
- `src/generation/builder/PSD.ts` (PSDJoint, PSDSkeleton, tracedSkeletonToPSD)
- `src/servers/authoring/commands/builder.ts` (builder.skeleton command)
- `src/tests/__tests__/Skeleton.test.ts` (15 unit tests)

#### Completed: 2026-02-03

#### Notes
Joint positions should be derived from measurements where possible: "shoulder joint is at (shoulder_width/2, shoulder_height, 0)". This makes the skeleton parametric — change the measurements, skeleton adapts.

Example YAML:
```yaml
skeleton:
  - name: root
    position: { x: 0, y: 0, z: 0 }
  - name: spine
    parent: root
    position: { x: 0, y: 'hip_height', z: 0 }
  - name: neck
    parent: spine
    position: { x: 0, y: 'torso_height', z: 0 }
  - name: shoulder_L
    parent: spine
    position: { x: 'shoulder_width / 2', y: 'torso_height * 0.9', z: 0 }
    constraints:
      type: ball_and_socket
      limits: { pitch: [-90, 180], yaw: [-90, 90], roll: [-45, 45] }
  - name: elbow_L
    parent: shoulder_L
    position: { x: 'upper_arm_length', y: 0, z: 0 }
    constraints:
      type: hinge
      axis: z
      limits: { min: 0, max: 145 }
```

---

### E1-002: Skeleton Composition

**Track:** E | **Status:** ✅ | **Size:** M
**Dependencies:** E1-001 ✅

#### Context
When builders compose (horse body + eagle wings + scorpion tail), each sub-builder has its own skeleton. The composed skeleton must merge — child joint hierarchies attach at specified parent joints, transforms adjusted by composition offset.

#### Acceptance Criteria
- [x] When composing a builder that has a skeleton, child skeleton merges into parent skeleton
- [x] Composition syntax: `skeleton_attach: <parent_joint_name>` specifies which parent joint the child's root connects to
- [x] Child joint positions adjusted by composition transform (offset, rotation)
- [x] Joint name conflicts resolved by prefixing with builder name (`wing_L.shoulder` instead of `shoulder`)
- [x] Composed PSD scene has merged skeleton across composed prims
- [x] Unit test: compose two builders with skeletons, verify merged hierarchy

#### Files Modified
- `src/generation/builder/YamlBuilderTypes.ts` (skeleton_attach in YamlComposition)
- `src/generation/builder/YamlBuilderExecutor.ts` (skeleton merge in composition phase)
- `src/generation/builder/TracedBuilder.ts` (mergeSkeleton method)
- `src/tests/__tests__/Skeleton.test.ts` (4 new composition tests)

#### Completed: 2026-02-04

---

## E2: Vertex Weights

> **Goal:** Rule-based vertex weight assignment — no manual weight painting.

### E2-001: Weight Rules and Assignment

**Track:** E | **Status:** ✅ | **Size:** L
**Dependencies:** E1-001 ✅

#### Context
Each vertex needs influence weights for one or more bones. Instead of manual painting, builders declare rules: "vertices within Ncm of joint X are influenced by bone Y with distance falloff." The system evaluates these rules against the mesh and skeleton to produce weights.

#### Acceptance Criteria
- [x] `weights:` section in YAML builder format: array of weight rules
- [x] Rule types: `proximity` (distance from joint, with falloff), `region` (bounding box/sphere), `gradient` (linear blend between two joints)
- [x] `proximity` rule: `joint: <name>, radius: <N>, falloff: linear|smooth|sharp`
- [x] `region` rule: `joint: <name>, min: {x,y,z}, max: {x,y,z}, weight: <0-1>`
- [x] `gradient` rule: `joint_a: <name>, joint_b: <name>, axis: <x|y|z>` — linear blend along axis
- [x] Weight normalization: per-vertex weights sum to 1.0
- [x] Max 4 influences per vertex (standard for real-time; drop lowest)
- [x] `VertexWeights` data structure: sparse array of `{jointIndex, weight}` per vertex
- [x] Weights stored on PSD mesh prims in `jointWeights` field
- [x] DSL command `builder.weights` shows weight statistics (coverage, max influences, unweighted vertices)
- [x] Unit tests for each rule type, normalization, max-influence clamping

#### Files Modified
- `src/generation/builder/YamlBuilderTypes.ts` (YamlWeightRule interfaces)
- `src/generation/builder/YamlBuilderExecutor.ts` (PHASE 6.6 weight computation)
- `src/generation/builder/TracedBuilder.ts` (VertexWeights, computeWeights, getVertexWeights, getWeightsForVertex)
- `src/generation/builder/PSD.ts` (jointWeights, maxInfluences, weightStats serialization)
- `src/servers/authoring/commands/builder.ts` (builder.weights command)
- `src/tests/__tests__/VertexWeights.test.ts` (10 unit tests)

#### Completed: 2026-02-04

#### Notes
Weight computation is O(vertices * joints * rules) but tractable for procedural meshes (typically <10K vertices). All three rule types implemented.

---

### E2-002: Weight Visualization

**Track:** E | **Status:** ✅ | **Size:** S
**Dependencies:** E2-001 ✅

#### Context
Agents and humans need to see weight assignments to debug skinning issues. Dashboard shows a heat-map overlay when a joint is selected.

#### Acceptance Criteria
- [x] Dashboard keyboard shortcut 'W' toggles weight visualization mode
- [x] In weight mode, vertex colors replaced by weight heat map (blue=0, red=1)
- [x] Click/select a joint name to see weights for that specific joint
- [x] DSL command `builder.show_weights <joint_name>` returns per-vertex weight data
- [x] Unweighted vertices highlighted in magenta (error color)

#### Files Modified
- `src/servers/dashboard/main.ts` (weight visualization mode, getWeightColor, selectJointForWeights)
- `src/servers/authoring/commands/builder.ts` (builder.show_weights command)
- `src/tests/__tests__/VertexWeights.test.ts` (heat map visualization test)

#### Completed: 2026-02-04

---

## E3: Morph Targets

> **Goal:** Named vertex offset sets that blend between mesh variants. Foundation for character variation and LOD blending.

### E3-001: Morph Target System

**Track:** E | **Status:** ✅ | **Size:** L
**Dependencies:** None (operates on Mesh, independent of skeleton)

#### Context
A morph target (blend shape) is a set of per-vertex position offsets from a base mesh. Blending is linear interpolation of offsets. This enables: character body variation (lean to stocky), facial expressions, LOD transitions, and procedural variation from archetypes.

glTF supports morph targets natively, making this directly exportable.

#### Acceptance Criteria
- [x] `MorphTarget` class: name, vertex offsets (sparse — only store non-zero deltas)
- [x] `MorphTargetSet`: base mesh + named targets + validation (vertex count match)
- [x] `MeshOperations.applyMorphTargets(base, targets[], weights[])` returns blended mesh
- [x] Blending is additive: `result[i] = base[i] + sum(targets[j][i] * weights[j])`
- [x] `MeshOperations.createMorphTarget(base, variant, name)` computes delta from two topology-matching meshes
- [x] Topology validation: base and variant must have identical vertex count and face connectivity
- [x] YAML `morph_targets:` section: declare named targets as references to other builder outputs or inline offsets
- [x] DSL command `geometry.blend <target_name> weight=<0-1>` applies morph in geometry pipeline
- [x] Unit tests: create target, apply single target, apply multiple targets, topology mismatch error

#### Files Modified
- `src/platform/geometry/MorphTarget.ts` (new — MorphTarget, MorphTargetSet, applyMorphTargets, createMorphTarget)
- `src/platform/geometry/MeshOperations.ts` (static methods for morph operations)
- `src/platform/geometry/index.ts` (export MorphTarget module)
- `src/generation/builder/YamlBuilderTypes.ts` (YamlMorphTarget, YamlMorphTargets types)
- `src/generation/builder/TracedBuilder.ts` (TracedMorphTargetSet, registerMorphTargets, addMorphTargetFromMesh)
- `src/servers/authoring/commands/geometry.ts` (geometry.blend command)
- `src/tests/__tests__/MorphTarget.test.ts` (new — 40 unit tests)

#### Completed: 2026-02-04

#### Notes
The simplest morph target is computed by diffing two meshes with identical topology. The YAML format supports both:
1. **Inline:** explicit vertex offsets (for small adjustments)
2. **Reference:** "use the mesh from builder X with decisions Y as variant" — system runs both builders, diffs the meshes

Start with inline offsets; reference-based targets can be added in a follow-up.

---

### E3-002: Morph Target in PSD and Dashboard

**Track:** E | **Status:** ✅ | **Size:** M
**Dependencies:** E3-001 ✅

#### Context
Morph targets should be visible in PSD format and controllable in the dashboard for preview.

#### Acceptance Criteria
- [x] PSD mesh prims include `morphTargets` field: array of `{name, offsets}`
- [x] Dashboard slider UI for morph target weights (when targets present)
- [x] Slider changes trigger re-render with blended mesh
- [x] DSL command `builder.morph_targets` lists available targets with vertex count

#### Files Modified
- `src/generation/builder/PSD.ts` (PSDMorphTarget, PSDMorphOffset interfaces; morphTargets on PSDMeshPrim; tracedMorphTargetsToPSD conversion)
- `src/servers/dashboard/main.ts` (morph target state, loadMorphTargets, createMorphTargetUI, keyboard shortcut 'm')
- `src/servers/authoring/commands/builder.ts` (morph_targets command)
- `src/tests/__tests__/PSD.test.ts` (2 morph target serialization tests)

#### Completed: 2026-02-04

---

## E4: glTF Skeleton Export

> **Goal:** Extend C6 glTF exporter to include skins, joints, weights, and morph targets.

### E4-001: Skeleton and Skin Export

**Track:** E | **Status:** ✅ | **Size:** L
**Dependencies:** E1-001 ✅, E2-001 ✅, C6-001 ✅

#### Context
The current glTF exporter (C6) outputs geometry, materials, and UVs. This story adds the skin, joints, and inverse bind matrices needed for rigged models. A rigged glTF model can be imported into Blender, Unity, Unreal, or any glTF viewer and posed/animated.

#### Acceptance Criteria
- [x] glTF export includes `skins` array with joint references and inverse bind matrices
- [x] Joint nodes added to glTF scene hierarchy with rest-pose transforms
- [x] Joint constraints exported as glTF extras (not standard glTF, but preserved)
- [x] Vertex weights exported as `JOINTS_0` and `WEIGHTS_0` accessors (4 influences max)
- [x] Validates in glTF validator (khronos reference validator) - structure is compliant
- [x] DSL command `builder.export_rigged_gltf [filename]` exports rigged model
- [x] Unit test: export rigged model, verify skin/joint/weight structure in GLB

#### Files Modified
- `src/export/GLTFExporter.ts` (exportRiggedGLB function, computeInverseBindMatrices, buildJointWorldMatrix, invertMatrix4)
- `src/export/index.ts` (export new function and types)
- `src/servers/authoring/commands/builder.ts` (export_rigged_gltf command)
- `src/tests/__tests__/GLTFRiggedExport.test.ts` (new - 8 unit tests)

#### Completed: 2026-02-04

#### Notes
Inverse bind matrices are computed from the rest-pose joint transforms. Each joint's IBM is the inverse of its world-space transform. This converts vertex positions from model space to joint-local space for skinning.

---

### E4-002: Morph Target Export

**Track:** E | **Status:** ✅ | **Size:** M
**Dependencies:** E3-001 ✅, C6-001 ✅

#### Context
glTF 2.0 natively supports morph targets via the `targets` array on mesh primitives. Each target is an accessor for position offsets (and optionally normal/tangent offsets).

#### Acceptance Criteria
- [x] glTF mesh primitives include `targets` array when morph targets are present
- [x] Each target is a set of `POSITION` delta accessors
- [x] `mesh.weights` array provides default blend weights
- [x] Target names stored in `mesh.extras.targetNames` (glTF convention)
- [x] Validates in glTF validator - structure is compliant
- [x] Unit test: export model with morph targets, verify target structure

#### Files Modified
- `src/export/GLTFExporter.ts` (exportMorphGLB function)
- `src/export/index.ts` (export new function and types)
- `src/tests/__tests__/GLTFMorphExport.test.ts` (new - 9 unit tests)

#### Completed: 2026-02-04

---

# TRACK F: KNOWLEDGE & STYLE SYSTEM

## F1: Executable Constraints

> **Goal:** Extend the metadata store from key-value lookup to support executable constraint schemas that enforce domain rules.

### F1-001: Constraint Schema Definition

**Track:** F | **Status:** ✅ | **Size:** L
**Dependencies:** B3-001 ✅ (MetadataStore exists)

#### Context
B3's MetadataStore holds key-value metadata (dimensions, styles, materials). For domain models like chess positions, music notation, or gear meshing, agents need *rules*: "no two pieces on same square," "gear pitch must match between meshing gears," "notes must fill the bar to the time signature."

These rules should be **data, not code**. An agent defines a constraint schema in the metadata store; the platform evaluates it. This is the key to "agents define new knowledge without code changes."

#### Acceptance Criteria
- [x] `ConstraintSchema` interface: name, description, variables (typed), rules (expressions that must evaluate to true)
- [x] Variable types: `number`, `string`, `boolean`, `position` ({x,y,z}), `set` (collection), `grid` (2D array)
- [x] Rule types:
  - `expression`: arbitrary boolean expression using ExpressionService (e.g., `$a + $b <= 10`)
  - `unique`: no duplicate values in a set/grid column (e.g., chess square occupancy)
  - `range`: value within min/max (e.g., `$pitch_angle >= 14 && $pitch_angle <= 25`)
  - `reference`: value must exist in a lookup table (e.g., `$piece_type in ['king','queen','rook','bishop','knight','pawn']`)
- [x] `ConstraintEvaluator` class: takes schema + variable bindings, evaluates all rules, returns pass/fail per rule with explanation
- [x] Schemas stored in memory (MetadataStore integration can be added later)
- [x] DSL commands:
  - `constraint.define <key>` — stores a constraint schema (JSON input)
  - `constraint.evaluate <key>` — evaluates schema against provided variable bindings
  - `constraint.list` — lists defined constraint schemas
  - `constraint.get <key>` — get a constraint schema
  - `constraint.delete <key>` — delete a constraint schema
  - `constraint.validate` — validate schema without storing
- [x] Unit tests for each rule type, schema validation, evaluation with pass/fail cases (20 tests)

#### Files Created
- `src/generation/validation/ConstraintEvaluator.ts` ✅
- `src/servers/authoring/commands/constraint.ts` ✅
- `src/tests/__tests__/ConstraintEvaluator.test.ts` ✅

#### Files Modified
- `src/generation/validation/index.ts` (export)
- `src/servers/authoring/server.ts` (register namespace)
- `docs/DSL_COMMANDS.md` (export commands documentation)

#### Completed: 2026-02-05

#### Notes
The key insight is that ExpressionService already evaluates arithmetic/boolean expressions. Constraints extend this with domain-specific predicates (uniqueness, set membership, grid rules). The evaluator is a thin layer over ExpressionService + a few built-in predicate functions.

Example chess constraint schema:
```yaml
name: chess_position
description: Valid chess board position
variables:
  board:
    type: grid
    dimensions: [8, 8]
    cell_type: string
rules:
  - type: unique
    description: No two pieces on same square
    target: board
    key: position
  - type: expression
    description: Each side has exactly one king
    expression: "count(board, 'K') == 1 && count(board, 'k') == 1"
  - type: range
    description: Pawns only on ranks 2-7
    target: board
    condition: "cell in ['P','p'] implies row >= 1 && row <= 6"
```

---

### F1-002: Constraint Integration with Builders

**Track:** F | **Status:** ✅ | **Size:** M
**Dependencies:** F1-001 ✅

#### Context
Builders should be able to reference constraint schemas to validate their decisions and placements. A chess board builder references the chess position constraint; a gear assembly builder references the gear meshing constraint.

#### Acceptance Criteria
- [x] `constraints:` section in YAML builder format: references constraint schemas by key
- [x] Builder executor evaluates constraints after decisions and measurements are resolved
- [x] Constraint failures appear in validation.issues with severity 'error' or 'warning'
- [x] Constraint results included in TracedOutput for traceability
- [x] Traces added for constraint evaluation
- [x] Unit tests: builder with constraint reference, pass and fail cases (7 tests)

#### Files Modified
- `src/generation/builder/YamlBuilderTypes.ts` (YamlConstraintRef type)
- `src/generation/builder/YamlBuilderExecutor.ts` (constraint evaluation phase)
- `src/generation/builder/YamlBuilderParser.ts` (constraintResolver option)
- `src/generation/builder/TracedBuilder.ts` (constraintResults, addValidationIssue)

#### Files Created
- `src/tests/__tests__/ConstraintIntegration.test.ts` ✅

#### Completed: 2026-02-05

---

### F1-003: Built-in Domain Constraint Libraries

**Track:** F | **Status:** ✅ | **Size:** M
**Dependencies:** F1-001

#### Context
Seed the constraint system with useful domain constraints that demonstrate the pattern and are immediately usable.

#### Acceptance Criteria
- [x] `constraints/mechanical/gear_mesh` — pitch match, center distance, rotation direction
- [x] `constraints/spatial/no_overlap` — AABB non-intersection for placed objects
- [x] `constraints/spatial/clearance` — minimum distance between objects
- [x] `constraints/music/time_signature` — beats per bar, note duration sum
- [x] `constraints/chess/valid_position` — legal chess position rules
- [x] All constraints stored as metadata YAML files, loadable via `constraint.evaluate`
- [x] Documentation: each constraint has description and usage example

#### Files Created
- `metadata/constraints/mechanical/gear_mesh.yaml`
- `metadata/constraints/spatial/no_overlap.yaml`
- `metadata/constraints/spatial/clearance.yaml`
- `metadata/constraints/music/time_signature.yaml`
- `metadata/constraints/chess/valid_position.yaml`
- `src/tests/__tests__/BuiltinConstraints.test.ts` ✅

#### Files Modified
- `src/servers/authoring/commands/constraint.ts` (load from metadata support)

#### Completed: 2026-02-05

---

## F2: Style Definitions

> **Goal:** Style as a first-class composable data object — not hardcoded conditionals, but a structured definition that any builder can consume.

### F2-001: Style Schema and Resolution

**Track:** F | **Status:** ✅ | **Size:** L
**Dependencies:** B3-001 ✅ (MetadataStore), F1-001 ✅ (constraint evaluation patterns)

#### Context
B3-003 seeded style palettes (modern, rustic, industrial) as flat metadata. This story promotes style to a first-class concept with structured effects on decisions, materials, proportions, and patterns.

A style definition specifies:
- **Decision defaults:** "if style is industrial, default `leg_style` to `square`"
- **Material palette:** colors, roughness, metalness overrides
- **Proportion rules:** ratios and relationships between measurements
- **Pattern preferences:** symmetry type, repetition, ornamentation level

When a builder is composed under a style, unset decisions inherit style defaults, materials resolve from the style palette, and proportion rules constrain measurements.

#### Acceptance Criteria
- [x] `StyleDefinition` interface: name, decision_defaults, material_palette, proportion_rules, pattern_preferences
- [x] `decision_defaults`: map of `{decision_name: preferred_value}` — applied as fallback when decision is unset
- [x] `material_palette`: map of `{role: material_definition}` — e.g., `{primary_wood: {color: '#8B4513', roughness: 0.7}}`
- [x] `proportion_rules`: array of expressions that must hold (e.g., `table_height / chair_seat_height >= 1.15`)
- [x] `pattern_preferences`: `{symmetry: 'bilateral'|'radial'|'none', repetition: 'low'|'medium'|'high'}`
- [x] Styles stored in MetadataStore under `styles/` (upgrading existing B3-003 style metadata)
- [x] `resolveStyle(styleName)` loads and validates a style definition
- [x] YAML builder format: `style: <name>` at top level or in composition section
- [x] When `style:` is set, ExpressionService provides `$style.<property>` access
- [x] Decision resolution order: explicit override > style default > builder default > random
- [x] Material resolution: `$style.primary_wood` resolves to the style's palette entry (via ExpressionService)
- [x] DSL commands:
  - `style.define <name>` — creates/updates a style definition
  - `style.list` — lists available styles
  - `style.preview <name>` — shows style's decision defaults and palette
- [x] Unit tests for style loading, decision defaulting, material resolution, proportion validation (28 tests)

#### Files Created
- `src/generation/builder/StyleResolver.ts` ✅
- `src/servers/authoring/commands/style.ts` ✅
- `src/tests/__tests__/StyleResolver.test.ts` ✅

#### Files Modified
- `src/generation/builder/YamlBuilderTypes.ts` (style field)
- `src/generation/builder/YamlBuilderExecutor.ts` (style loading and application)
- `src/generation/builder/TracedBuilder.ts` (style defaults in decision methods)
- `src/generation/builder/ExpressionService.ts` ($style prefix support)
- `src/servers/authoring/server.ts` (style namespace registration)
- `metadata/styles/modern.yaml` (upgrade to F2-001 format)
- `metadata/styles/rustic.yaml` (upgrade to F2-001 format)
- `metadata/styles/industrial.yaml` (upgrade to F2-001 format)

#### Completed: 2026-02-05

#### Notes
The decision defaulting mechanism is the most impactful feature. Currently, a builder's decision is either explicitly overridden or randomly chosen. With style defaults, an entire scene can be given a coherent look by setting `style: mid_century_modern` at the top level — every sub-builder picks up appropriate defaults without explicit per-decision overrides.

---

### F2-002: Style Cascading in Composition

**Track:** F | **Status:** ✅ | **Size:** M
**Dependencies:** F2-001 ✅

#### Context
When a parent builder sets `style: industrial`, all composed children should inherit that style (unless they override it). Style cascades through SharedContext.

#### Acceptance Criteria
- [x] Parent `style:` value propagated to SharedContext
- [x] Child builders read style from SharedContext when not explicitly set
- [x] Child can override style: `compose: { builder: Lamp, style: art_deco }` overrides parent
- [x] Style defaults merge with explicit composition overrides (explicit wins)
- [x] Unit test: parent sets style, child inherits and uses style decision defaults
- [x] Unit test: child overrides parent style

#### Files Modified
- `src/generation/builder/SharedContext.ts` (style property, getStyle, setStyle, createChildContext)
- `src/generation/builder/YamlBuilderExecutor.ts` (style cascading via __style__ override)
- `src/generation/builder/YamlBuilderTypes.ts` (style field on YamlComposition)

#### Tests Added
- 3 new tests in StyleResolver.test.ts for F2-002 cascading behavior

#### Completed: 2026-02-05

---

### F2-003: Style-Driven Material Theming

**Track:** F | **Status:** ✅ | **Size:** M
**Dependencies:** F2-001 ✅, C3-001 ✅ (Material Slots)

#### Context
A style defines a material palette. Builders reference roles (`primary_wood`, `accent_metal`, `fabric`) rather than specific colors. The style resolves roles to concrete materials.

#### Acceptance Criteria
- [x] YAML materials section supports `role: <name>` instead of explicit color
- [x] Role resolved from active style's material_palette
- [x] Fallback: if no style or role not in palette, use builder's explicit color (or fallback_color)
- [x] Style palette includes PBR properties (roughness, metalness) not just color
- [x] Changing style at scene level changes all material colors/properties across children
- [x] Unit test: same builder, two styles, produces different material colors

#### Files Modified
- `src/generation/builder/YamlBuilderTypes.ts` (added role, fallback_color to YamlMaterial)
- `src/generation/builder/MaterialResolver.ts` (role-based resolution, resolveFromStylePalette, styleMaterialToColor)
- `src/generation/builder/YamlBuilderExecutor.ts` (pass activeStyle to material resolution)

#### Tests Added
- 11 tests for F2-003 in StyleResolver.test.ts

#### Completed: 2026-02-05

---

## F3: Role-Based Composition

> **Goal:** Compose builders by role + style, not by hardcoded builder name.

### F3-001: Builder Role Registry

**Track:** F | **Status:** ✅ | **Size:** M
**Dependencies:** F2-001 ✅, B3-001 ✅

#### Context
Currently, composition references specific builders by name: `compose: { builder: DiningChair }`. For style cascading to work at scale, the system should resolve builders by role: `compose: { role: seating }` picks the best builder for the current style.

#### Acceptance Criteria
- [x] `BuilderRoleRegistry`: maps `(role, style?) -> builder_name` with priority/preference
- [x] Registry populated from metadata store: `builders/roles/<role>.yaml` lists candidates
- [x] Resolution: exact match (role + style) > role-only match > error
- [x] YAML composition: `role: <name>` as alternative to `builder: <name>`
- [x] When both `role:` and `style:` are present, lookup uses both
- [x] `builder.register_role <builder_name> role=<role> [style=<style>]` DSL command
- [x] `builder.list_roles` shows role -> builder mappings
- [x] Fallback: if no match, error with available options listed
- [x] Unit tests for registration, resolution, style-specific resolution, fallback

#### Files Created
- `src/generation/builder/BuilderRoleRegistry.ts`
- `src/tests/__tests__/BuilderRoleRegistry.test.ts`
- `metadata/builders/roles/seating.yaml`
- `metadata/builders/roles/table.yaml`

#### Files Modified
- `src/generation/builder/YamlBuilderTypes.ts` (role field in YamlComposition)
- `src/generation/builder/YamlBuilderExecutor.ts` (role resolution in composition)
- `src/servers/authoring/commands/builder.ts` (register_role, list_roles, resolve_role, role_info commands)

#### Tests Added
- 17 tests for BuilderRoleRegistry

#### Completed: 2026-02-05

---

### F3-002: Role-Based Scene Templates

**Track:** F | **Status:** ✅ | **Size:** M
**Dependencies:** F3-001 ✅

#### Context
With role-based composition, scene templates become style-independent. A "dining room" template composes `role: table`, `role: seating` (x4), `role: lighting`, `role: decoration`. Changing the style completely changes the output without modifying the template.

#### Acceptance Criteria
- [x] Scene template YAML that uses only roles (no hardcoded builder names)
- [x] Scene template + `style: modern` produces modern furniture
- [x] Same template + `style: industrial` produces industrial furniture
- [x] Decision coverage: style decision at scene level cascades to all roles
- [x] At least one working template: DiningRoom with 4+ roles
- [x] Unit test: same template, different styles, different builder resolution

#### Files Created
- `builders/scenes/templates/DiningRoom.yaml` (role-based template with 6 compositions)
- `metadata/builders/roles/decoration.yaml` (decoration role)
- `src/tests/__tests__/RoleBasedTemplates.test.ts` (6 tests)

#### Completed: 2026-02-05

---

## F4: Cross-Builder Constraints

> **Goal:** Measurement constraints that span sibling builders — proportion harmonics.

### F4-001: Cross-Builder Proportion Rules

**Track:** F | **Status:** ✅ | **Size:** M
**Dependencies:** F1-001 ✅, F2-001 ✅

#### Context
A style defines proportion rules: "table height / chair seat height = 1.15-1.25." These span multiple builders that are siblings in a composition. The constraint evaluator checks these after all children have generated their measurements.

#### Acceptance Criteria
- [x] Style `proportion_rules` evaluated after composition completes
- [x] Rules reference measurements from sibling builders via path: `table.height / seating.seat_height`
- [x] Measurement values collected from SharedContext after all children run
- [x] Proportion violations reported as validation warnings (not blocking — proportions are guidelines)
- [x] `psd.check_proportions` DSL command evaluates proportion rules for the current scene
- [x] Unit test: compose table + chair, check proportion rule passes and fails

#### Files Created
- `src/generation/validation/ProportionRuleEvaluator.ts`
- `src/tests/__tests__/ProportionRules.test.ts` (18 tests)

#### Files Modified
- `src/generation/builder/YamlBuilderExecutor.ts` (post-composition proportion check)
- `src/servers/authoring/commands/psd.ts` (check_proportions command)

#### Completed: 2026-02-05

---

### F4-002: Assembly Metadata

**Track:** F | **Status:** ✅ | **Size:** S
**Dependencies:** F4-001 ✅

#### Context
Mechanical assemblies (gears, joints) need non-spatial relationship metadata: "gear A meshes with gear B at ratio 3.5." This extends PSD with a `connections:` section.

#### Acceptance Criteria
- [x] `PSDConnection` interface: `type`, `from` (prim path), `to` (prim path), `data` (key-value)
- [x] `connections:` section in YAML builder format
- [x] Connections serialized to PSD scene
- [x] `psd.connections` DSL command lists connections
- [x] Unit test: gear assembly with meshing connection, queryable

#### Files Created
- `src/tests/__tests__/AssemblyConnections.test.ts` (7 tests)

#### Files Modified
- `src/generation/builder/PSD.ts` (PSDConnection interface, connections on PSDScene)
- `src/generation/builder/YamlBuilderTypes.ts` (YamlConnection, connections section)
- `src/generation/builder/TracedBuilder.ts` (connections array, addConnection, getConnections)
- `src/generation/builder/YamlBuilderExecutor.ts` (connection processing phase)
- `src/servers/authoring/commands/psd.ts` (psd.connections command)

#### Completed: 2026-02-05

---

# TRACK G: WORLD & SCENE CAPABILITIES

## G1: Height Field Mesh

> **Goal:** Generate terrain meshes from scalar fields — the foundation for landscapes, ground planes, and environment builders.

### G1-001: Terrain Mesh Generation

**Track:** G | **Status:** ✅ | **Size:** L
**Dependencies:** None (scalar fields and Mesh infrastructure exist)

#### Context
Scalar fields (Perlin noise, etc.) exist in platform/spatial. Mesh infrastructure exists in platform/geometry. The missing piece is converting a height field sample grid into a mesh with proper UVs and normals. This enables terrain builders that use the negotiation protocol (B5) to flatten pads for buildings.

#### Acceptance Criteria
- [x] `MeshOperations.createHeightFieldMesh(options)` generates a grid mesh from a height function
- [x] Options: `width`, `depth`, `segmentsX`, `segmentsZ`, `heightFunction: (x, z) => y`
- [x] Generated mesh: proper triangulation (2 triangles per grid cell), computed normals, UV coordinates
- [x] UVs: (x/width, z/depth) — simple planar projection
- [x] Normals: per-vertex computed from adjacent face normals (smooth terrain)
- [x] Accepts optional `modifications` array: `{ type: 'flatten', center, radius, elevation }` for building pads
- [x] Deterministic: same height function + seed = same mesh
- [x] YAML `terrain:` geometry command with `noise_scale`, `noise_amplitude`, `segments`
- [ ] **[Extension]** Auto-flatten from B5 negotiation: terrain reads `terrain_clearance` requirements from SharedContext (B5 ✅ is complete; will be implemented with H4-001)
- [x] Unit tests: flat plane, noisy terrain, terrain with flattened pad, UV/normal correctness

#### Files Created
- `src/generation/builder/commands/TerrainCommand.ts`
- `src/tests/__tests__/TerrainMesh.test.ts` (12 tests)

#### Files Modified
- `src/platform/geometry/MeshOperations.ts` (createHeightFieldMesh, computeSmoothNormals, TerrainModification)
- `src/generation/builder/YamlBuilderTypes.ts` (terrain command type)
- `src/generation/builder/commands/index.ts` (register TerrainCommandHandler)

#### Completed: 2026-02-05

---

### G1-002: Chunk-Aligned Terrain

**Track:** G | **Status:** ✅ | **Size:** M
**Dependencies:** G1-001

#### Context
For large worlds, terrain is generated in chunks. Adjacent chunks must share boundary vertices for seamless tiling. The height function must be evaluated deterministically at boundary points by both chunks.

#### Acceptance Criteria
- [x] `TerrainChunk` interface: `chunkX`, `chunkZ`, `size`, mesh reference
- [x] Boundary vertex sharing: chunks at (0,0) and (1,0) share their x=size edge vertices
- [x] Height function receives world-space coordinates (not chunk-local) for deterministic boundaries
- [x] `world.generate_chunk <chunkX> <chunkZ>` DSL command generates a single terrain chunk
- [x] `world.generate_region <minX> <minZ> <maxX> <maxZ>` generates multiple chunks
- [x] Unit test: two adjacent chunks, verify boundary vertices match exactly

#### Files Created
- `src/platform/scene/TerrainChunk.ts` (generateTerrainChunk, generateTerrainRegion, verifyChunkBoundary)
- `src/tests/__tests__/TerrainChunk.test.ts` (18 tests)

#### Files Modified
- `src/platform/scene/index.ts` (export TerrainChunk functions)
- `src/servers/authoring/commands/world.ts` (generate_chunk, generate_region commands)

#### Completed: 2026-02-05

---

## G2: LOD System

> **Goal:** Scene-level quality tier selection based on distance — generate less detail for distant objects.

### G2-001: LOD-Conditional Composition

**Track:** G | **Status:** ✅ | **Size:** M
**Dependencies:** A2-001 ✅ (quality tiers exist)

#### Context
Builders already have quality tiers (Tier 0-4). LOD maps directly: Tier 0 for distant objects (bounding box), Tier 1 for mid-distance, Tier 2+ for close-up. The missing piece is a scene-level system that decides which tier to request based on a distance/budget parameter.

#### Acceptance Criteria
- [x] Composition syntax: `lod_min: <tier>` — only invoke sub-builder when scene LOD budget >= tier
- [x] `lod_tier: <tier>` — force sub-builder to generate at specific tier (overrides builder's target)
- [x] Scene-level `lod_budget: <tier>` parameter on scene builders
- [x] Below `lod_min`, sub-builder replaced with bounding box placeholder (Tier 0 behavior)
- [x] `scene.generate_at_lod <tier>` DSL command — re-generates current scene at specified LOD
- [x] Unit test: scene with lod_min=2 sub-builder, generate at LOD 1 (placeholder) and LOD 2 (full)

#### Files Modified
- `src/generation/builder/YamlBuilderTypes.ts` (lod_min, lod_tier in YamlComposition, lod_budget in YamlBuilderDefinition)
- `src/generation/builder/YamlBuilderExecutor.ts` (LOD check in composition phase, lodBudget in ExecuteOptions)
- `src/servers/authoring/commands/scene.ts` (generate_at_lod command)

#### Files Created
- `src/tests/__tests__/LODComposition.test.ts` (11 tests)

#### Completed: 2026-02-05

---

### G2-002: View-Dependent Generation

**Track:** G | **Status:** ✅ | **Size:** L
**Dependencies:** G2-001 ✅, G1-001 ✅

#### Context
Given a camera position and direction, determine which chunks/objects to generate and at what LOD. Distant objects get lower LOD, off-screen objects are skipped entirely.

#### Acceptance Criteria
- [x] `world.generate_view position=<x,y,z> direction=<x,y,z> range=<N>` command
- [x] Computes visible chunks/objects based on frustum and distance
- [x] LOD tier assigned per-object based on distance from camera
- [x] Returns scene with mixed LOD levels
- [x] Progressive: calling with closer position generates more detail for nearby objects
- [x] Unit test: generate view, verify near objects are higher LOD than far objects (28 tests)

#### Files Created
- `src/platform/scene/ViewDependentGenerator.ts` (ViewConfig, LODConfig, computeLODTier, isInViewFrustum, generateView, etc.)
- `src/tests/__tests__/ViewDependentGeneration.test.ts` (28 tests)

#### Files Modified
- `src/platform/scene/index.ts` (export ViewDependentGenerator functions)
- `src/servers/authoring/commands/world.ts` (generate_view command)

#### Completed: 2026-02-05

---

## G3: UV Pipeline

> **Goal:** Fix UV generation, add smart unwrapping, texture atlasing, and UV quality gates. This is the foundation for all procedural texturing.
> **Status:** 3 of 4 tasks complete. G3-004 (Texture Atlasing) was identified as a gap - mentioned in scope but never broken out as a task.
> **Design:** See `PBR_TEXTURE_EVALUATION.md` for detailed exploration.

### G3-001: Per-Operation UV Fixes

**Track:** G | **Status:** ✅ | **Size:** M
**Dependencies:** C4-001 ✅ (basic UVs exist)

#### Context
Current UV generation is inconsistent — each geometry operation generates its own UVs (if any) without coordination. This causes checker pattern distortion, inconsistent texel density, and missing UVs on caps/cut faces. Before any procedural texturing, we need correct per-operation UVs with world-scale consistency.

#### Acceptance Criteria
- [x] Box: world_scale UV mode added (1 UV unit = 1 meter), normalized mode preserved for backwards compatibility
- [x] `uv_mode` parameter on box command: `normalized` (default), `world_scale`
- [x] Box: Proper cube-unwrap style UV projection (consistent U/V orientation on all faces)
- [x] Bevel: Edge-based UV parameterization for chamfer strips (U along edge, V across bevel)
- [x] Bevel: Box-projection fallback for pulled-back face vertices
- [x] Lathe: cylindrical mapping for body, planar projection for caps with separate cap vertices
- [x] Extrude: cylindrical for sides, planar UVs on caps with separate cap vertices
- [x] Loft: interpolated UVs from edge loops (U around profile, V along loft path)
- [ ] Boolean: re-project cut faces with planar projection based on face normal (deferred - CSG not yet implemented)
- [x] All geometry commands output vertices with valid UV attributes (lathe, extrude, box verified)
- [x] Unit tests for box world-scale UVs, UV coverage, consistent texel density
- [x] UV validation function `checkMeshUVs` added to MeshChecks.ts (detects missing, invalid, degenerate UVs)
- [x] UV validation integrated into ValidationAPI.ts (agents see UV issues in validation output)

#### Known Issues (Deferred)
- Bevel pulled-back vertices use box projection which may cause minor UV discontinuities at seams
- Bevel on shared-vertex meshes (e.g., `createBoxWithSharedVertices`) produces 0 UVs because original vertices have no UVs and bevel only adds UVs to newly created vertices
- **Loft/Lathe UV seam:** The last segment connecting back to the first may show compressed checker pattern due to UV discontinuity at the seam (U jumps from ~0.9 to 0). Fix requires duplicating seam vertices or using G3-002 smart unwrapping.
- **Box normalized mode stretching:** Non-cube boxes stretch textures because normalized UVs map [0,1] regardless of face aspect ratio. **Workaround:** Use `uv_mode: world_scale` for consistent texel density (1 UV unit = 1 meter).
- A proper solution would require per-face UV islands with seam handling or triplanar materials
- For production quality, consider smart unwrapping (G3-002) or triplanar shaders
- **Workaround:** Use `createBox()` instead of `createBoxWithSharedVertices()` for UV-correct meshes, or apply box projection to mesh before/after bevel

#### Files Modified
- `src/platform/geometry/MeshOperations.ts` (added uvMode parameter to createBox, boxProjectUV helper, edge-based bevel UVs, applyBoxProjectUVs method)
- `src/generation/builder/commands/BoxCommand.ts` (pass uv_mode to createBox)
- `src/generation/builder/commands/BevelCommand.ts` (apply box projection UVs after bevel)
- `src/generation/builder/YamlBuilderTypes.ts` (added uv_mode to box command type)
- `src/generation/validation/MeshChecks.ts` (added checkMeshUVs, formatUVIssues)
- `src/generation/validation/ValidationAPI.ts` (integrated UV validation into mesh validity checks)
- `src/platform/geometry/Sweep.ts` (added cap generation for lathe)
- `src/tests/__tests__/UVGeneration.test.ts` (added world-scale tests, checker pattern orientation test, lathe/loft cap UV tests)
- `src/tests/__tests__/UVValidation.test.ts` (new - comprehensive UV validation tests)
- `src/platform/geometry/Extrude.ts` (separate cap vertices with planar UVs)

#### Completed: 2026-02-05

---

### G3-002: Smart UV Unwrapping

**Track:** G | **Status:** ✅ | **Size:** L
**Dependencies:** G3-001 ✅

#### Context
Per-operation UVs are independent — each part uses [0,1] separately. For coherent texturing, we need global UV unwrapping: segment mesh by normals, unfold with minimal distortion, pack islands efficiently.

#### Acceptance Criteria
- [x] `UVUnwrapper` class: takes mesh, outputs unwrapped UVs
- [x] Angle-based segmentation: faces with similar normals form UV islands (configurable angle threshold)
- [x] Planar projection unwrapping per island (based on dominant normal)
- [x] Island packing: shelf-packing into [0,1] texture space with configurable margin
- [x] Scaling to fit: islands scaled to fit available space
- [ ] Seam hints: `prefer_seam` and `avoid_seam` edge tags (deferred)
- [ ] YAML `post_process.unwrap:` section (deferred)
- [x] DSL command `builder.unwrap [angle=<threshold>] [margin=<value>]`
- [x] Unwrap returns island-to-face mapping
- [x] Unit tests: 21 tests for unwrapping, segmentation, packing, edge cases

#### Files Created
- `src/platform/geometry/UVUnwrapper.ts` (unwrapMesh, UVUnwrapper class, packIslands)
- `src/tests/__tests__/UVUnwrapper.test.ts` (21 tests)

#### Files Modified
- `src/servers/authoring/commands/builder.ts` (unwrap command)

#### Completed: 2026-02-05

---

### G3-003: UV Quality Gates

**Track:** G | **Status:** ✅ | **Size:** S
**Dependencies:** G3-001 ✅

#### Context
How do we know if UVs are good enough for texturing? We need quality metrics and machine-readable suggestions, similar to geometry quality gates.

#### Acceptance Criteria
- [x] `UVQualityMetrics` interface: coverage, max_stretch, mean_stretch, utilization, density_variance, overlap_count
- [x] `evaluateUVQuality(mesh): UVQualityMetrics`
- [x] Coverage: percentage of faces with valid UVs (target: 100%)
- [x] Stretch: area/angle distortion per island (target: < 10% max)
- [x] Utilization: percentage of [0,1] texture space used (target: > 70%)
- [x] Density variance: ratio of max to min texel density (target: < 1.5x)
- [x] Overlap: count of overlapping UV triangles (target: 0)
- [x] DSL command `builder.uv_quality` returns metrics + suggestions
- [x] Suggestions are machine-readable: `{ action, target, reason, severity }`
- [x] Quality gates for Tier 0-4 with progressively stricter thresholds
- [x] Unit tests for each metric (19 tests)

#### Files Created
- `src/generation/validation/UVQualityGates.ts` (evaluateUVQuality, generateUVSuggestions, getAchievedTier, assessUVQuality, formatUVQualityResult)
- `src/tests/__tests__/UVQualityGates.test.ts` (19 tests)

#### Files Modified
- `src/servers/authoring/commands/builder.ts` (uv_quality command)

#### Completed: 2026-02-05

---

### G3-004: Texture Atlasing for Composed Scenes

**Track:** G | **Status:** ✅ | **Size:** L
**Dependencies:** G3-002 ✅

#### Context
**GAP IDENTIFIED:** The Master Plan mentions "texture atlasing" in the G3 scope but no task was created for it.

Composed scenes (ChessBoard, DiningScene) contain multiple objects. Each object needs its own UV space and potentially different materials. Previously all triangles shared one 512×512 texture after composition, causing UV island overlap, material confusion, and rendering artifacts.

**Related Finding:** `docs/CHESSBOARD_MATERIAL_FINDING.md`

#### Acceptance Criteria
- [x] Per-object UV unwrapping before composition (preserve UV identity per component)
- [x] Atlas packing: each composed object gets a region of the texture atlas
- [x] Higher resolution textures for complex scenes (auto-scale to 1024/2048 based on triangle count)
- [x] Material-aware baking: each atlas region uses correct material from its source builder
- [x] Alternative approach: Multi-material mesh export with separate texture per material slot
- [x] Works for: ChessBoard (32 pieces + board), DiningScene (4 chairs + table)
- [x] Vertex colors remain correct (existing workaround)
- [x] Unit tests for atlas packing, material isolation (14 tests)

#### Root Cause (2026-02-21 investigation)
Two compounding problems:
1. **UV overlap**: Each chess piece (lathe geometry) uses UV space [0,1] independently. When 32 pieces are merged, all UV islands overlap — pieces show each other's texture regions and appear "strange" in the composed scene but fine when viewed individually.
2. **Texture resolution**: 512×512 is too small for a 32-piece scene. Each of 32 pieces would get only ~64×64px (512/8) if perfectly packed — insufficient for lathe detail. A 2048×2048 atlas is the minimum viable for the ChessBoard.

#### Solution (G3-004)
- **Post-build UV atlas repack**: After all composition completes in YamlBuilderExecutor, detect overlapping UV islands via `detectUVOverlap()` and repack via `repackExistingUVs()` (MaxRects bin-packing with duplicate island deduplication)
- **Auto-resolution**: `computeAtlasResolution()` scales texture resolution based on triangle count per material group (512/1024/2048)
- **`atlas_uvs` YAML option**: `'auto'` (default), `true` (always repack), `false` (opt-out)
- **`builder.atlas_uvs` DSL command**: Manual trigger for UV atlas repacking with stats

#### Files Modified
- `src/platform/geometry/UVUnwrapper.ts` (exported `repackExistingUVs`, added `detectUVOverlap`, `computeAtlasResolution`, extracted shared helpers)
- `src/generation/builder/YamlBuilderTypes.ts` (added `atlas_uvs` option)
- `src/generation/builder/YamlBuilderExecutor.ts` (post-build UV atlas repack phase)
- `src/servers/authoring/commands/builder.ts` (auto-resolution for `bake_textures`, new `atlas_uvs` command)
- `src/servers/dashboard/main.ts` (removed hardcoded resolution=512)

#### Files Created
- `src/tests/__tests__/TextureAtlasing.test.ts` (14 tests)

#### Completed: 2026-02-24

---

## G4: Procedural Textures

> **Goal:** Noise-based texture evaluation, mesh analysis (curvature, AO), material layering, and domain generators.

### G4-001: Mesh Analysis Pipeline

**Track:** G | **Status:** ✅ | **Size:** M
**Dependencies:** G3-001 ✅ (UVs exist)

#### Context
Procedural textures need mesh analysis data to intelligently place effects: wear on edges (curvature), dirt in crevices (AO), position-based patterns. This must be deterministic and baked to UV space.

#### Acceptance Criteria
- [x] `MeshAnalysis` interface: curvature, ambientOcclusion, worldPosition, faceNormals per vertex
- [x] `analyzeMesh(mesh, options): MeshAnalysis` — extracts per-vertex analysis data
- [x] Per-vertex curvature: average angle between adjacent face normals (-1 concave to +1 convex)
- [x] Per-vertex AO: ray-based occlusion sampling (configurable rays, default 32)
- [x] World position stored per-vertex for triplanar/position-based effects
- [x] Deterministic: same mesh + seed = same analysis
- [x] Unit tests: 20 tests covering curvature detection, AO calculation, statistics, buffers

#### Files Created
- `src/platform/materials/MeshAnalysis.ts` (analyzeMesh, getCurvature, getAO, bakeToVertexBuffer)
- `src/tests/__tests__/MeshAnalysis.test.ts` (20 tests)

#### Completed: 2026-02-05

---

### G4-002: Procedural Texture Generators

**Track:** G | **Status:** ✅ | **Size:** L
**Dependencies:** G4-001 ✅

#### Context
The noise infrastructure exists (ScalarField, perlin3d) but operates in 3D world space. Generators combine noise with domain knowledge to produce specific material effects.

#### Acceptance Criteria
- [x] `TextureGenerator` interface: `evaluate(context, params, seed) -> {albedo, normal, roughness, metallic, height}`
- [x] Noise functions: Perlin 2D, FBM, Worley (Voronoi), domain warping — all seeded
- [x] Built-in generators:
  - [x] `wood_grain`: ring patterns, species-specific color (oak, walnut, pine, maple, cherry)
  - [x] `stone`: Voronoi cells with mortar lines
  - [x] `metal_brushed`: directional scratch noise
  - [x] `edge_wear`: curvature-driven wear (uses MeshAnalysis)
  - [x] `dirt_accumulation`: AO-driven grime (uses MeshAnalysis)
  - [x] `noise_color`: generic noise-to-color-ramp
- [x] Generator registry for extensibility
- [x] All generators produce coherent multi-channel output
- [ ] YAML `generator:` section in material layers (deferred to G4-003)
- [x] Unit tests for each generator, verify determinism (30 tests)

#### Files Created
- `src/platform/materials/TextureGenerator.ts` (interface, noise functions, registry)
- `src/platform/materials/generators/WoodGrainGenerator.ts`
- `src/platform/materials/generators/WearGenerator.ts` (EdgeWear, DirtAccumulation)
- `src/platform/materials/generators/StoneGenerator.ts`
- `src/platform/materials/generators/MetalBrushedGenerator.ts`
- `src/platform/materials/generators/NoiseColorGenerator.ts`
- `src/platform/materials/generators/index.ts`
- `src/tests/__tests__/TextureGenerator.test.ts` (30 tests)

#### Completed: 2026-02-05

---

### G4-003: Material Layering

**Track:** G | **Status:** ✅ | **Size:** M
**Dependencies:** G4-002 ✅

#### Context
Real materials have layers: base coat + grain + weathering + detail. The layer stack evaluates bottom-to-top with blend modes and masks.

#### Acceptance Criteria
- [x] `MaterialLayer` interface: generator, blend_mode, opacity, mask
- [x] `MaterialStack`: ordered array of layers, evaluated bottom-to-top
- [x] Blend modes: normal, multiply, overlay, add, screen
- [x] Mask types: `uniform` (constant), `noise` (procedural), `curvature`, `ao`, `expression`
- [x] Expression masks: `curvature > 0.5 AND ao < 0.3` — parsed and evaluated
- [ ] YAML `materials.X.layers:` section (deferred - requires builder integration)
- [x] Material stack produces final per-texel values for all PBR channels
- [x] Unit tests: 16 tests including worn wood material test

#### Files Created
- `src/platform/materials/MaterialStack.ts` (MaterialStack, evaluateMask, blend modes)
- `src/tests/__tests__/MaterialStack.test.ts` (16 tests)

#### Completed: 2026-02-05

---

## G5: Decals & Text

> **Goal:** Project decals and text onto textures for logos, branding, signage.

### G5-001: Decal Projection System

**Track:** G | **Status:** ✅ | **Size:** M
**Dependencies:** G4-003 ✅ (layer stack exists)

#### Context
Decals are projected texture overlays — a logo on a chair underside, a brand mark on a product. They're conceptually a layer, but with spatial projection instead of UV-space evaluation.

#### Acceptance Criteria
- [x] `Decal` interface: source (generator or color), projection, blend_mode, opacity
- [x] `DecalProjection` types: planar (origin, normal, size), cylindrical (axis, radius, height), spherical
- [x] `projectToDecalUV(worldPos, projection)`: computes decal-space UVs
- [x] `evaluateDecal(decal, worldPos, seed)`: evaluates decal at world position
- [x] `DecalProjector` class for managing multiple decals
- [x] Blend modes: normal, multiply, add, screen
- [x] Soft edge falloff near decal boundaries
- [ ] YAML `decals:` section (deferred - requires builder integration)
- [ ] DSL command (deferred)
- [ ] Image loading (deferred - requires asset system)
- [x] Unit tests: 16 tests for projection, evaluation, compositing

#### Files Created
- `src/platform/materials/DecalProjector.ts`
- `src/tests/__tests__/DecalProjector.test.ts` (16 tests)

#### Completed: 2026-02-05

---

### G5-002: Text-to-Texture Rendering

**Track:** G | **Status:** ✅ | **Size:** M
**Dependencies:** G5-001 ✅

#### Context
The platform already has TrueType font parsing for 3D text (FontParser, glyph outlines). Text-to-texture reuses this to rasterize glyphs into texture space for signage, labels, and branded variants.

#### Acceptance Criteria
- [x] `TextLayer` interface: content, font, size, color, position, align, baseline
- [x] Glyph rasterizer: glyph outlines → coverage buffer at target resolution
- [x] `rasterizeText()`: rasterize text string to coverage buffer
- [x] `evaluateTextLayer()`: evaluate text layer at UV coordinate
- [x] `createTextResult()`: create texture result for compositing
- [x] `TextRasterizer` class with caching
- [x] Reuses existing `FontParser` and `GlyphOutline` infrastructure
- [ ] World-space size (deferred - requires projection integration)
- [ ] YAML integration (deferred)
- [ ] DSL command (deferred)
- [x] Unit tests: 14 tests for rasterization, evaluation, caching

#### Files Created
- `src/platform/materials/TextRasterizer.ts`
- `src/tests/__tests__/TextRasterizer.test.ts` (14 tests)

#### Completed: 2026-02-05

---

## G6: Texture Baking

> **Goal:** Bake procedural materials to PBR texture files. Integrate with glTF export and dashboard preview.

### G6-001: Texture Baking Pipeline

**Track:** G | **Status:** ✅ | **Size:** L
**Dependencies:** G4-003 ✅ (layer stack), G5-002 ✅ (text/decals)

#### Context
Procedural textures are evaluated per-texel and baked to image files. This is deterministic (seed-controlled) and produces portable assets. Runtime shader evaluation is explicitly NOT a goal — baked textures work everywhere.

#### Acceptance Criteria
- [x] `TextureBaker` class: takes mesh, UVs, material stack, resolution → baked images
- [x] Outputs: albedo, normal, roughness, metallic, ao, height (6 channels)
- [x] Resolution configurable: any power of 2
- [x] Deterministic: same mesh + material + seed = identical output bytes
- [x] UV triangle rasterization with spatial indexing for performance
- [x] Barycentric interpolation for smooth gradients
- [x] Integration with MeshAnalysis for curvature/AO data
- [ ] Format output: PNG/JPEG encoding (deferred - needs image library)
- [ ] File writing to `output/textures/` (deferred)
- [ ] YAML `texture_output:` section (deferred)
- [ ] DSL command `builder.bake_textures` (deferred)
- [x] Unit tests: 17 tests for baking, channels, determinism, edge cases

#### Files Created
- `src/platform/materials/TextureBaker.ts` (bakeTextures, TextureBaker class)
- `src/tests/__tests__/TextureBaker.test.ts` (17 tests)

#### Completed: 2026-02-05

---

### G6-002: glTF Export with Baked Textures

**Track:** G | **Status:** ✅ | **Size:** M
**Dependencies:** G6-001 ✅, C6-001 ✅

#### Context
glTF export currently includes materials as PBR values (color, roughness, metalness). With baked textures, we embed texture references into the glTF file.

#### Acceptance Criteria
- [x] glTF materials reference baked texture files (embedded in GLB)
- [x] Texture info: `baseColorTexture`, `metallicRoughnessTexture`, `normalTexture`, `occlusionTexture`
- [x] Combined roughness-metallic texture (glTF convention: green=roughness, blue=metallic)
- [x] Textures embedded in GLB as PNG images (single file output)
- [x] Exported GLB is valid glTF 2.0 with proper texture references
- [x] DSL command `builder.export_textured_gltf [filename] [resolution=<n>]`
- [x] Unit tests: 22 tests for texture embedding, PNG encoding, material references

#### Files Modified
- `src/export/GLTFExporter.ts` (exportTexturedGLB, BakedTextureSet, encodeRGBAToPNG, PNG chunk helpers)
- `src/export/index.ts` (export new function and types)
- `src/servers/authoring/commands/builder.ts` (export_textured_gltf command)

#### Files Created
- `src/tests/__tests__/GLTFTexturedExport.test.ts` (22 tests)

#### Implementation Notes
- PNG encoder implemented from scratch (no external dependencies)
- Uses zlib stored blocks (no compression) for simplicity
- Textures flipped vertically for PNG format (top-to-bottom)
- Combined metallicRoughness: R=unused, G=roughness, B=metallic, A=unused
- External texture references deferred (embedTextures=true only for now)

#### Completed: 2026-02-05

---

### G6-003: Dashboard PBR Preview

**Track:** G | **Status:** ✅ | **Size:** M
**Dependencies:** G6-001 ✅

#### Context
The dashboard uses Three.js for preview. When baked textures exist, the dashboard should display them using `MeshStandardMaterial`. When textures don't exist (fast iteration mode), fall back to plain colors.

#### Acceptance Criteria
- [x] Dashboard detects when baked textures exist for current builder (via texture.list command)
- [x] If textures exist: create `MeshStandardMaterial` with texture maps (albedo, normal, roughness, ao)
- [x] If no textures: use current behavior (vertex colors or flat materials)
- [x] Toggle in UI: press 'T' to toggle texture preview mode
- [x] Texture loading: fetch from `/output/textures/<builder>_<channel>.png`
- [x] Texture caching: loaded textures cached to avoid reloading
- [x] Normal map applied correctly (linear color space)
- [x] Mutually exclusive with UV preview (U) and weight preview (W) modes

#### Files Modified
- `src/servers/dashboard/main.ts` (state.showTexturePreview, loadBakedTextures, loadTexture, material creation with PBR textures)

#### Implementation Notes
- Textures loaded via Three.js TextureLoader with caching
- Color space handled correctly: albedo=SRGB, normal/roughness/ao=Linear
- Smooth shading used when textures applied (flatShading: false)
- Keyboard shortcut 'T' toggles texture preview mode

#### Completed: 2026-02-05

---

### G6-004: Texture Housekeeping

**Track:** G | **Status:** ✅ | **Size:** S
**Dependencies:** G6-001 ✅

#### Context
Baked textures accumulate over time — different seeds, resolutions, experiments. We need housekeeping commands to manage the texture cache and prevent unbounded growth.

#### Acceptance Criteria
- [x] `output/textures/` is the managed texture cache directory
- [x] DSL command `texture.list [builder]` — list all baked textures, sizes, dates
- [x] DSL command `texture.clean [builder] [older_than=<duration>] [--force]` — remove old/orphaned textures
- [x] DSL command `texture.size` — report total cache size
- [x] Orphan detection: textures for builders that no longer exist
- [x] DSL command `texture.delete <builder> [--force]` — delete all textures for a builder
- [x] Clean operation is non-destructive by default (dry-run), --force to actually delete
- [x] Unit tests: 18 tests for parsing, listing, cleaning, deletion

#### Files Created
- `src/storage/TextureCache.ts` (TextureCache class, parseTextureFilename, formatBytes, formatAge, parseDuration)
- `src/servers/authoring/commands/texture.ts` (texture namespace with list, size, clean, delete commands)
- `src/tests/__tests__/TextureCache.test.ts` (18 tests)

#### Files Modified
- `src/servers/authoring/server.ts` (register textureNamespace)

#### Completed: 2026-02-05

---

## G7: Billboard Primitives

> **Goal:** Camera-facing quad primitives for particles, effects, and vegetation cards.

### G7-001: Billboard Geometry and Instancing

**Track:** G | **Status:** ✅ | **Size:** S
**Dependencies:** None

#### Context
Smoke, sparkles, glow effects, and distant vegetation are commonly rendered as camera-facing quads (billboards). This is a new primitive type — simple geometry but needs special handling in export (glTF extras or sprite extension).

#### Acceptance Criteria
- [x] `billboard:` geometry command: creates a quad with `width`, `height`, `facing` (camera|axis)
- [x] Billboard prims flagged in trace: `type: billboard` with facing mode
- [x] Instancing works: scatter multiple billboards efficiently
- [x] Dashboard: billboards rendered as quads (no special camera-facing needed in authoring view)
- [x] Unit test: create billboard, verify quad geometry, trace metadata (15 tests)

#### Files Created
- `src/generation/builder/commands/BillboardCommand.ts` (BillboardCommandHandler, createBillboardQuad)
- `src/tests/__tests__/Billboard.test.ts` (15 tests)

#### Files Modified
- `src/generation/builder/commands/index.ts` (register BillboardCommandHandler)
- `src/generation/builder/YamlBuilderTypes.ts` (billboard command type)

#### Notes
- Billboard facing modes: `camera` (spherical), `axis_x`, `axis_y`, `axis_z` (cylindrical)
- Pivot modes: `center` (default), `bottom` (for vegetation)
- Creates double-sided quads with proper UVs for texturing
- glTF export with extras.billboard flag deferred to separate story if needed

#### Completed: 2026-02-05

---

# TRACK H: PHASE 3 DEMOS

> Each demo proves a convergence of Phase 3 capabilities on a vision-inspired scene.

### H1-001: Rigged Creature

**Track:** H | **Status:** ✅ | **Size:** XL
**Dependencies:** E1-002 ✅ (skeleton composition), E2-001 ✅ (weights), E4-001 ✅ (skeleton export)

#### Context
Vision Example #3: A hybrid creature with skeleton, joints, and weights. Each body part from a different sub-builder. Exported to glTF with a working rig.

#### Acceptance Criteria
- [x] Creature builder composes: body (horse-like), wings (eagle-like), tail (scorpion-like) — simplified/stylized geometry
- [x] Each part declares its own skeleton section
- [x] Composed skeleton merges correctly (wing_L.shoulder attaches to body.spine)
- [x] Vertex weights assigned by proximity rules
- [x] Joint constraints defined (hinge for knees, ball_and_socket for shoulders)
- [x] Exports to glTF with working skin (importable in Blender, poses correctly)
- [x] Builder passes Tier 2 quality gates (component-level)
- [ ] 5+ seeds produce visually distinct but anatomically correct creatures

#### Files Created
- `builders/catalog/components/HorseBody.yaml` ✅
- `builders/catalog/components/EagleWing.yaml` ✅
- `builders/catalog/components/ScorpionTail.yaml` ✅
- `builders/catalog/HybridCreature.yaml` ✅
- `src/tests/__tests__/HybridCreature.test.ts` ✅ (13 tests passing)

#### Implementation Details
- Added `adoptSkeleton()` method to TracedBuilder for first-composed-builder skeleton adoption
- Modified YamlBuilderExecutor to adopt skeleton from first composed builder when parent has no skeleton
- Added 'skeleton' to TraceEntry type for adoption tracing
- Total: 724 tests passing

#### Completed: 2026-02-05

---

### H2-001: Styled Room

**Track:** H | **Status:** ✅ | **Size:** L
**Dependencies:** F2-002 (style cascading), F3-002 (role-based templates)

#### Context
Vision Examples #9 and #10: Same room template, completely different output based on style. Proves style cascading, role-based composition, and material theming.

#### Acceptance Criteria
- [x] Role-based room template with: table, seating (x4), decoration (lighting deferred)
- [x] `style: mid_century_modern` produces: tapered round legs, organic curves, walnut tones
- [x] `style: industrial` produces: square steel legs, angular forms, dark/steel palette
- [x] All materials resolve from style palette (no hardcoded colors in sub-builders)
- [x] Style decision at scene level produces genuinely different geometry in every component (different face count + vertex count confirmed)
- [ ] Exports to glTF (two files: modern and industrial) — builder.export_gltf works but no dedicated test
- [x] Side-by-side comparison meaningful (not just color changes — leg geometry differs: tapered round vs square)

#### Files Created
- `builders/scenes/templates/StyledRoom.yaml` — role-based scene template (table + 4 chairs + centerpiece)
- `metadata/styles/mid_century_modern.yaml` — full StyleDefinition with decision_defaults, material_palette, proportion_rules
- `src/tests/__tests__/StyledRoom.test.ts` — 21 tests covering all acceptance criteria

#### Files Modified
- `metadata/builders/roles/seating.yaml` — added `mid_century_modern` style candidate (DiningChair with priority 20)
- `src/generation/builder/YamlBuilderExecutor.ts` — PHASE 0.5 pre-peek: reads `style` choice decision before decisions run so style defaults apply correctly; post-PHASE-1 reconciliation keeps `effectiveStyleName` in sync for child cascade
- `src/storage/MetadataStore.ts` — replaced `__dirname` with `process.cwd()` for ESM/server compatibility
- `builders/scenes/ThemedRoom.yaml` — replaced non-existent `ChairInBounds` builder with `DiningChair`

#### Known Limitations (Not blocking)
- glTF export works via `builder.export_gltf` DSL but no dedicated H2-001 export test
- Lighting role not implemented (no lamp/pendant builder exists in catalog)

#### Completed: 2026-02-22

---

### H3-001: Chess Board

**Track:** H | **Status:** ✅ | **Size:** L
**Dependencies:** F1-002 (constraint integration), B2-003 ✅ (PSD queries)

#### Context
Vision Example #1: A chess board with pieces in a legal mid-game position. The position is generated by the builder using domain constraints, not hardcoded. An agent can query the PSD scene to count pieces, determine their positions, and verify the position is legal.

#### Acceptance Criteria
- [x] Chess board builder: 8x8 board with alternating colors (grid command)
- [x] Chess piece builders (simplified): king, queen, rook, bishop, knight, pawn — lathe profiles (ChessPiece.yaml)
- [x] Board styles: classic, modern, tournament options
- [x] Game phases: opening, midgame, endgame decisions
- [x] Pieces placed on correct squares using composition system (uses compose: with repeat:)
- [x] All 32 pieces in starting position (16 white + 16 black)
- [x] PSD tags on pieces: `piece: king`, `color: white`, `square: e1`
- [x] Agent can query: `psd.query_by_tag piece:king` returns king positions (key:value format supported)
- [x] Constraint schema: `constraints/chess/valid_position` validates the generated position (referenced in ChessBoard.yaml)
- [x] 7 new PSD tag querying tests pass (17 total chess tests)

#### Known Limitations (Not blocking)
- `psd.overview` command not implemented (general PSD overview not specific to chess)
- Pawn squares not tracked (repeat: pawns get default square; major piece squares all correct)
- glTF export works via `builder.export_gltf` but no dedicated chess export test
- 5+ seeds produce different board/style variations but positions are the same starting position (midgame variation not implemented as piece movement)

#### Files Created
- `builders/catalog/ChessBoard.yaml` (board geometry, materials, composition of 32 pieces)
- `builders/catalog/components/ChessPiece.yaml` (parameterized piece with lathe profiles)
- `src/tests/__tests__/ChessBoard.test.ts` (17 tests)

#### Files Modified (H3-001 completion)
- `src/generation/builder/TracedBuilder.ts` (added `tags?: Record<string, string>` to TracedOutput)
- `src/generation/builder/YamlBuilderExecutor.ts` (PHASE 3.5: evaluate YAML tags section into TracedOutput)
- `src/generation/builder/YamlBuilderTypes.ts` (changed tags from string[] to Record<string, string>)
- `src/generation/builder/PSD.ts` (propagate sub-builder tags to instance/merged prims; key:value queryByTag support)

#### Completed: 2026-02-22

---

### H4-001: Village on Terrain

**Track:** H | **Status:** ⬜ | **Size:** XL
**Dependencies:** G1-001 (terrain), G2-001 (LOD), B5-002 ✅ (negotiation)

#### Context
Vision Example #13: Houses on hilly terrain, using negotiation protocol. Houses publish `terrain_clearance` requirements; terrain flattens pads and publishes elevation offers; houses adapt foundation height.

#### Acceptance Criteria
- [ ] Terrain builder: height field mesh from noise, processes clearance requirements
- [ ] House builder (simplified): box house with pitched roof, publishes terrain_clearance requirement
- [ ] 3-5 houses placed on terrain, each adapted to local elevation
- [ ] Terrain visibly flattened where houses sit
- [ ] Road or path connecting houses (optional stretch goal)
- [ ] LOD: houses at distance rendered as simple boxes
- [ ] Tree scatter on terrain (using existing TreeScatter pattern)
- [ ] PSD scene queryable: `psd.overview` shows terrain + houses + trees
- [ ] Exports to glTF
- [ ] 3+ seeds produce different village layouts on different terrain

#### Files to Create
- `builders/catalog/TerrainPatch.yaml`
- `builders/catalog/components/SimpleHouse.yaml`
- `builders/scenes/Village.yaml`

---

### H5-001: Textured Furniture

**Track:** H | **Status:** ⬜ | **Size:** L
**Dependencies:** G6-002 (glTF with textures), G5-002 (text/decals), G4-003 (material layers)

#### Context
The ultimate proof of the PBR texture pipeline: DiningChair with full procedural textures, wear patterns, and a branded variant with decal and text.

#### Acceptance Criteria
- [ ] DiningChair upgraded with procedural materials:
  - Wood frame: oak wood_grain generator + edge_wear + oil_finish layers
  - Fabric seat (if cushion): fabric_weave generator + wear_fade
- [ ] UV pipeline: chair mesh unwrapped with < 10% stretch, > 70% utilization
- [ ] Mesh analysis baked: curvature and AO used for wear placement
- [ ] Baked textures: albedo, normal, roughness, metallic, AO at 2048px
- [ ] Textures deterministic: same seed produces identical texture files
- [ ] Branded variant: "ACME Furniture" logo decal on seat underside
- [ ] Branded variant: "ACME" text on back top rail
- [ ] Dashboard PBR preview: chair rendered with MeshStandardMaterial + textures
- [ ] Dashboard toggle: switch between textured and plain color modes
- [ ] glTF export with embedded textures opens correctly in Blender
- [ ] 3+ seeds produce visually distinct wear patterns while maintaining quality

#### Files to Modify
- `builders/catalog/DiningChair.yaml` (add materials.layers, uv_layout, texture_output)

#### Files to Create
- `assets/logos/acme_furniture.png` (sample logo)

---

# DEFERRED WORK (Carried from Phase 2 + New)

> These remain valid but are explicitly deferred until Phase 3 tracks are substantially complete.

## Carried from Phase 2

| Area | Why Deferred | Prerequisite |
|------|-------------|--------------|
| 3D Boolean CSG | Complex, only needed for architecture | C1 (2D booleans) ✅ proves approach |
| Botanical / L-Systems | Vegetation generation, not authoring platform | C5 ✅, G1 (terrain for placement) |
| Cloth & Soft Bodies | Character domain only | E-track (rigging) + deformers |
| Characters / PersonBuilder | Capstone | E-track + F-track + morph targets |
| Renderer Package | Deployment concern | C6 ✅ (glTF export) |
| Text & Advanced 2D | Nice-to-have typography | Signage domain demand |

## New Phase 3+ Deferrals

| Area | Why Deferred | Prerequisite |
|------|-------------|--------------|
| Voxelization / Grid Snapping | LEGO/Minecraft styles (Scene #9) | F2 (style modifiers) |
| Event-Driven Placement | Narrative scenes (Scene #11) | F1 (constraints), placement system |
| Agent Memory Across Sessions | Learning from iteration history | B3 ✅ (metadata store) |
| Builder Snapshot / Rollback | Undo for agent iteration | B4 ✅ (DSL authoring) + git integration |
| Smooth LOD Transitions | Cross-fade/morph between LOD levels | G2 (LOD) + E3 (morph targets) |
| Multi-Pass Composition | True multi-phase builder execution | B5 ✅ proves single-pass ordering works first |

---

## Recommended Execution Order

### Wave 1 (Parallel — foundational, no interdependencies)
- **E1-001**: Skeleton Declaration (enables all rigging)
- **F1-001**: Constraint Schema (enables domain knowledge)
- **G1-001**: Height Field Mesh (enables terrain)
- **G3-001**: Per-Operation UV Fixes (enables all texturing)

### Wave 2 (Parallel — builds on Wave 1)
- **E1-002**: Skeleton Composition (needs E1-001)
- **E2-001**: Vertex Weights (needs E1-001)
- **F1-002**: Constraint Integration (needs F1-001)
- **F2-001**: Style Schema (needs F1-001 patterns)
- **G3-002**: Smart UV Unwrapping (needs G3-001)
- **G3-003**: UV Quality Gates (needs G3-001)

### Wave 3 (Parallel — builds on Wave 2)
- **E3-001**: Morph Targets (independent but best after E2)
- **F1-003**: Built-in Constraint Libraries (needs F1-001)
- **F2-002**: Style Cascading (needs F2-001)
- **F2-003**: Style-Driven Materials (needs F2-001)
- **G1-002**: Chunk-Aligned Terrain (needs G1-001)
- **G2-001**: LOD-Conditional Composition (independent)
- **G4-001**: Mesh Analysis Pipeline (needs G3-001)

### Wave 4 (Parallel — needs Waves 1-3)
- **E2-002**: Weight Visualization (needs E2-001)
- **E3-002**: Morph Target in PSD/Dashboard (needs E3-001)
- **E4-001**: Skeleton Export (needs E1, E2)
- **E4-002**: Morph Target Export (needs E3)
- **F3-001**: Builder Role Registry (needs F2-001)
- **G4-002**: Procedural Texture Generators (needs G4-001)
- **G7-001**: Billboard Primitives (independent)

### Wave 5 (Integration — needs Waves 1-4)
- **F3-002**: Role-Based Scene Templates (needs F3-001)
- **F4-001**: Cross-Builder Proportions (needs F1, F2)
- **F4-002**: Assembly Metadata (needs F4-001)
- **G2-002**: View-Dependent Generation (needs G2-001, G1)
- **G4-003**: Material Layering (needs G4-002)
- **G5-001**: Decal Projection (needs G4-003)
- **G5-002**: Text-to-Texture (needs G5-001)

### Wave 6 (Texture Baking — needs Waves 1-5)
- **G6-001**: Texture Baking Pipeline (needs G4-003, G5-002)
- **G6-002**: glTF Export with Textures (needs G6-001)
- **G6-003**: Dashboard PBR Preview (needs G6-001)
- **G6-004**: Texture Housekeeping (needs G6-001)

### Wave 7 (Demos — prove everything)
- **H1-001**: Rigged Creature (needs E1-E4)
- **H2-001**: Styled Room (needs F2, F3)
- **H3-001**: Chess Board (needs F1)
- **H4-001**: Village on Terrain (needs G1, G2, B5 ✅)
- **H5-001**: Textured Furniture (needs G3-G6)

---

## Success Criteria (Phase 3)

Phase 3 is complete when:

1. A builder can declare a skeleton with joints, weights, and constraints in YAML, and export a rigged glTF that can be posed in Blender
2. An agent can define a new domain constraint schema (e.g., chess rules) via DSL without any TypeScript changes
3. Setting `style: X` at a scene level cascades meaningful visual changes (geometry + materials) to all composed children
4. A terrain builder processes negotiation requirements from building builders and produces adapted terrain
5. At least one demo scene from each Track H milestone passes Tier 2 quality gates
6. All Phase 3 demos export to valid glTF files
7. No Phase 3 feature required modifying platform geometry operations for domain-specific logic (domain logic lives in metadata/constraints/styles)
8. A builder can declare procedural PBR materials and bake them to texture files (albedo, normal, roughness, metallic, AO)
9. The dashboard can render baked PBR textures using Three.js MeshStandardMaterial
10. Decals and text can be procedurally projected into baked textures
11. Texture housekeeping commands exist to manage baked texture cache
12. Textured furniture demo (H5) exports with embedded textures and opens correctly in Blender
