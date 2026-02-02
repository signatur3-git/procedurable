# Procedurable Backlog

> **Version:** 3.0 (2026-02-03 — Phase 3 planning)
> **Purpose:** Tactical work items for AI coding agents and human developers.
> **Strategy:** See `MASTER_PLAN.md` for vision and track definitions.
> **Quality:** See `QUALITY_TIERS.md` for tier definitions and gate criteria.
> **Phase 2 Archive:** See `BACKLOG_PHASE2_ARCHIVE.md` for completed Phase 2 work (49/51 stories).

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
| D3-001: Gear at Tier 2 | D | 🟡 Partial | Passes gates; needs involute teeth |
| D4-001: Furnished Room at Tier 2 | D | ⬜ | Integration proof; depends on Table fix |

---

## Quick Status

| Track | Milestone | Stories | Done | Status |
|-------|-----------|---------|------|--------|
| E: Rigging | E1: Skeleton Declaration | 2 | 0 | ⬜ |
| E: Rigging | E2: Vertex Weights | 2 | 0 | ⬜ |
| E: Rigging | E3: Morph Targets | 2 | 0 | ⬜ |
| E: Rigging | E4: glTF Skeleton Export | 2 | 0 | ⬜ |
| F: Knowledge | F1: Executable Constraints | 3 | 0 | ⬜ |
| F: Knowledge | F2: Style Definitions | 3 | 0 | ⬜ |
| F: Knowledge | F3: Role-Based Composition | 2 | 0 | ⬜ |
| F: Knowledge | F4: Cross-Builder Constraints | 2 | 0 | ⬜ |
| G: World | G1: Height Field Mesh | 2 | 0 | ⬜ |
| G: World | G2: LOD System | 2 | 0 | ⬜ |
| G: World | G3: UV Pipeline | 3 | 0 | ⬜ |
| G: World | G4: Procedural Textures | 3 | 0 | ⬜ |
| G: World | G5: Decals & Text | 2 | 0 | ⬜ |
| G: World | G6: Texture Baking | 3 | 0 | ⬜ |
| G: World | G7: Billboard Primitives | 1 | 0 | ⬜ |
| H: Demos | H1: Rigged Creature | 1 | 0 | ⬜ |
| H: Demos | H2: Styled Room | 1 | 0 | ⬜ |
| H: Demos | H3: Chess Board | 1 | 0 | ⬜ |
| H: Demos | H4: Village on Terrain | 1 | 0 | ⬜ |
| H: Demos | H5: Textured Furniture | 1 | 0 | ⬜ |

**Total: 39 stories, 0 complete**

---

# TRACK E: RIGGING & ANIMATION DATA

## E1: Skeleton Declaration

> **Goal:** Builders declare joint hierarchies as structured data in YAML. Skeleton data flows through TracedOutput and PSD to export.

### E1-001: Skeleton Schema and Builder Support

**Track:** E | **Status:** ⬜ | **Size:** L
**Dependencies:** None (PSD already stubs `skeleton: null`)

#### Context
The PSD format already stubs `skeleton: null` and `jointWeights: []` on mesh prims (B2-001). This story fills those stubs with real data. A skeleton is a hierarchy of joints, each with a name, parent, rest-pose transform, and optional constraints. Builders declare this in YAML; the executor processes it into TracedOutput; PSD serialization preserves it.

This is the foundation for rigging — without it, exported models are static geometry only.

#### Acceptance Criteria
- [ ] `skeleton:` section in YAML builder format: array of joints
- [ ] Each joint: `name`, `parent` (name or null for root), `position` (relative to parent), `orientation` (euler angles, default 0,0,0)
- [ ] Optional joint constraints: `type` (hinge, ball_and_socket, fixed), `limits` (min/max angles per axis)
- [ ] Joint positions support expressions (`$measurement_name`, arithmetic)
- [ ] `TracedSkeleton` interface in TracedBuilder with joint hierarchy
- [ ] Skeleton data included in TracedOutput
- [ ] PSD `skeleton` field on mesh prims populated from TracedSkeleton
- [ ] `PSDJoint` interface: name, parent, restTransform, constraints
- [ ] DSL command `builder.skeleton` returns joint hierarchy for active builder
- [ ] Unit tests for skeleton parsing, expression evaluation, hierarchy validation
- [ ] Validation: no duplicate joint names, parent references valid, no cycles

#### Files to Modify
- `src/generation/builder/YamlBuilderTypes.ts` (YamlJoint, YamlSkeleton interfaces)
- `src/generation/builder/YamlBuilderExecutor.ts` (new phase for skeleton processing)
- `src/generation/builder/TracedBuilder.ts` (TracedSkeleton, joint registration)
- `src/generation/builder/PSD.ts` (PSDJoint, fill skeleton field on PSDMeshPrim)
- `src/servers/authoring/commands/builder.ts` (builder.skeleton command)

#### Notes
Joint positions should be derived from measurements where possible: "shoulder joint is at (shoulder_width/2, shoulder_height, 0)". This makes the skeleton parametric — change the measurements, skeleton adapts.

Example YAML:
```yaml
skeleton:
  - name: root
    position: { x: 0, y: 0, z: 0 }
  - name: spine
    parent: root
    position: { x: 0, y: '$hip_height', z: 0 }
  - name: neck
    parent: spine
    position: { x: 0, y: '$torso_height', z: 0 }
  - name: shoulder_L
    parent: spine
    position: { x: '$shoulder_width / 2', y: '$torso_height * 0.9', z: 0 }
    constraints:
      type: ball_and_socket
      limits: { pitch: [-90, 180], yaw: [-90, 90], roll: [-45, 45] }
  - name: elbow_L
    parent: shoulder_L
    position: { x: '$upper_arm_length', y: 0, z: 0 }
    constraints:
      type: hinge
      axis: z
      limits: { min: 0, max: 145 }
```

---

### E1-002: Skeleton Composition

**Track:** E | **Status:** ⬜ | **Size:** M
**Dependencies:** E1-001

#### Context
When builders compose (horse body + eagle wings + scorpion tail), each sub-builder has its own skeleton. The composed skeleton must merge — child joint hierarchies attach at specified parent joints, transforms adjusted by composition offset.

#### Acceptance Criteria
- [ ] When composing a builder that has a skeleton, child skeleton merges into parent skeleton
- [ ] Composition syntax: `skeleton_attach: <parent_joint_name>` specifies which parent joint the child's root connects to
- [ ] Child joint positions adjusted by composition transform (offset, rotation)
- [ ] Joint name conflicts resolved by prefixing with builder name (`wing_L.shoulder` instead of `shoulder`)
- [ ] Composed PSD scene has merged skeleton across composed prims
- [ ] Unit test: compose two builders with skeletons, verify merged hierarchy

#### Files to Modify
- `src/generation/builder/YamlBuilderTypes.ts` (skeleton_attach in YamlComposition)
- `src/generation/builder/YamlBuilderExecutor.ts` (skeleton merge in composition phase)
- `src/generation/builder/TracedBuilder.ts` (mergeSkeleton method)
- `src/generation/builder/PSD.ts` (merged skeleton in serialization)

---

## E2: Vertex Weights

> **Goal:** Rule-based vertex weight assignment — no manual weight painting.

### E2-001: Weight Rules and Assignment

**Track:** E | **Status:** ⬜ | **Size:** L
**Dependencies:** E1-001

#### Context
Each vertex needs influence weights for one or more bones. Instead of manual painting, builders declare rules: "vertices within Ncm of joint X are influenced by bone Y with distance falloff." The system evaluates these rules against the mesh and skeleton to produce weights.

#### Acceptance Criteria
- [ ] `weights:` section in YAML builder format: array of weight rules
- [ ] Rule types: `proximity` (distance from joint, with falloff), `region` (bounding box/sphere), `gradient` (linear blend between two joints)
- [ ] `proximity` rule: `joint: <name>, radius: <N>, falloff: linear|smooth|sharp`
- [ ] `region` rule: `joint: <name>, min: {x,y,z}, max: {x,y,z}, weight: <0-1>`
- [ ] `gradient` rule: `joint_a: <name>, joint_b: <name>, axis: <x|y|z>` — linear blend along axis
- [ ] Weight normalization: per-vertex weights sum to 1.0
- [ ] Max 4 influences per vertex (standard for real-time; drop lowest)
- [ ] `VertexWeights` data structure: sparse array of `{jointIndex, weight}` per vertex
- [ ] Weights stored on PSD mesh prims in `jointWeights` field
- [ ] DSL command `builder.weights` shows weight statistics (coverage, max influences, unweighted vertices)
- [ ] Unit tests for each rule type, normalization, max-influence clamping

#### Files to Modify
- `src/generation/builder/YamlBuilderTypes.ts` (YamlWeightRule interfaces)
- `src/generation/builder/YamlBuilderExecutor.ts` (weight computation phase, after skeleton)
- `src/generation/builder/TracedBuilder.ts` (VertexWeights storage)
- `src/generation/builder/PSD.ts` (jointWeights serialization)
- `src/servers/authoring/commands/builder.ts` (builder.weights command)

#### Notes
Weight computation is O(vertices * joints * rules) but tractable for procedural meshes (typically <10K vertices). Proximity is the most common rule — start there, add region and gradient later if needed.

---

### E2-002: Weight Visualization

**Track:** E | **Status:** ⬜ | **Size:** S
**Dependencies:** E2-001

#### Context
Agents and humans need to see weight assignments to debug skinning issues. Dashboard shows a heat-map overlay when a joint is selected.

#### Acceptance Criteria
- [ ] Dashboard keyboard shortcut 'W' toggles weight visualization mode
- [ ] In weight mode, vertex colors replaced by weight heat map (blue=0, red=1)
- [ ] Click/select a joint name to see weights for that specific joint
- [ ] DSL command `builder.show_weights <joint_name>` returns per-vertex weight data
- [ ] Unweighted vertices highlighted in magenta (error color)

#### Files to Modify
- `src/servers/dashboard/main.ts` (weight visualization mode)
- `src/servers/authoring/commands/builder.ts` (show_weights command)

---

## E3: Morph Targets

> **Goal:** Named vertex offset sets that blend between mesh variants. Foundation for character variation and LOD blending.

### E3-001: Morph Target System

**Track:** E | **Status:** ⬜ | **Size:** L
**Dependencies:** None (operates on Mesh, independent of skeleton)

#### Context
A morph target (blend shape) is a set of per-vertex position offsets from a base mesh. Blending is linear interpolation of offsets. This enables: character body variation (lean to stocky), facial expressions, LOD transitions, and procedural variation from archetypes.

glTF supports morph targets natively, making this directly exportable.

#### Acceptance Criteria
- [ ] `MorphTarget` class: name, vertex offsets (sparse — only store non-zero deltas)
- [ ] `MorphTargetSet`: base mesh + named targets + validation (vertex count match)
- [ ] `MeshOperations.applyMorphTargets(base, targets[], weights[])` returns blended mesh
- [ ] Blending is additive: `result[i] = base[i] + sum(targets[j][i] * weights[j])`
- [ ] `MeshOperations.createMorphTarget(base, variant, name)` computes delta from two topology-matching meshes
- [ ] Topology validation: base and variant must have identical vertex count and face connectivity
- [ ] YAML `morph_targets:` section: declare named targets as references to other builder outputs or inline offsets
- [ ] DSL command `geometry.blend <target_name> weight=<0-1>` applies morph in geometry pipeline
- [ ] Unit tests: create target, apply single target, apply multiple targets, topology mismatch error

#### Files to Modify
- `src/platform/geometry/MorphTarget.ts` (new — MorphTarget, MorphTargetSet classes)
- `src/platform/geometry/MeshOperations.ts` (applyMorphTargets, createMorphTarget)
- `src/platform/geometry/index.ts` (export)
- `src/generation/builder/YamlBuilderTypes.ts` (morph_targets section)
- `src/generation/builder/YamlBuilderExecutor.ts` (morph target processing)

#### Notes
The simplest morph target is computed by diffing two meshes with identical topology. The YAML format should support both:
1. **Inline:** explicit vertex offsets (for small adjustments)
2. **Reference:** "use the mesh from builder X with decisions Y as variant" — system runs both builders, diffs the meshes

Start with inline offsets; reference-based targets can be added in a follow-up.

---

### E3-002: Morph Target in PSD and Dashboard

**Track:** E | **Status:** ⬜ | **Size:** M
**Dependencies:** E3-001

#### Context
Morph targets should be visible in PSD format and controllable in the dashboard for preview.

#### Acceptance Criteria
- [ ] PSD mesh prims include `morphTargets` field: array of `{name, offsets}`
- [ ] Dashboard slider UI for morph target weights (when targets present)
- [ ] Slider changes trigger re-render with blended mesh
- [ ] DSL command `builder.morph_targets` lists available targets with vertex count

#### Files to Modify
- `src/generation/builder/PSD.ts` (morphTargets on PSDMeshPrim)
- `src/servers/dashboard/main.ts` (morph target slider UI)
- `src/servers/authoring/commands/builder.ts` (morph_targets command)

---

## E4: glTF Skeleton Export

> **Goal:** Extend C6 glTF exporter to include skins, joints, weights, and morph targets.

### E4-001: Skeleton and Skin Export

**Track:** E | **Status:** ⬜ | **Size:** L
**Dependencies:** E1-001, E2-001, C6-001 ✅

#### Context
The current glTF exporter (C6) outputs geometry, materials, and UVs. This story adds the skin, joints, and inverse bind matrices needed for rigged models. A rigged glTF model can be imported into Blender, Unity, Unreal, or any glTF viewer and posed/animated.

#### Acceptance Criteria
- [ ] glTF export includes `skins` array with joint references and inverse bind matrices
- [ ] Joint nodes added to glTF scene hierarchy with rest-pose transforms
- [ ] Joint constraints exported as glTF extras (not standard glTF, but preserved)
- [ ] Vertex weights exported as `JOINTS_0` and `WEIGHTS_0` accessors (4 influences max)
- [ ] Validates in glTF validator (khronos reference validator)
- [ ] DSL command `builder.export_rigged_gltf [filename]` exports rigged model
- [ ] Unit test: export rigged model, verify skin/joint/weight structure in GLB

#### Files to Modify
- `src/export/GLTFExporter.ts` (extend with skin, joint, weight export)
- `src/servers/authoring/commands/builder.ts` (export_rigged_gltf command)

#### Notes
Inverse bind matrices are computed from the rest-pose joint transforms. Each joint's IBM is the inverse of its world-space transform. This converts vertex positions from model space to joint-local space for skinning.

---

### E4-002: Morph Target Export

**Track:** E | **Status:** ⬜ | **Size:** M
**Dependencies:** E3-001, C6-001 ✅

#### Context
glTF 2.0 natively supports morph targets via the `targets` array on mesh primitives. Each target is an accessor for position offsets (and optionally normal/tangent offsets).

#### Acceptance Criteria
- [ ] glTF mesh primitives include `targets` array when morph targets are present
- [ ] Each target is a set of `POSITION` delta accessors
- [ ] `mesh.weights` array provides default blend weights
- [ ] Target names stored in `mesh.extras.targetNames` (glTF convention)
- [ ] Validates in glTF validator
- [ ] Unit test: export model with morph targets, verify target structure

#### Files to Modify
- `src/export/GLTFExporter.ts` (morph target export)

---

# TRACK F: KNOWLEDGE & STYLE SYSTEM

## F1: Executable Constraints

> **Goal:** Extend the metadata store from key-value lookup to support executable constraint schemas that enforce domain rules.

### F1-001: Constraint Schema Definition

**Track:** F | **Status:** ⬜ | **Size:** L
**Dependencies:** B3-001 ✅ (MetadataStore exists)

#### Context
B3's MetadataStore holds key-value metadata (dimensions, styles, materials). For domain models like chess positions, music notation, or gear meshing, agents need *rules*: "no two pieces on same square," "gear pitch must match between meshing gears," "notes must fill the bar to the time signature."

These rules should be **data, not code**. An agent defines a constraint schema in the metadata store; the platform evaluates it. This is the key to "agents define new knowledge without code changes."

#### Acceptance Criteria
- [ ] `ConstraintSchema` interface: name, description, variables (typed), rules (expressions that must evaluate to true)
- [ ] Variable types: `number`, `string`, `boolean`, `position` ({x,y,z}), `set` (collection), `grid` (2D array)
- [ ] Rule types:
  - `expression`: arbitrary boolean expression using ExpressionService (e.g., `$a + $b <= 10`)
  - `unique`: no duplicate values in a set/grid column (e.g., chess square occupancy)
  - `range`: value within min/max (e.g., `$pitch_angle >= 14 && $pitch_angle <= 25`)
  - `reference`: value must exist in a lookup table (e.g., `$piece_type in ['king','queen','rook','bishop','knight','pawn']`)
- [ ] `ConstraintEvaluator` class: takes schema + variable bindings, evaluates all rules, returns pass/fail per rule with explanation
- [ ] Schemas stored in MetadataStore under `constraints/` namespace (e.g., `constraints/chess/position`)
- [ ] DSL commands:
  - `constraint.define <key>` — stores a constraint schema (YAML input)
  - `constraint.evaluate <key>` — evaluates schema against provided variable bindings
  - `constraint.list` — lists defined constraint schemas
- [ ] Unit tests for each rule type, schema validation, evaluation with pass/fail cases

#### Files to Modify
- `src/generation/validation/ConstraintEvaluator.ts` (new)
- `src/generation/validation/index.ts` (export)
- `src/servers/authoring/commands/constraint.ts` (new command namespace)
- `src/servers/authoring/server.ts` (register namespace)

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

**Track:** F | **Status:** ⬜ | **Size:** M
**Dependencies:** F1-001

#### Context
Builders should be able to reference constraint schemas to validate their decisions and placements. A chess board builder references the chess position constraint; a gear assembly builder references the gear meshing constraint.

#### Acceptance Criteria
- [ ] `constraints:` section in YAML builder format: references constraint schemas by key
- [ ] Builder executor evaluates constraints after decisions and measurements are resolved
- [ ] Constraint failures appear in validation.issues with severity 'error'
- [ ] Constraint results included in TracedOutput for traceability
- [ ] Quality gate: "all referenced constraints pass" as a Tier 2 requirement
- [ ] Unit test: builder with constraint reference, pass and fail cases

#### Files to Modify
- `src/generation/builder/YamlBuilderTypes.ts` (constraints reference)
- `src/generation/builder/YamlBuilderExecutor.ts` (constraint evaluation phase)
- `src/generation/validation/ValidationAPI.ts` (constraint gate)

---

### F1-003: Built-in Domain Constraint Libraries

**Track:** F | **Status:** ⬜ | **Size:** M
**Dependencies:** F1-001

#### Context
Seed the constraint system with useful domain constraints that demonstrate the pattern and are immediately usable.

#### Acceptance Criteria
- [ ] `constraints/mechanical/gear_mesh` — pitch match, center distance, rotation direction
- [ ] `constraints/spatial/no_overlap` — AABB non-intersection for placed objects
- [ ] `constraints/spatial/clearance` — minimum distance between objects
- [ ] `constraints/music/time_signature` — beats per bar, note duration sum
- [ ] `constraints/chess/valid_position` — legal chess position rules
- [ ] All constraints stored as metadata YAML files, loadable via `constraint.evaluate`
- [ ] Documentation: each constraint has description and usage example

#### Files to Create
- `metadata/constraints/mechanical/gear_mesh.yaml`
- `metadata/constraints/spatial/no_overlap.yaml`
- `metadata/constraints/spatial/clearance.yaml`
- `metadata/constraints/music/time_signature.yaml`
- `metadata/constraints/chess/valid_position.yaml`

---

## F2: Style Definitions

> **Goal:** Style as a first-class composable data object — not hardcoded conditionals, but a structured definition that any builder can consume.

### F2-001: Style Schema and Resolution

**Track:** F | **Status:** ⬜ | **Size:** L
**Dependencies:** B3-001 ✅ (MetadataStore), F1-001 (constraint evaluation patterns)

#### Context
B3-003 seeded style palettes (modern, rustic, industrial) as flat metadata. This story promotes style to a first-class concept with structured effects on decisions, materials, proportions, and patterns.

A style definition specifies:
- **Decision defaults:** "if style is industrial, default `leg_style` to `square`"
- **Material palette:** colors, roughness, metalness overrides
- **Proportion rules:** ratios and relationships between measurements
- **Pattern preferences:** symmetry type, repetition, ornamentation level

When a builder is composed under a style, unset decisions inherit style defaults, materials resolve from the style palette, and proportion rules constrain measurements.

#### Acceptance Criteria
- [ ] `StyleDefinition` interface: name, decision_defaults, material_palette, proportion_rules, pattern_preferences
- [ ] `decision_defaults`: map of `{decision_name: preferred_value}` — applied as fallback when decision is unset
- [ ] `material_palette`: map of `{role: material_definition}` — e.g., `{primary_wood: {color: '#8B4513', roughness: 0.7}}`
- [ ] `proportion_rules`: array of expressions that must hold (e.g., `table_height / chair_seat_height >= 1.15`)
- [ ] `pattern_preferences`: `{symmetry: 'bilateral'|'radial'|'none', repetition: 'low'|'medium'|'high'}`
- [ ] Styles stored in MetadataStore under `styles/` (upgrading existing B3-003 style metadata)
- [ ] `resolveStyle(styleName)` loads and validates a style definition
- [ ] YAML builder format: `style: <name>` at top level or in composition section
- [ ] When `style:` is set, ExpressionService provides `$style.<property>` access
- [ ] Decision resolution order: explicit override > style default > builder default > random
- [ ] Material resolution: `$style.primary_wood` resolves to the style's palette entry
- [ ] DSL commands:
  - `style.define <name>` — creates/updates a style definition
  - `style.list` — lists available styles
  - `style.preview <name>` — shows style's decision defaults and palette
- [ ] Unit tests for style loading, decision defaulting, material resolution, proportion validation

#### Files to Modify
- `src/generation/builder/StyleResolver.ts` (new)
- `src/generation/builder/YamlBuilderTypes.ts` (style field)
- `src/generation/builder/YamlBuilderExecutor.ts` (style integration in decision + material phases)
- `src/generation/builder/ExpressionService.ts` ($style prefix support)
- `src/servers/authoring/commands/style.ts` (new command namespace)
- `metadata/styles/modern.yaml` (upgrade to StyleDefinition format)
- `metadata/styles/rustic.yaml` (upgrade)
- `metadata/styles/industrial.yaml` (upgrade)

#### Notes
The decision defaulting mechanism is the most impactful feature. Currently, a builder's decision is either explicitly overridden or randomly chosen. With style defaults, an entire scene can be given a coherent look by setting `style: mid_century_modern` at the top level — every sub-builder picks up appropriate defaults without explicit per-decision overrides.

---

### F2-002: Style Cascading in Composition

**Track:** F | **Status:** ⬜ | **Size:** M
**Dependencies:** F2-001

#### Context
When a parent builder sets `style: industrial`, all composed children should inherit that style (unless they override it). Style cascades through SharedContext.

#### Acceptance Criteria
- [ ] Parent `style:` value propagated to SharedContext
- [ ] Child builders read style from SharedContext when not explicitly set
- [ ] Child can override style: `compose: { builder: Lamp, style: art_deco }` overrides parent
- [ ] Style defaults merge with explicit composition overrides (explicit wins)
- [ ] Unit test: parent sets style, child inherits and uses style decision defaults
- [ ] Unit test: child overrides parent style

#### Files to Modify
- `src/generation/builder/SharedContext.ts` (style propagation)
- `src/generation/builder/YamlBuilderExecutor.ts` (style cascading in composition)

---

### F2-003: Style-Driven Material Theming

**Track:** F | **Status:** ⬜ | **Size:** M
**Dependencies:** F2-001, C3-001 ✅ (Material Slots)

#### Context
A style defines a material palette. Builders reference roles (`primary_wood`, `accent_metal`, `fabric`) rather than specific colors. The style resolves roles to concrete materials.

#### Acceptance Criteria
- [ ] YAML materials section supports `role: <name>` instead of explicit color
- [ ] Role resolved from active style's material_palette
- [ ] Fallback: if no style or role not in palette, use builder's explicit color
- [ ] Style palette includes PBR properties (roughness, metalness) not just color
- [ ] Changing style at scene level changes all material colors/properties across children
- [ ] Unit test: same builder, two styles, produces different material colors

#### Files to Modify
- `src/generation/builder/MaterialResolver.ts` (role-based resolution)
- `src/generation/builder/StyleResolver.ts` (palette lookup)
- `src/generation/builder/YamlBuilderExecutor.ts` (wire into material phase)

---

## F3: Role-Based Composition

> **Goal:** Compose builders by role + style, not by hardcoded builder name.

### F3-001: Builder Role Registry

**Track:** F | **Status:** ⬜ | **Size:** M
**Dependencies:** F2-001, B3-001 ✅

#### Context
Currently, composition references specific builders by name: `compose: { builder: DiningChair }`. For style cascading to work at scale, the system should resolve builders by role: `compose: { role: seating }` picks the best builder for the current style.

#### Acceptance Criteria
- [ ] `BuilderRoleRegistry`: maps `(role, style?) -> builder_name` with priority/preference
- [ ] Registry populated from metadata store: `builders/roles/<role>.yaml` lists candidates
- [ ] Resolution: exact match (role + style) > role-only match > error
- [ ] YAML composition: `role: <name>` as alternative to `builder: <name>`
- [ ] When both `role:` and `style:` are present, lookup uses both
- [ ] `builder.register_role <builder_name> role=<role> [style=<style>]` DSL command
- [ ] `builder.list_roles` shows role -> builder mappings
- [ ] Fallback: if no match, error with available options listed
- [ ] Unit tests for registration, resolution, style-specific resolution, fallback

#### Files to Modify
- `src/generation/builder/BuilderRoleRegistry.ts` (new)
- `src/generation/builder/YamlBuilderTypes.ts` (role field in YamlComposition)
- `src/generation/builder/YamlBuilderExecutor.ts` (role resolution in composition)
- `src/servers/authoring/commands/builder.ts` (register_role, list_roles commands)
- `metadata/builders/roles/` (role definitions)

---

### F3-002: Role-Based Scene Templates

**Track:** F | **Status:** ⬜ | **Size:** M
**Dependencies:** F3-001

#### Context
With role-based composition, scene templates become style-independent. A "dining room" template composes `role: table`, `role: seating` (x4), `role: lighting`, `role: decoration`. Changing the style completely changes the output without modifying the template.

#### Acceptance Criteria
- [ ] Scene template YAML that uses only roles (no hardcoded builder names)
- [ ] Scene template + `style: modern` produces modern furniture
- [ ] Same template + `style: industrial` produces industrial furniture
- [ ] Decision coverage: style decision at scene level cascades to all roles
- [ ] At least one working template: DiningRoom with 4+ roles
- [ ] Unit test: same template, different styles, different builder resolution

#### Files to Create
- `builders/scenes/templates/DiningRoom.yaml` (role-based template)

---

## F4: Cross-Builder Constraints

> **Goal:** Measurement constraints that span sibling builders — proportion harmonics.

### F4-001: Cross-Builder Proportion Rules

**Track:** F | **Status:** ⬜ | **Size:** M
**Dependencies:** F1-001, F2-001

#### Context
A style defines proportion rules: "table height / chair seat height = 1.15-1.25." These span multiple builders that are siblings in a composition. The constraint evaluator checks these after all children have generated their measurements.

#### Acceptance Criteria
- [ ] Style `proportion_rules` evaluated after composition completes
- [ ] Rules reference measurements from sibling builders via path: `table.height / seating.seat_height`
- [ ] Measurement values collected from SharedContext after all children run
- [ ] Proportion violations reported as validation warnings (not blocking — proportions are guidelines)
- [ ] `psd.check_proportions` DSL command evaluates proportion rules for the current scene
- [ ] Unit test: compose table + chair, check proportion rule passes and fails

#### Files to Modify
- `src/generation/validation/ConstraintEvaluator.ts` (proportion rule evaluation)
- `src/generation/builder/YamlBuilderExecutor.ts` (post-composition proportion check)
- `src/servers/authoring/commands/psd.ts` (check_proportions command)

---

### F4-002: Assembly Metadata

**Track:** F | **Status:** ⬜ | **Size:** S
**Dependencies:** F4-001

#### Context
Mechanical assemblies (gears, joints) need non-spatial relationship metadata: "gear A meshes with gear B at ratio 3.5." This extends PSD with a `connections:` section.

#### Acceptance Criteria
- [ ] `PSDConnection` interface: `type`, `from` (prim path), `to` (prim path), `data` (key-value)
- [ ] `connections:` section in YAML builder format
- [ ] Connections serialized to PSD scene
- [ ] `psd.connections` DSL command lists connections
- [ ] Unit test: gear assembly with meshing connection, queryable

#### Files to Modify
- `src/generation/builder/PSD.ts` (PSDConnection, connections on PSDScene)
- `src/generation/builder/YamlBuilderTypes.ts` (connections section)
- `src/generation/builder/YamlBuilderExecutor.ts` (connection processing)
- `src/servers/authoring/commands/psd.ts` (connections command)

---

# TRACK G: WORLD & SCENE CAPABILITIES

## G1: Height Field Mesh

> **Goal:** Generate terrain meshes from scalar fields — the foundation for landscapes, ground planes, and environment builders.

### G1-001: Terrain Mesh Generation

**Track:** G | **Status:** ⬜ | **Size:** L
**Dependencies:** None (scalar fields and Mesh infrastructure exist)

#### Context
Scalar fields (Perlin noise, etc.) exist in platform/spatial. Mesh infrastructure exists in platform/geometry. The missing piece is converting a height field sample grid into a mesh with proper UVs and normals. This enables terrain builders that use the negotiation protocol (B5) to flatten pads for buildings.

#### Acceptance Criteria
- [ ] `MeshOperations.createHeightFieldMesh(options)` generates a grid mesh from a height function
- [ ] Options: `width`, `depth`, `segmentsX`, `segmentsZ`, `heightFunction: (x, z) => y`
- [ ] Generated mesh: proper triangulation (2 triangles per grid cell), computed normals, UV coordinates
- [ ] UVs: (x/width, z/depth) — simple planar projection
- [ ] Normals: per-vertex computed from adjacent face normals (smooth terrain)
- [ ] Accepts optional `modifications` array: `{ type: 'flatten', center, radius, elevation }` for building pads
- [ ] Deterministic: same height function + seed = same mesh
- [ ] YAML `terrain:` geometry command with `noise_scale`, `noise_amplitude`, `segments`
- [ ] Integration with B5 negotiation: terrain builder reads `terrain_clearance` requirements, flattens pads
- [ ] Unit tests: flat plane, noisy terrain, terrain with flattened pad, UV/normal correctness

#### Files to Modify
- `src/platform/geometry/MeshOperations.ts` (createHeightFieldMesh)
- `src/generation/builder/commands/TerrainCommand.ts` (new)
- `src/generation/builder/commands/index.ts` (register)
- `src/generation/builder/YamlBuilderTypes.ts` (terrain command type)

---

### G1-002: Chunk-Aligned Terrain

**Track:** G | **Status:** ⬜ | **Size:** M
**Dependencies:** G1-001

#### Context
For large worlds, terrain is generated in chunks. Adjacent chunks must share boundary vertices for seamless tiling. The height function must be evaluated deterministically at boundary points by both chunks.

#### Acceptance Criteria
- [ ] `TerrainChunk` interface: `chunkX`, `chunkZ`, `size`, mesh reference
- [ ] Boundary vertex sharing: chunks at (0,0) and (1,0) share their x=size edge vertices
- [ ] Height function receives world-space coordinates (not chunk-local) for deterministic boundaries
- [ ] `world.generate_chunk <chunkX> <chunkZ>` DSL command generates a single terrain chunk
- [ ] `world.generate_region <minX> <minZ> <maxX> <maxZ>` generates multiple chunks
- [ ] Unit test: two adjacent chunks, verify boundary vertices match exactly

#### Files to Modify
- `src/platform/scene/TerrainChunk.ts` (new)
- `src/servers/authoring/commands/world.ts` (new command namespace)

---

## G2: LOD System

> **Goal:** Scene-level quality tier selection based on distance — generate less detail for distant objects.

### G2-001: LOD-Conditional Composition

**Track:** G | **Status:** ⬜ | **Size:** M
**Dependencies:** A2-001 ✅ (quality tiers exist)

#### Context
Builders already have quality tiers (Tier 0-4). LOD maps directly: Tier 0 for distant objects (bounding box), Tier 1 for mid-distance, Tier 2+ for close-up. The missing piece is a scene-level system that decides which tier to request based on a distance/budget parameter.

#### Acceptance Criteria
- [ ] Composition syntax: `lod_min: <tier>` — only invoke sub-builder when scene LOD budget >= tier
- [ ] `lod_tier: <tier>` — force sub-builder to generate at specific tier (overrides builder's target)
- [ ] Scene-level `lod_budget: <tier>` parameter on scene builders
- [ ] Below `lod_min`, sub-builder replaced with bounding box placeholder (Tier 0 behavior)
- [ ] `scene.generate_at_lod <tier>` DSL command — re-generates current scene at specified LOD
- [ ] Unit test: scene with lod_min=2 sub-builder, generate at LOD 1 (placeholder) and LOD 2 (full)

#### Files to Modify
- `src/generation/builder/YamlBuilderTypes.ts` (lod_min, lod_tier in YamlComposition)
- `src/generation/builder/YamlBuilderExecutor.ts` (LOD check in composition phase)
- `src/servers/authoring/commands/scene.ts` (generate_at_lod command)

---

### G2-002: View-Dependent Generation

**Track:** G | **Status:** ⬜ | **Size:** L
**Dependencies:** G2-001, G1-001

#### Context
Given a camera position and direction, determine which chunks/objects to generate and at what LOD. Distant objects get lower LOD, off-screen objects are skipped entirely.

#### Acceptance Criteria
- [ ] `world.generate_view position=<x,y,z> direction=<x,y,z> range=<N>` command
- [ ] Computes visible chunks/objects based on frustum and distance
- [ ] LOD tier assigned per-object based on distance from camera
- [ ] Returns scene with mixed LOD levels
- [ ] Progressive: calling with closer position generates more detail for nearby objects
- [ ] Unit test: generate view, verify near objects are higher LOD than far objects

#### Files to Modify
- `src/platform/scene/ViewDependentGenerator.ts` (new)
- `src/servers/authoring/commands/world.ts` (generate_view command)

---

## G3: UV Pipeline

> **Goal:** Fix UV generation, add smart unwrapping, texture atlasing, and UV quality gates. This is the foundation for all procedural texturing.
> **Design:** See `PBR_TEXTURE_EVALUATION.md` for detailed exploration.

### G3-001: Per-Operation UV Fixes

**Track:** G | **Status:** ⬜ | **Size:** M
**Dependencies:** C4-001 ✅ (basic UVs exist)

#### Context
Current UV generation is inconsistent — each geometry operation generates its own UVs (if any) without coordination. This causes checker pattern distortion, inconsistent texel density, and missing UVs on caps/cut faces. Before any procedural texturing, we need correct per-operation UVs with world-scale consistency.

#### Acceptance Criteria
- [ ] Box: 6 planar projections with world-scale (1 UV unit = 1 meter by default)
- [ ] Lathe: cylindrical mapping for body, planar projection for caps
- [ ] Extrude: cylindrical for sides, planar for caps, scaled to world dimensions
- [ ] Loft: interpolated UVs from edge loops with consistent parameterization
- [ ] Boolean: re-project cut faces with planar projection based on face normal
- [ ] `uv_mode` parameter on geometry commands: `world_scale` (default), `normalized` (0-1), `none`
- [ ] All geometry commands output vertices with valid UV attributes
- [ ] Unit tests: verify UV coverage, no NaN/undefined UVs, consistent texel density

#### Files to Modify
- `src/generation/builder/commands/BoxCommand.ts` (add UV generation)
- `src/generation/builder/commands/LatheCommand.ts` (fix cap UVs)
- `src/generation/builder/commands/ExtrudeCommand.ts` (world-scale UVs)
- `src/generation/builder/commands/LoftCommand.ts` (interpolated UVs)
- `src/platform/geometry/Boolean2D.ts` (cut face UV projection)
- `src/generation/builder/YamlBuilderTypes.ts` (uv_mode parameter)

---

### G3-002: Smart UV Unwrapping

**Track:** G | **Status:** ⬜ | **Size:** L
**Dependencies:** G3-001

#### Context
Per-operation UVs are independent — each part uses [0,1] separately. For coherent texturing, we need global UV unwrapping: segment mesh by normals, unfold with minimal distortion, pack islands efficiently.

#### Acceptance Criteria
- [ ] `UVUnwrapper` class: takes mesh, outputs unwrapped UVs
- [ ] Angle-based segmentation: faces with similar normals form UV islands (configurable angle threshold)
- [ ] ABF (Angle-Based Flattening) or LSCM unwrapping per island
- [ ] Island packing: MaxRects bin-packing into [0,1] texture space with configurable margin
- [ ] Seam hints: `prefer_seam` and `avoid_seam` edge tags respected during segmentation
- [ ] YAML `post_process.unwrap:` section with method, margin, pack options
- [ ] DSL command `builder.unwrap [method=smart] [margin=0.01]`
- [ ] Unwrap preserves part-to-island mapping for later texture assignment
- [ ] Unit tests: unwrap chair, verify utilization > 60%, max stretch < 20%

#### Files to Create
- `src/platform/geometry/UVUnwrapper.ts`
- `src/platform/geometry/IslandPacker.ts`

#### Files to Modify
- `src/generation/builder/YamlBuilderTypes.ts` (post_process.unwrap)
- `src/generation/builder/YamlBuilderExecutor.ts` (unwrap phase)
- `src/servers/authoring/commands/builder.ts` (unwrap command)

---

### G3-003: UV Quality Gates

**Track:** G | **Status:** ⬜ | **Size:** S
**Dependencies:** G3-001

#### Context
How do we know if UVs are good enough for texturing? We need quality metrics and machine-readable suggestions, similar to geometry quality gates.

#### Acceptance Criteria
- [ ] `UVQualityMetrics` interface: coverage, max_stretch, mean_stretch, utilization, density_variance, overlap_count
- [ ] `evaluateUVQuality(mesh): UVQualityMetrics`
- [ ] Coverage: percentage of faces with valid UVs (target: 100%)
- [ ] Stretch: area/angle distortion per island (target: < 10% max)
- [ ] Utilization: percentage of [0,1] texture space used (target: > 70%)
- [ ] Density variance: ratio of max to min texel density (target: < 1.5x)
- [ ] Overlap: count of overlapping UV islands (target: 0)
- [ ] DSL command `builder.uv_quality` returns metrics + suggestions
- [ ] Suggestions are machine-readable: `{ action, target, reason }`
- [ ] Quality gates for Tier 3+ require passing UV quality thresholds
- [ ] Unit tests for each metric

#### Files to Create
- `src/generation/validation/UVQualityGates.ts`

#### Files to Modify
- `src/generation/validation/QualityGates.ts` (integrate UV checks for Tier 3+)
- `src/servers/authoring/commands/builder.ts` (uv_quality command)

---

## G4: Procedural Textures

> **Goal:** Noise-based texture evaluation, mesh analysis (curvature, AO), material layering, and domain generators.

### G4-001: Mesh Analysis Pipeline

**Track:** G | **Status:** ⬜ | **Size:** M
**Dependencies:** G3-001 (UVs exist)

#### Context
Procedural textures need mesh analysis data to intelligently place effects: wear on edges (curvature), dirt in crevices (AO), position-based patterns. This must be deterministic and baked to UV space.

#### Acceptance Criteria
- [ ] `MeshAnalysis` interface: curvature, ambientOcclusion, worldPosition, faceNormals per vertex/texel
- [ ] `bakeMeshAnalysis(mesh, uvResolution): MeshAnalysis` — rasterizes mesh data to UV-space buffers
- [ ] Per-vertex curvature: average angle between adjacent face normals (-1 concave to +1 convex)
- [ ] Per-vertex AO: ray-based occlusion sampling (simplified, 16-32 rays per vertex)
- [ ] World position stored per-vertex for triplanar/position-based effects
- [ ] Deterministic: same mesh + UVs = same analysis
- [ ] Unit tests: bake analysis for known mesh, verify curvature high on edges, AO high in crevices

#### Files to Create
- `src/platform/materials/MeshAnalysis.ts`

#### Files to Modify
- `src/demos/MeshMapBaker.ts` (extend existing baking or replace)

---

### G4-002: Procedural Texture Generators

**Track:** G | **Status:** ⬜ | **Size:** L
**Dependencies:** G4-001

#### Context
The noise infrastructure exists (ScalarField, perlin3d) but operates in 3D world space. Generators combine noise with domain knowledge to produce specific material effects.

#### Acceptance Criteria
- [ ] `TextureGenerator` interface: `evaluate(uv, params, meshAnalysis, seed) -> {albedo, normal, roughness, metallic, height}`
- [ ] Noise functions extended: Perlin, Worley (Voronoi), FBM, domain warping — all seeded
- [ ] Built-in generators:
  - `wood_grain`: ring patterns, rays, species-specific color (oak, walnut, pine)
  - `stone`: Voronoi cells with mortar lines
  - `metal_brushed`: directional scratch noise
  - `fabric_weave`: pattern-based (plain, twill, satin)
  - `edge_wear`: curvature-driven wear (uses MeshAnalysis)
  - `dirt_accumulation`: AO-driven grime (uses MeshAnalysis)
  - `noise_color`: generic noise-to-color-ramp
- [ ] Generator registry for extensibility
- [ ] All generators produce coherent multi-channel output (albedo matches roughness matches normal)
- [ ] YAML `generator:` section in material layers
- [ ] Unit tests for each generator, verify determinism across runs

#### Files to Create
- `src/platform/materials/TextureGenerator.ts`
- `src/platform/materials/generators/WoodGrainGenerator.ts`
- `src/platform/materials/generators/StoneGenerator.ts`
- `src/platform/materials/generators/MetalBrushedGenerator.ts`
- `src/platform/materials/generators/WearGenerator.ts`
- `src/platform/materials/generators/index.ts`

---

### G4-003: Material Layering

**Track:** G | **Status:** ⬜ | **Size:** M
**Dependencies:** G4-002

#### Context
Real materials have layers: base coat + grain + weathering + detail. The layer stack evaluates bottom-to-top with blend modes and masks.

#### Acceptance Criteria
- [ ] `MaterialLayer` interface: generator, blend_mode, opacity, mask
- [ ] `MaterialStack`: ordered array of layers, evaluated bottom-to-top
- [ ] Blend modes: normal, multiply, overlay, add, screen
- [ ] Mask types: `uniform` (constant), `noise` (procedural), `curvature`, `ao`, `expression`
- [ ] Expression masks: `curvature > 0.5 AND ao < 0.3` — parsed and evaluated
- [ ] YAML `materials.X.layers:` section for layer stack definition
- [ ] Material stack produces final per-texel values for all PBR channels
- [ ] Unit test: base wood + edge wear overlay, verify wear concentrated on high curvature

#### Files to Create
- `src/platform/materials/MaterialStack.ts`
- `src/platform/materials/MaskEvaluator.ts`

#### Files to Modify
- `src/generation/builder/YamlBuilderTypes.ts` (materials.X.layers)
- `src/generation/builder/MaterialResolver.ts` (stack evaluation)

---

## G5: Decals & Text

> **Goal:** Project decals and text onto textures for logos, branding, signage.

### G5-001: Decal Projection System

**Track:** G | **Status:** ⬜ | **Size:** M
**Dependencies:** G4-003 (layer stack exists)

#### Context
Decals are projected texture overlays — a logo on a chair underside, a brand mark on a product. They're conceptually a layer, but with spatial projection instead of UV-space evaluation.

#### Acceptance Criteria
- [ ] `Decal` interface: source (image path or generator), projection, blend_mode, opacity
- [ ] `DecalProjection` types: planar (origin, normal, size), cylindrical (axis, radius, height), spherical
- [ ] `projectDecalToUV(decal, mesh, uvMapping)`: computes which texels are affected, with decal-space UVs
- [ ] Decals composite into layer stack as a special layer type
- [ ] YAML `decals:` section in materials: array of decal definitions
- [ ] DSL command `builder.add_decal <material> source=X position=center size=0.05`
- [ ] Image loading: PNG/JPEG from `assets/` folder or URL
- [ ] Unit test: project logo onto flat surface, verify correct texel coverage

#### Files to Create
- `src/platform/materials/DecalProjector.ts`

#### Files to Modify
- `src/platform/materials/MaterialStack.ts` (decal layer type)
- `src/generation/builder/YamlBuilderTypes.ts` (decals section)
- `src/servers/authoring/commands/builder.ts` (add_decal command)

---

### G5-002: Text-to-Texture Rendering

**Track:** G | **Status:** ⬜ | **Size:** M
**Dependencies:** G5-001

#### Context
The platform already has TrueType font parsing for 3D text (FontParser, glyph outlines). Text-to-texture reuses this to rasterize glyphs into texture space for signage, labels, and branded variants.

#### Acceptance Criteria
- [ ] `TextLayer` interface: content (with $expression support), font, size, color, position, align
- [ ] Glyph rasterizer: bezier curves → pixel buffer at target resolution
- [ ] Text composited as a layer type in material stack
- [ ] World-space size: `size: 0.1` means text is 0.1 meters tall in world space
- [ ] Position in UV space or via decal-style projection onto specific parts
- [ ] YAML `text_layers:` section in materials
- [ ] DSL command `builder.add_text <material> content="ACME" font=Helvetica size=0.05`
- [ ] Reuse existing `FontParser` and `Glyph` infrastructure
- [ ] Unit test: render "HELLO" at 256px, verify pixel coverage matches glyph area

#### Files to Create
- `src/platform/materials/TextRasterizer.ts`

#### Files to Modify
- `src/platform/materials/MaterialStack.ts` (text layer type)
- `src/generation/builder/YamlBuilderTypes.ts` (text_layers section)
- `src/servers/authoring/commands/builder.ts` (add_text command)

---

## G6: Texture Baking

> **Goal:** Bake procedural materials to PBR texture files. Integrate with glTF export and dashboard preview.

### G6-001: Texture Baking Pipeline

**Track:** G | **Status:** ⬜ | **Size:** L
**Dependencies:** G4-003 (layer stack), G5-002 (text/decals)

#### Context
Procedural textures are evaluated per-texel and baked to image files. This is deterministic (seed-controlled) and produces portable assets. Runtime shader evaluation is explicitly NOT a goal — baked textures work everywhere.

#### Acceptance Criteria
- [ ] `TextureBaker` class: takes mesh, UVs, material stack, resolution → baked images
- [ ] Outputs: albedo, normal, roughness, metallic, ao (5 images per material)
- [ ] Resolution configurable: 512, 1024, 2048, 4096
- [ ] Format: PNG (lossless) or JPEG (lossy, for albedo only)
- [ ] Deterministic: same mesh + material + seed = identical output bytes
- [ ] Baked textures written to `output/textures/<builder>_<material>_<channel>.png`
- [ ] YAML `texture_output:` section: format, resolution, maps to bake
- [ ] DSL command `builder.bake_textures [resolution=2048] [format=png]`
- [ ] Returns paths to baked files and bake statistics (time, file sizes)
- [ ] Unit test: bake wood material, verify file exists, correct dimensions, non-blank

#### Files to Create
- `src/platform/materials/TextureBaker.ts`
- `src/platform/materials/ImageWriter.ts` (PNG/JPEG encoding — use pngjs or sharp)

#### Files to Modify
- `src/generation/builder/YamlBuilderTypes.ts` (texture_output section)
- `src/servers/authoring/commands/builder.ts` (bake_textures command)

---

### G6-002: glTF Export with Baked Textures

**Track:** G | **Status:** ⬜ | **Size:** M
**Dependencies:** G6-001, C6-001 ✅

#### Context
glTF export currently includes materials as PBR values (color, roughness, metalness). With baked textures, we embed texture references into the glTF file.

#### Acceptance Criteria
- [ ] glTF materials reference baked texture files (relative paths or embedded base64)
- [ ] Texture info: `baseColorTexture`, `metallicRoughnessTexture`, `normalTexture`, `occlusionTexture`
- [ ] Combined roughness-metallic texture (glTF convention: green=roughness, blue=metallic)
- [ ] Option: embed textures in GLB (single file) or reference external files
- [ ] Exported GLB opens in Blender/Three.js with correct textures applied
- [ ] DSL command `builder.export format=gltf include_textures=true`
- [ ] Unit test: export textured chair, import in reference viewer, verify textures visible

#### Files to Modify
- `src/export/GLTFExporter.ts` (texture embedding/referencing)
- `src/servers/authoring/commands/builder.ts` (export options)

---

### G6-003: Dashboard PBR Preview

**Track:** G | **Status:** ⬜ | **Size:** M
**Dependencies:** G6-001

#### Context
The dashboard uses Three.js for preview. When baked textures exist, the dashboard should display them using `MeshStandardMaterial`. When textures don't exist (fast iteration mode), fall back to plain colors.

#### Acceptance Criteria
- [ ] Dashboard detects when baked textures exist for current builder
- [ ] If textures exist: create `MeshStandardMaterial` with texture maps
- [ ] If no textures: use current behavior (vertex colors or flat materials)
- [ ] Toggle in UI: "Show Textures" / "Show Colors" for fast switching
- [ ] Texture loading: fetch from `/textures/<builder>_<material>_<channel>.png`
- [ ] Hot-reload: when textures re-baked, dashboard updates preview
- [ ] Normal map applied correctly (tangent space)
- [ ] Performance: lazy-load textures only when toggled on
- [ ] Unit test: mock texture files, verify material switches correctly

#### Files to Modify
- `src/servers/dashboard/main.ts` (or client-side dashboard code)
- `dashboard.html` (texture toggle UI)

---

### G6-004: Texture Housekeeping

**Track:** G | **Status:** ⬜ | **Size:** S
**Dependencies:** G6-001

#### Context
Baked textures accumulate over time — different seeds, resolutions, experiments. We need housekeeping commands to manage the texture cache and prevent unbounded growth.

#### Acceptance Criteria
- [ ] `output/textures/` is the managed texture cache directory
- [ ] DSL command `texture.list [builder]` — list all baked textures, sizes, dates
- [ ] DSL command `texture.clean [builder] [older_than=7d]` — remove old/orphaned textures
- [ ] DSL command `texture.size` — report total cache size
- [ ] Orphan detection: textures for builders that no longer exist
- [ ] Optional: texture manifest file tracks which textures belong to which builder/seed
- [ ] Clean operation is non-destructive by default (dry-run), `--force` to actually delete
- [ ] Unit test: create temp textures, run clean, verify removal

#### Files to Create
- `src/storage/TextureCache.ts`

#### Files to Modify
- `src/servers/authoring/commands/texture.ts` (new command namespace)
- `src/servers/authoring/CommandRegistry.ts` (register texture commands)

---

## G7: Billboard Primitives

> **Goal:** Camera-facing quad primitives for particles, effects, and vegetation cards.

### G7-001: Billboard Geometry and Instancing

**Track:** G | **Status:** ⬜ | **Size:** S
**Dependencies:** None

#### Context
Smoke, sparkles, glow effects, and distant vegetation are commonly rendered as camera-facing quads (billboards). This is a new primitive type — simple geometry but needs special handling in export (glTF extras or sprite extension).

#### Acceptance Criteria
- [ ] `billboard:` geometry command: creates a quad with `width`, `height`, `facing` (camera|axis)
- [ ] Billboard prims flagged in PSD: `type: billboard` with facing mode
- [ ] Instancing works: scatter 100 billboards efficiently
- [ ] glTF export: billboards as quads with `extras.billboard: true` (renderers handle orientation)
- [ ] Dashboard: billboards rendered as quads (no special camera-facing needed in authoring view)
- [ ] Unit test: create billboard, verify quad geometry, PSD type

#### Files to Modify
- `src/generation/builder/commands/BillboardCommand.ts` (new)
- `src/generation/builder/commands/index.ts` (register)
- `src/generation/builder/YamlBuilderTypes.ts` (billboard command type)
- `src/generation/builder/PSD.ts` (billboard prim type or flag)

---

# TRACK H: PHASE 3 DEMOS

> Each demo proves a convergence of Phase 3 capabilities on a vision-inspired scene.

### H1-001: Rigged Creature

**Track:** H | **Status:** ⬜ | **Size:** XL
**Dependencies:** E1-002 (skeleton composition), E2-001 (weights), E4-001 (skeleton export)

#### Context
Vision Example #3: A hybrid creature with skeleton, joints, and weights. Each body part from a different sub-builder. Exported to glTF with a working rig.

#### Acceptance Criteria
- [ ] Creature builder composes: body (horse-like), wings (eagle-like), tail (scorpion-like) — simplified/stylized geometry
- [ ] Each part declares its own skeleton section
- [ ] Composed skeleton merges correctly (wing_L.shoulder attaches to body.spine)
- [ ] Vertex weights assigned by proximity rules
- [ ] Joint constraints defined (hinge for knees, ball_and_socket for shoulders)
- [ ] Exports to glTF with working skin (importable in Blender, poses correctly)
- [ ] Builder passes Tier 2 quality gates
- [ ] 5+ seeds produce visually distinct but anatomically correct creatures

#### Files to Create
- `builders/catalog/components/HorseBody.yaml`
- `builders/catalog/components/EagleWing.yaml`
- `builders/catalog/components/ScorpionTail.yaml`
- `builders/catalog/HybridCreature.yaml`

---

### H2-001: Styled Room

**Track:** H | **Status:** ⬜ | **Size:** L
**Dependencies:** F2-002 (style cascading), F3-002 (role-based templates)

#### Context
Vision Examples #9 and #10: Same room template, completely different output based on style. Proves style cascading, role-based composition, and material theming.

#### Acceptance Criteria
- [ ] Role-based room template with: table, seating (x4), lighting, decoration
- [ ] `style: mid_century_modern` produces: tapered round legs, organic curves, walnut tones
- [ ] `style: industrial` produces: square steel legs, angular forms, black/grey/rust
- [ ] All materials resolve from style palette (no hardcoded colors in sub-builders)
- [ ] Style decision at scene level produces genuinely different geometry in every component
- [ ] Exports to glTF (two files: modern and industrial)
- [ ] Side-by-side comparison meaningful (not just color changes — geometry differs)

#### Files to Create
- `builders/scenes/templates/StyledRoom.yaml`
- `metadata/styles/mid_century_modern.yaml` (full StyleDefinition)
- Builder registrations for each role/style combination

---

### H3-001: Chess Board

**Track:** H | **Status:** ⬜ | **Size:** L
**Dependencies:** F1-002 (constraint integration), B2-003 ✅ (PSD queries)

#### Context
Vision Example #1: A chess board with pieces in a legal mid-game position. The position is generated by the builder using domain constraints, not hardcoded. An agent can query the PSD scene to count pieces, determine their positions, and verify the position is legal.

#### Acceptance Criteria
- [ ] Chess board builder: 8x8 board with alternating colors
- [ ] Chess piece builders (simplified): king, queen, rook, bishop, knight, pawn — lathe profiles
- [ ] Position generator: produces a legal mid-game position using chess constraint schema
- [ ] Pieces placed on correct squares using placement system
- [ ] PSD tags on pieces: `piece: king`, `color: white`, `square: e1`
- [ ] Agent can query: `psd.query_by_tag piece:king` returns king positions
- [ ] `psd.overview` shows board + piece count summary
- [ ] Constraint schema: `constraints/chess/valid_position` validates the generated position
- [ ] Exports to glTF (complete board with pieces)
- [ ] 5+ seeds produce different legal positions

#### Files to Create
- `builders/catalog/ChessBoard.yaml`
- `builders/catalog/components/ChessPiece.yaml` (parameterized by piece type)
- `metadata/constraints/chess/valid_position.yaml`

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
