# Vision Examples

> **Purpose:** Concrete scenarios that stress-test our plans. Each example describes a desired end-state, maps it to current/planned capabilities, and identifies gaps. If a gap isn't covered by the Master Plan or Backlog, it's called out explicitly so we can decide whether to add it.
>
> **How to read:** Each scene is self-contained. "Covered by" references backlog items. "Gap" means no backlog item exists yet.

---

## Scene #1 — Domain Knowledge to Scene

### Vision

A living room with a grand piano. Musical staff lines wind through the room as 3D ribbon geometry. Notes (quarter, eighth, sixteenth), rests, treble/bass clefs, and accidentals are placed along the staff as extruded 2D shapes, forming a continuous, musically plausible score fragment.

A chess board sits on a side table. Pieces are in a mid-game position that follows the rules of chess — no two pieces on the same square, pawns only on valid ranks, the position is reachable from the starting setup.

### What This Tests

- **Structured domain models.** The builder needs to know music notation layout rules (note spacing, stem direction, beam grouping) and chess rules (legal positions, piece movement).
- **Stateful placement.** The chess builder must track which squares are occupied. The music builder must track beat position along the staff.
- **2D-to-3D pipeline.** Notes, clefs, and chess piece silhouettes are 2D shapes extruded into 3D.
- **Path-following placement.** Notes placed along a curved staff ribbon, not a straight line.

### Coverage

| Capability | Status | Reference |
|-----------|--------|-----------|
| 2D shape extrusion | Built | Platform geometry |
| Sweep along path | Built | Platform geometry |
| Placement along path | Built | B1-003 `scene.place_along` |
| Domain knowledge store | Planned | B3 (Metadata Collector) |
| Structured domain models (rules, constraints) | **Gap** | B3 is key-value; chess/music need structured rule engines or constraint tables |
| Builder-internal state tracking | **Gap** | No plan for mutable builder state across geometry steps |
| Complex 2D shapes (beamed notes, clefs) | Planned | C1 (2D booleans) for combining shapes |
| Composition of sub-builders in scene | Built | Composition engine |

### Gaps to Address

1. **Structured domain knowledge.** B3-003 seeds "standard dimensions" and "style palettes," but a chess position generator or music notation layout engine is a different class of knowledge — it requires *rules and constraints*, not just lookup tables. Consider: should B3 support executable constraint schemas (e.g., "no two pieces on same square") or should domain logic live in specialized builder helpers?

2. **Builder-internal mutable state.** Current builders are stateless pipelines: decisions → measurements → geometry. A chess builder that places pieces one-by-one needs to track occupied squares. Options: (a) let `derived:` values accumulate state via expressions, (b) add an explicit `state:` section to YAML, (c) handle it purely through placement collision detection (B1-003 already has AABB collision). Option (c) may be sufficient for spatial exclusion; chess-specific rules would still need domain logic.

---

## Scene #2 — Holistic Semantics

### Vision

An agent is given access to a scene it has never seen before — a medieval fortress under siege. Attacking orcs surround the walls. Catapults are positioned at range. Defenders line the battlements. The agent can answer questions about the scene without seeing the builder decisions: "How many attackers are there?", "What race is the defending army?", "Where are the catapults relative to the gate?"

The scene is large enough that dumping everything into one MCP response would exceed useful context. The agent first gets an overview (scene hierarchy, top-level tags, bounding boxes), then drills into specific sub-trees ("show me the attackers," "what's near the gate").

### What This Tests

- **Semantic richness.** Tags like `army:attacker`, `race:orc`, `role:catapult` must survive from builder decisions through composition into the final scene graph.
- **Hierarchical queries.** The agent must be able to get a summary first, then zoom into details — not receive everything at once.
- **Nested builder semantics.** The "fortress" builder composes "wall," "tower," "gate" sub-builders. The "army" builder composes "unit" sub-builders. Semantic tags from leaf builders must be queryable at the scene root.
- **Spatial reasoning.** "Catapults are 50m from the gate" requires the agent to compute distances from scene graph data.

### Coverage

| Capability | Status | Reference |
|-----------|--------|-----------|
| Scene graph with hierarchy | Planned | B2 (PSD format) |
| Tags on scene prims | Planned | B2-001 |
| Query by tag | Planned | B2-003 `scene.query_by_tag` |
| Bounding box queries | Planned | B2-003 `scene.get_bounds` |
| Nested builder composition | Built | Composition engine + shared context |
| Tag propagation from child to parent | **Gap** | B2 defines tags per prim but doesn't describe aggregation or inheritance |
| Hierarchical/paginated scene queries | **Gap** | B2-003 lists prims but no depth-limited or summary query |
| Spatial relationship queries | **Gap** | No distance/proximity/containment queries planned |
| Semantic role annotations | **Gap** | Tags are string labels; no structured role vocabulary |

### Gaps to Address

1. **Tag aggregation.** When a "unit" sub-builder tags its output `race:orc`, the composed "army" and then the root "siege_scene" should be able to answer "contains race:orc" without the agent walking every leaf. B2-003 should support recursive tag collection or tag inheritance rules.

2. **Summary-then-detail queries.** Add a `scene.overview` command that returns only top-level prims with aggregated metadata (child count, combined bounds, collected tags) — like a table of contents. Then `scene.inspect <prim_path>` returns one level deeper. This keeps MCP responses small.

3. **Spatial relationship queries.** Add `scene.distance <prim_a> <prim_b>`, `scene.prims_within <prim> <radius>`, and `scene.prims_in_box <min> <max>`. These are simple computations over bounding boxes but hugely valuable for agent reasoning.

4. **Semantic role vocabulary.** Consider a lightweight ontology for common roles (protagonist, antagonist, container, support, decoration) so agents and builders share a vocabulary. This could be a metadata schema in B3.

---

## Scene #3 — Rigs and Seams

### Vision

A hybrid creature: the body of a horse, wings of an eagle, tail of a scorpion. Each part comes from a different sub-builder. Where parts meet, geometry blends smoothly — no hard cuts or visible seams. The exported model has a skeleton with joints at the neck, shoulders, wing roots, each leg, and the tail. Joint constraints (hinge for knees, ball-and-socket for shoulders) are defined so the model can be animated in Blender or a game engine.

### What This Tests

- **Cross-builder mesh blending.** Where horse-body meets eagle-wing, vertices must merge or blend, not just be placed adjacent.
- **Skeleton definition.** Joints, bones, parent-child hierarchy.
- **Vertex weights.** Each vertex influenced by one or more bones.
- **Joint constraints.** Rotation limits, hinge axes.
- **Export with rig data.** glTF supports skeletons and skins.

### Coverage

| Capability | Status | Reference |
|-----------|--------|-----------|
| Composition of sub-builders | Built | Composition engine |
| Mesh blending at boundaries | **Gap** | Needs builder negotiation Level 3 — see Scene #13, B5-003 |
| Skeleton/joint hierarchy | Deferred | Phase 3; PSD stubs skeleton fields (B2-001) |
| Vertex weights | Deferred | Phase 3; vertex class stubs mentioned for C4 |
| Joint constraints | **Gap** | Not mentioned anywhere |
| glTF skeleton export | **Gap** | C6 exports geometry only |
| Seam/boundary definition | **Gap** | Needs attachment points (B5-001) and negotiation protocol (B5-002) — see Scene #13 |

### Gaps to Address

1. **Attachment points / ports.** Builders should declare named ports with position, orientation, and a boundary vertex loop. When composing, the system snaps child ports to parent ports and optionally merges boundary vertices. This is the simplest level of builder negotiation — see Scene #13 for the full negotiation framework.

2. **Transition zone blending.** Where horse-body meets eagle-wing, neither builder owns the seam alone. This is a Level 3 builder negotiation problem (see Scene #13): both builders contribute boundary loops, and a blend/loft operation generates the connecting geometry. The existing loft primitive can bridge two boundary loops — the missing piece is the *protocol* for exchanging boundary data between builders.

3. **Skeleton as builder output.** Even before Phase 3 animation, the skeleton is useful metadata. Consider adding a `skeleton:` section to builders where joints are declared relative to measurements. This data flows into PSD and glTF export. Implementation can be pure data (no simulation) — just hierarchy + transforms + optional constraints.

4. **Vertex weight painting via rules.** Instead of manual weight painting, builders declare rules: "vertices within 5cm of joint X are influenced by bone Y with distance falloff." This is computable from the mesh and skeleton data.

5. These are Phase 3 items, but the **data structures should be planned now** so PSD and glTF export don't need architectural changes later. The B2-001 "skeleton stubs" are the right idea — make sure they're complete enough (joints, weights, constraints, not just empty arrays).

---

## Scene #4 — Procedural Variation via Interpolation

### Vision

A crowd scene: 30 people, each visually distinct. Body shape varies along axes — height, build (lean to stocky), shoulder width, hip width. Faces vary along separate axes — nose width, jaw shape, brow prominence. The builder defines 4-6 "archetype" meshes per body region (all sharing the same vertex topology), and the generation system interpolates between them per-character, driven by decisions.

### What This Tests

- **Morph target / blend shape system.** Multiple meshes with identical topology, blended by weight.
- **Per-region interpolation.** Body and face interpolate independently.
- **Topology-preserving mesh library.** Archetypes must have matching vertex counts and edge connectivity.
- **Scale of composition.** 30 characters × multiple parts × materials.

### Coverage

| Capability | Status | Reference |
|-----------|--------|-----------|
| Instancing (efficient reuse) | Built | Platform instancing |
| Composition at scale | Built | Placement engine |
| Morph targets / blend shapes | **Gap** | No plan exists |
| Topology-preserving mesh libraries | **Gap** | No plan exists |
| Per-vertex interpolation | **Gap** | No plan exists |
| Mesh validation (topology match) | **Gap** | Validation API doesn't check topology compatibility |

### Gaps to Address

1. **Morph target system.** Define a `MorphTarget` as a named set of vertex offsets from a base mesh. Blending is linear interpolation of offsets. This is well-understood (glTF supports it natively). It could be a geometry operation: `MeshOperations.blend(base, targets[], weights[])`.

2. **Mesh library format.** A collection of topology-compatible meshes stored as a base + morph targets. YAML builders reference the library and specify blend weights via decisions. This makes character variation a *decision problem*, which is exactly the Procedurable philosophy.

3. **Topology validation.** Add a validation check: "these N meshes have identical vertex count and face connectivity." This prevents silent errors when someone edits an archetype and breaks compatibility.

4. This is genuinely Phase 3 (Characters), but the morph target concept is useful earlier — e.g., vase profile interpolation, furniture proportion blending. Consider whether a lightweight version belongs in C5 (deformers) or as a standalone item.

---

## Scene #5 — Procedural Textures and Materials

### Vision

A weathered wooden tavern. The wood grain follows the geometry — planks have grain running along their length, the bar top has radial grain from the original tree. Knots appear at random but plausible locations. The stone fireplace has mortar lines between stones, with each stone slightly different in color. Metal fixtures have patina concentrated in crevices. None of this uses image textures — everything is procedurally generated from noise functions and mesh topology.

### What This Tests

- **Parametric texture generation.** Noise-based wood grain, stone variation, metal patina.
- **Geometry-aware texturing.** Grain direction follows mesh orientation, not world axes.
- **Multi-layer materials.** Base material + weathering overlay + detail (knots, mortar).
- **UV-dependent effects.** Patina in crevices requires knowing surface curvature or ambient occlusion.

### Coverage

| Capability | Status | Reference |
|-----------|--------|-----------|
| Perlin noise / scalar fields | Built | Platform spatial |
| Material slots (named regions) | Planned | C3 |
| UV generation | Planned | C4 |
| Noise displacement (surface deformation) | Planned | C5-001 |
| Procedural texture functions | **Gap** | No plan for texture-space noise evaluation |
| Material layering / stacking | Deferred | Listed as "Advanced Materials" |
| Curvature / AO computation | **Gap** | No plan |
| Texture coordinate transforms (align grain to geometry) | **Gap** | C4 generates UVs but no plan for rotating UV space per-part |

### Gaps to Address

1. **Procedural texture evaluation.** The noise infrastructure exists (ScalarField) but only operates in 3D world space. For textures, we need evaluation in UV space or along a local coordinate frame. This could be: `material.procedural_texture: { type: wood_grain, along: local_y, scale: 0.1, seed: $seed }`. The output is per-vertex color or a texture buffer.

2. **Material layering.** A stack: base coat → grain → knots → weathering. Each layer has blend mode (multiply, overlay, add) and mask (noise, curvature, manual). This is the "Advanced Materials" deferred item, but even a simple two-layer system (base + overlay) would be transformative.

3. **Local coordinate frames.** When a plank is placed at an angle, wood grain must follow the plank's local Y axis, not the world Y. This requires per-part UV orientation, which is a small extension to C4: `uv_transform: { rotate: part_orientation }`.

4. **Vertex-level AO / curvature.** Approximate ambient occlusion per-vertex (ray casting or simpler: average distance to neighbors). This enables "patina in crevices" without image textures. Computationally feasible for procedural meshes since we control polygon counts.

---

## Scene #6 — Infinite Simple World (Instancing)

### Vision

A landscape stretching to the horizon: rolling hills covered in grass, scattered trees, a winding river, a village in the middle distance. The world is much larger than could fit in memory as unique geometry. Instead, a handful of tree builders (3-5 variants), grass clump builders, house builders, and terrain chunks tile and instance across the landscape. The agent can request "the view from position X" and only the relevant chunks are generated.

### What This Tests

- **Massive instancing.** Thousands of instances of a few dozen prototypes.
- **Chunk-based generation.** Only generate what's needed for the current view.
- **LOD awareness.** Distant trees can be lower quality than nearby ones.
- **Terrain as builder.** Height fields, not just placed objects.
- **Coherent seeding.** Adjacent chunks must tile seamlessly; the same tree at (100, 200) is always the same tree.

### Coverage

| Capability | Status | Reference |
|-----------|--------|-----------|
| Instancing system | Built | Platform instancing |
| Poisson disk scatter | Built | Platform spatial |
| Chunk contract | Built | Platform scene |
| Scalar fields (height) | Built | Platform spatial |
| Seeded determinism | Built | Core principle |
| LOD system | **Gap** | No plan exists |
| Terrain mesh from height field | **Gap** | Scalar fields exist but no mesh generation from them |
| View-dependent generation | **Gap** | No frustum/distance culling in generation pipeline |
| Chunk seam stitching | **Gap** | Adjacent chunks may not share boundary vertices |

### Gaps to Address

1. **Height field to mesh.** A terrain builder that samples a scalar field on a grid and produces a mesh. This is straightforward (grid of quads, height from noise) and uses existing primitives. Could be a new geometry operation or a builder pattern.

2. **LOD tiers.** Builders already have quality tiers (0-4). LOD could map directly: Tier 0 for distant objects (bounding box), Tier 1 for mid-distance (silhouette), Tier 2 for close-up. The builder already knows its tiers — the missing piece is a *scene-level* system that decides which tier to generate based on distance from camera.

3. **Chunk boundary stitching.** When two terrain chunks share an edge, their boundary vertices must match. This is a constraint on the height field sampling: ensure both chunks evaluate the same noise at boundary points. Deterministic seeding helps but grid alignment must be explicit.

4. **View-dependent generation.** A `world.generate_view(position, direction, range)` command that determines which chunks to generate and at what LOD. This is a scene-level orchestration layer above individual builders.

---

## Scene #7 — Infinite Zoom (LOD Continuum)

### Vision

A city block. Zoomed out: buildings are textured boxes. Zoom in on one building: windows, doors, facade detail appear. Zoom into a window: the room inside is generated with furniture. Zoom into the desk: papers, pens, a coffee mug, each with their own detail. The level of detail is continuous — there's no pop-in, just progressive refinement as the camera approaches.

### What This Tests

- **Hierarchical LOD.** Each object has multiple detail levels, and *each detail can itself be an object with its own LOD hierarchy*.
- **On-demand generation.** Detail is generated only when the camera is close enough.
- **Smooth LOD transitions.** No popping — geometry and material complexity increase gradually.
- **Recursive composition.** A building composes rooms; rooms compose furniture; furniture composes details. The recursion depth is camera-driven.

### Coverage

| Capability | Status | Reference |
|-----------|--------|-----------|
| Builder composition (recursive) | Built | Composition engine |
| Quality tiers per builder | Planned | Track A |
| On-demand generation | **Gap** | No camera-driven generation trigger |
| LOD transition blending | **Gap** | No plan for cross-fade or morphing between LOD levels |
| Recursive LOD hierarchy | **Gap** | Quality tiers are per-builder; no system for "generate children only at high LOD" |

### Gaps to Address

1. **LOD-conditional composition.** Extend the composition system so sub-builders are only invoked when the scene's LOD budget allows it. Syntax idea: `compose: { builder: RoomInterior, lod_min: 2 }` — only generate room contents when the parent building is rendered at LOD 2+.

2. **Progressive refinement protocol.** The dashboard or consumer requests a scene at a given detail budget. The scene returns what it can within budget. On zoom, the consumer re-requests with higher budget for the focused region. This is a request/response protocol extension, not a geometry feature.

3. **LOD blending.** Two approaches: (a) morph targets between LOD meshes (needs Scene #4 morph system), (b) alpha fade (simpler, handled by renderer). For an authoring platform, (a) is more interesting but (b) is sufficient for now. Either way, the PSD format needs LOD variant references per prim.

---

## Scene #8 — Complex Assemblies / Machines

### Vision

A steampunk clock tower. Dozens of interlocking gears of different sizes and tooth counts. Shafts connect gears across different planes. A pendulum hangs from a specific gear ratio. Springs, levers, and escapement mechanisms. Every gear meshes correctly with its neighbors — tooth pitch matches, axes are properly spaced, rotation directions alternate. The agent can query: "What's the gear ratio from the mainspring to the minute hand?"

### What This Tests

- **Parametric mechanical relationships.** Gear A meshes with Gear B: their tooth pitch must match, center distance = (radius_A + radius_B), rotation ratio = teeth_B / teeth_A.
- **Constraint propagation.** Changing one gear's tooth count must propagate to meshing partners.
- **Assembly graph.** Not just a scene tree but a mechanical connectivity graph (which shaft connects which gears).
- **Domain-specific queries.** Gear ratios, torque paths, degrees of freedom.

### Coverage

| Capability | Status | Reference |
|-----------|--------|-----------|
| Gear builder | Planned | B1-004, D3-001 |
| Composition of parts | Built | Composition engine |
| Derived values / expressions | Built | Expression service |
| Constraint system (measurements) | Built | Measurement constraints |
| Assembly graph / connectivity metadata | **Gap** | No plan for non-spatial relationships between parts |
| Constraint propagation across builders | **Gap** | Shared context passes decisions down but doesn't propagate constraints laterally |
| Mechanical domain queries | **Gap** | No plan for gear-ratio or kinematic queries |

### Gaps to Address

1. **Inter-builder constraints.** Currently, a parent builder passes shared context *down* to children. Mechanical assemblies need *lateral* constraints: Gear A and Gear B are siblings that must agree on tooth pitch. Options: (a) parent computes all shared values and passes them down (works but centralizes logic), (b) a constraint-solving step that runs after all sub-builders declare their requirements.

2. **Assembly metadata.** Extend PSD or metadata with a `connections:` section: `{ type: mesh, from: gear_A.shaft, to: gear_B.bore, ratio: 3.5 }`. This is queryable metadata, not simulation — the agent can traverse it to answer "what's the gear ratio?"

3. **Parametric spacing.** A helper or expression function: `gear_center_distance(module, teeth_a, teeth_b)` that computes correct center-to-center distance. This is domain knowledge (B3) exposed as an expression function.

---

## Scene #9 — Domain Transfer and Blending

### Vision

"Art Deco furniture made of candy." The Art Deco style (geometric patterns, bold symmetry, stepped forms, metallic accents) applies to furniture shapes, but the materials are candy — translucent sugar glass, striped peppermint, chocolate brown with glossy finish. The builder understands Art Deco as a *style* (proportions, patterns, symmetry rules) and candy as a *material palette* — and these two concerns compose independently.

Another example: "A medieval castle but built from LEGO bricks." The castle's overall form (towers, walls, gate) follows medieval architecture rules, but every surface is discretized into LEGO-sized studs.

### What This Tests

- **Style as composable concern.** Art Deco is not a material — it's proportions, patterns, and symmetry that apply to any geometry.
- **Material palette as composable concern.** "Candy" is a set of materials, surface properties, and color relationships that apply to any form.
- **Domain crossing.** Furniture + Art Deco + candy = three independent knowledge domains combined.
- **Discretization / voxelization.** The LEGO example requires snapping geometry to a grid.

### Coverage

| Capability | Status | Reference |
|-----------|--------|-----------|
| Style palettes in metadata | Planned | B3-003 |
| Material library | Built | MaterialLibrary |
| Shared context (pass style to children) | Built | Composition engine |
| Pattern/symmetry tools | **Gap** | No symmetry operations planned |
| Style-as-modifier (apply proportions rules to any builder) | **Gap** | No plan for style modifiers that transform geometry post-hoc |
| Voxelization / grid snapping | **Gap** | No plan |

### Gaps to Address

1. **Style modifiers.** A style is a set of rules that modify decisions and geometry: "Art Deco → prefer geometric profiles, add stepped details, apply symmetry, use metallic accents." This could be a *modifier builder* that wraps another builder and overrides decisions + adds post-processing geometry steps. The YAML syntax might be: `style: art_deco` which loads a style definition that provides decision defaults and geometry modifiers.

2. **Symmetry operations.** Mirror, radial symmetry, translational symmetry. These are geometry operations (C-track level) that are fundamental to many styles. `MeshOperations.mirror(mesh, plane)` and `MeshOperations.radialArray(mesh, axis, count)`.

3. **Voxelization.** Convert smooth geometry to grid-aligned blocks. Useful for LEGO, Minecraft, pixel-art styles. This is a specialized modifier: `voxelize(mesh, gridSize)`. Deferred is fine, but it's a good example of why the modifier/post-processing pipeline should be extensible.

---

## Scene #10 — Style Consistency and Cascading

### Vision

A furnished room where everything looks like it belongs together. "Mid-century modern" is chosen at the scene level. The table gets tapered round legs, the chair gets organic curves, the lamp gets a tripod base, the vase gets a smooth bulbous form. Wood tones are consistent (walnut family). Accent colors coordinate. Proportions feel harmonious.

Now change the style to "Industrial." The table gets square steel legs, the chair is angular with exposed bolts, the lamp is a bare bulb on a pipe, the vase is a repurposed tin can. Colors shift to black, grey, rust.

The *same decisions* at the scene level cascade to completely different geometry and materials at the component level.

### What This Tests

- **Style cascading.** Scene-level style decision propagates to all sub-builders and meaningfully changes their output.
- **Decision coverage depth.** The style decision must affect geometry, materials, and proportions — not just color.
- **Coherent variation within style.** Within "mid-century modern," each piece varies but stays within the style's rules.
- **Substitution.** Some styles may replace entire sub-builders (an industrial lamp is so different from a mid-century lamp that it might be a different builder entirely).

### Coverage

| Capability | Status | Reference |
|-----------|--------|-----------|
| Shared context (decisions cascade to children) | Built | Composition engine |
| Decision overrides | Built | Authoring DSL |
| Conditional geometry (if style == X) | Built | YAML conditional syntax |
| Style palettes (colors, materials) | Planned | B3-003 |
| Builder substitution based on style | **Gap** | Composition references specific builders by name, not by role |
| Style-aware decision defaults | **Gap** | No mechanism to say "if style is industrial, default leg_style to square" |
| Proportion harmonics | **Gap** | No system for enforcing proportional relationships across siblings |

### Gaps to Address

1. **Role-based composition.** Instead of `compose: { builder: DiningChair }`, support `compose: { role: seating, style: $style }` where the system resolves the role + style to a specific builder. This requires a registry: "for role=seating, style=industrial → IndustrialChair.yaml".

2. **Style-conditional defaults.** A style definition includes default decision values: `{ style: mid_century_modern, defaults: { leg_style: tapered_round, wood: walnut, finish: oiled } }`. When a builder is composed under this style, unset decisions inherit these defaults. This extends shared context with a style-aware fallback layer.

3. **Proportion rules.** A style defines ratio constraints: "table height / chair seat height = 1.15-1.25" or "all legs taper at the same rate." These are cross-builder measurement constraints — a step beyond the current single-builder constraint system.

---

## Scene #11 — Storytelling and Thematic Composition

### Vision

"A wizard's study after a magical experiment went wrong." Books are scattered on the floor, some open, some singed. A cauldron has tipped over with glowing liquid spilling. Shelves are askew. Glass vials are shattered. Smoke or magical particles drift through the air. The scene tells a story through object placement, states, and spatial relationships.

The builder doesn't just place objects — it places them in *states* (book: open, closed, fallen, burning) and *relationships* (liquid: flowing from cauldron, pooling on floor). An agent looking at the scene can reconstruct the story: "A cauldron tipped over, spilling liquid that knocked books off the lower shelf."

### What This Tests

- **Object states.** A book builder produces different geometry for open, closed, fallen, singed variants.
- **Causal placement.** Objects placed in relationship to events: the spill flows from the cauldron, books fell in the spill direction.
- **Narrative metadata.** The scene graph records not just positions but *why* things are where they are.
- **Particle/volume effects.** Smoke, glowing liquid, magical sparks (even if simplified to instanced sprites).

### Coverage

| Capability | Status | Reference |
|-----------|--------|-----------|
| Builder decisions (object states) | Built | Decision system |
| Composition | Built | Composition engine |
| Placement with spatial constraints | Built | B1-003 |
| Scatter with natural distribution | Built | Poisson disk |
| Narrative/causal metadata | **Gap** | No plan for event or causation annotations |
| Physics-based placement (tipping, spilling, falling) | **Gap** | No simulation; placement is explicit |
| Particle / sprite instancing | **Gap** | Instancing exists but no billboard/sprite primitive |
| Flow / spill geometry | **Gap** | No fluid or path-constrained geometry |

### Gaps to Address

1. **Event-driven placement scripts.** A scene builder could define a sequence of "events" that modify the scene: `event: cauldron_tips → cauldron.state: tipped, spawn: spill_puddle at cauldron.position`. This is a lightweight scripting layer over composition — not physics simulation, but authored causation chains.

2. **Narrative tags.** Extend PSD tags with `cause:` annotations: `{ tag: fallen_book, cause: explosion_shockwave, from: cauldron }`. Agents can traverse these to reconstruct the story.

3. **Simplified physics placement.** For "books fell off shelf," a procedural approximation: scatter N books on the floor below the shelf, with orientations biased away from the blast origin. This uses existing scatter + placement tools with directional bias parameters.

4. **Billboard / sprite primitives.** For smoke, sparkles, glow effects — a quad that always faces the camera. This is a new primitive type but simple geometry. Useful well beyond this scene.

---

## Scene #12 — Agent Self-Improvement Loop

### Vision

An agent is asked to create a "cozy reading nook." It has no existing builder for this. The workflow:

1. Agent queries metadata for "reading nook" → finds related concepts: chair, bookshelf, lamp, small table, rug.
2. Agent creates a sophistication plan (Tier 2 target).
3. Agent generates a builder template via DSL.
4. Agent adds decisions: chair style, lighting mood, bookshelf fullness.
5. Agent runs the builder, inspects the output via PSD queries.
6. Agent runs quality gates → sees failures: "bookshelf part has 1 face (Tier 0)."
7. Agent adds geometry for bookshelf, re-runs gates.
8. Agent checks decision coverage → "lighting_mood doesn't affect output."
9. Agent adds conditional lamp geometry based on lighting_mood.
10. Agent iterates until Tier 2 gates pass.

The entire loop happens autonomously through MCP tool calls. No human intervention needed.

### What This Tests

- **Full agent authoring loop.** Discovery → planning → creation → evaluation → iteration.
- **Quality gates as feedback.** Gate failures drive the next action.
- **Decision coverage as feedback.** Unused decisions are flagged and fixed.
- **Builder creation via DSL.** Not file editing — structured commands.
- **Metadata for ideation.** Agent uses stored knowledge to plan composition.

### Coverage

| Capability | Status | Reference |
|-----------|--------|-----------|
| Metadata queries | Planned | B3 |
| Sophistication plans | Planned | A4 |
| Builder creation via DSL | Planned | B4 |
| Quality gates | Planned | A2 |
| Decision coverage testing | Planned | A3 |
| PSD scene queries | Planned | B2-003 |
| MCP tool interface | Built | Stable 4 tools |
| Agent iterates based on gate output | **Partially gap** | Gates return structured output, but no "suggested next action" |

### Gaps to Address

1. **Actionable gate suggestions.** Quality gate output should include specific, machine-readable actions, not just descriptions. Instead of "bookshelf has 1 face," return `{ action: "add_geometry", target: "bookshelf", reason: "face_count < 6", current: 1, required: 6 }`. This lets the agent act on failures programmatically.

2. **Agent memory across iterations.** The agent needs to remember what it tried and what worked. B3 (metadata) could store per-builder iteration history: "attempted slat back, coverage improved from 60% to 85%." This supports learning across sessions.

3. **Rollback / undo.** If an agent's geometry change makes things worse, it should be able to revert. YAML builders are files, so git-style versioning is natural. Consider: `builder.snapshot` and `builder.restore <snapshot>` commands.

---

## Scene #13 — Builder Negotiation (Terrain + Settlement)

### Vision

A village on hilly terrain. Houses sit on flattened pads — the terrain has been graded where each house stands, with smooth transitions from natural slopes to level ground. Roads cut through hillsides, with embankments and retaining walls where the cut is deep. A river winds through the valley; a bridge spans it, its abutments conforming to the bank geometry. Tree roots blend into hillsides, their base geometry merging with the terrain surface.

No builder works in isolation. The terrain builder needs to know where houses, roads, and the river will go *before* it generates its mesh — otherwise there's no way to flatten house pads or cut road beds. The house builder needs to know the terrain elevation and slope at its site *before* it generates its foundation. The bridge builder needs the exact bank geometry from the river builder *before* it places abutments.

### What This Tests

This scene tests three escalating levels of inter-builder interaction:

**Level 1 — Attachment Points (static, one-directional):**
A lamp builder declares a "base_port" at its bottom. A table builder declares a "surface_port" at a point on its top. Composition snaps the lamp's base_port to the table's surface_port. The lamp conforms to the table — no negotiation needed.

**Level 2 — Negotiation Protocol (two-phase, bidirectional):**
A house builder publishes a **requirement**: "I need a 10×12m area, preferably flat, at position (50, 0, 30)." The terrain builder receives all such requirements before generating its mesh. It processes them — flattening the area, computing the actual elevation and residual slope — and publishes an **offer**: "Here's your pad at elevation 42.3m, slope 2.1° east." The house builder reads the offer and adapts: its foundation follows the 2.1° slope, its floor slab is at 42.3m. Neither builder had to know the other's internals — they communicated through a structured protocol.

**Level 3 — Co-creation (shared transition zone):**
Where a road cuts through a hill, the terrain and road builders share a **transition zone**. The terrain provides its boundary loop (the edge of the cut). The road provides its boundary loop (the edge of the road surface). A blend operation generates the embankment geometry between them — grading from road level to natural terrain. Neither builder alone could generate this transition; it requires boundary data from both.

### What This Tests (capabilities)

- **Multi-pass composition.** The current execution model is single-pass: parent builds geometry → composes children sequentially. Negotiation requires at least two passes: (1) collect requirements, (2) resolve and generate.
- **Structured inter-builder communication.** Beyond SharedContext's flat key-value writes, builders need to exchange typed data structures (spatial requirements, geometry offers, boundary loops).
- **Environment-aware generation.** The terrain builder is special — it must process requirements from *all* placed buildings before generating its mesh. This is a different role than a normal sub-builder.
- **Boundary geometry exchange.** Two builders contribute vertex loops that must align for a blend operation to connect them.

### Coverage

| Capability | Status | Reference |
|-----------|--------|-----------|
| Composition of sub-builders | Built | Composition engine |
| SharedContext (sibling data passing) | Built | SharedContext — but flat key-value only |
| Placement with collision avoidance | Built | B1-003 |
| Loft between vertex loops | Built | Platform geometry |
| Named ports / attachment points | **Gap** | No port metadata on builder output |
| Requirement/offer protocol | **Gap** | SharedContext has no structured request/offer pattern |
| Multi-pass composition | **Gap** | Execution is strictly single-pass sequential |
| Transition zone blending | **Gap** | No mechanism for two builders to share a geometry region |
| Environment builder role | **Gap** | No concept of a builder that processes all children's requirements before generating |

### Gaps to Address

1. **Attachment point declarations (Level 1).** The simplest step: builders declare a `ports:` section in their YAML output. Each port has a name, position (relative to builder origin), orientation (normal vector), and optionally references a named edge loop. The composition system reads ports to auto-compute offset and rotation. This is pure metadata — no new geometry operations needed.

   ```yaml
   # In a lamp builder:
   ports:
     base:
       position: { x: 0, y: 0, z: 0 }
       normal: { x: 0, y: -1, z: 0 }
       loop: base_ring    # optional: named edge loop for blending

   # In composition:
   compose:
     lamp:
       builder: TableLamp
       attach_to: table.surface_port    # snap lamp.base to table.surface_port
   ```

2. **Negotiation protocol (Level 2).** Extend SharedContext with a typed request/offer channel. Implementation approach:

   **Phase A — Requirements collection.** Before any geometry runs, each builder publishes requirements:
   ```yaml
   requirements:
     flat_pad:
       type: terrain_clearance
       shape: rectangle
       width: $building_width + 2    # +2m for grading margin
       depth: $building_depth + 2
       preferred_position: { x: $site_x, z: $site_z }
       max_slope: 5                  # degrees
   ```

   **Phase B — Offer resolution.** The environment/terrain builder receives all requirements and produces offers:
   ```yaml
   # Terrain builder processes requirements and writes offers to SharedContext:
   offers:
     house_1.flat_pad:
       actual_position: { x: 50, z: 30 }
       elevation: 42.3
       slope: 2.1
       slope_direction: { x: 1, z: 0 }
       boundary_loop: pad_edge_loop    # reference to the terrain's edge loop at this pad
   ```

   **Phase C — Adaptive generation.** The house builder reads offers and adapts its geometry:
   ```yaml
   # House builder reads terrain offer:
   read_offers: [flat_pad]
   measurements:
     foundation_elevation:
       value: "$offer.flat_pad.elevation"
     ground_slope:
       value: "$offer.flat_pad.slope"
   ```

   **Execution model change:** This requires the composition system to support **multi-pass execution**:
   - Pass 1: All builders run their `requirements:` phase (just publishing data, no geometry)
   - Pass 2: Environment builders process requirements and publish offers
   - Pass 3: All builders run their geometry phase with access to offers

   This is the biggest architectural change. However, it can be implemented incrementally — the first version could simply require explicit composition ordering: compose the terrain first (it reads children's requirements from SharedContext), then compose children (they read terrain's offers from SharedContext). This works within the current single-pass model by being clever about composition order.

3. **Transition zone blending (Level 3).** When two builders share a boundary, a blend operation connects them:

   ```yaml
   compose:
     road_section:
       builder: Road
       blend_zones:
         - my_loop: road_edge_left       # road's left boundary loop
           their_loop: terrain.cut_left   # terrain's corresponding edge loop
           method: loft                   # connect with loft
           segments: 4                   # smoothness of blend
           profile: ease_in_out          # blend curve shape
   ```

   The system takes two named edge loops (one from each builder), verifies they have compatible vertex counts (or resamples), and generates a loft/bridge mesh between them. This reuses the existing loft geometry primitive. The new work is: (a) the protocol for declaring which loops to connect, (b) resampling loops to matching vertex counts, (c) handling the case where loops are in different coordinate spaces (apply transforms first).

4. **Environment builder pattern.** Some builders (terrain, sky, ocean) are special — they must know about *all* other builders' spatial requirements before generating. This could be formalized as a `role: environment` tag that causes the composition system to defer their geometry until all other builders have published requirements. Alternatively, it's just a composition ordering convention: "always compose environment last, after collecting all requirements."

### Design Principles

- **Progressive adoption.** Level 1 (ports) is useful immediately and requires no architectural changes. Level 2 (negotiation) can start with composition-ordering tricks before requiring multi-pass execution. Level 3 (blend zones) can initially require manual loop matching before automated resampling.
- **Deterministic.** All negotiation must be deterministic — same seed, same requirements, same offers, same result. The protocol adds structure but doesn't add nondeterminism.
- **Traceable.** Every requirement, offer, and blend operation is traced, just like every decision and measurement. An agent can inspect "why is this house at elevation 42.3m?" and find the terrain's offer.
- **Composable with existing systems.** Ports extend builder output metadata. Requirements/offers extend SharedContext. Blend zones use existing loft primitives. No entirely new systems needed — just new protocols over existing infrastructure.

---

## Summary: Gap Inventory

Gaps identified that are **not currently in the Master Plan or Backlog**:

| # | Gap | Scenes | Severity | Notes |
|---|-----|--------|----------|-------|
| G1 | Structured domain models (rules/constraints, not just key-value) | 1, 8 | Medium | Extends B3 scope |
| G2 | Builder-internal mutable state | 1 | Low | May be solvable with existing collision detection |
| G3 | Tag aggregation / inheritance in PSD | 2 | High | Critical for agent scene understanding |
| G4 | Summary/paginated scene queries | 2 | High | Critical for large scenes + agent context window |
| G5 | Spatial relationship queries | 2, 11 | Medium | Simple to implement over bounding boxes |
| G6 | Semantic role vocabulary | 2, 10, 11 | Medium | Extends B3 scope |
| G7a | Attachment point declarations (Level 1) | 3, 13 | Medium | Port metadata on builder output → B5-001 |
| G7b | Negotiation protocol — request/offer (Level 2) | 13 | High | Multi-pass composition or ordered composition → B5-002 |
| G7c | Transition zone blending (Level 3) | 3, 13 | Medium | Shared boundary geometry via loft → B5-003 |
| G8 | Morph targets / blend shapes | 4, 7 | Low (Phase 3) | Useful for variation and LOD blending |
| G9 | Procedural texture evaluation in UV/local space | 5 | Medium | Extends existing noise infra |
| G10 | Material layering (even simple 2-layer) | 5 | Medium | Currently deferred; even basic version is useful |
| G11 | Local coordinate frames for UVs | 5 | Low | Small extension to C4 |
| G12 | Height field to terrain mesh | 6 | Low | Simple new geometry operation |
| G13 | LOD system (scene-level tier selection) | 6, 7 | Medium | Builds on existing quality tiers |
| G14 | Chunk boundary stitching | 6 | Low | Constraint on height field sampling |
| G15 | View-dependent generation | 6, 7 | Medium | Scene orchestration layer |
| G16 | Symmetry operations (mirror, radial array) | 9 | Medium | Fundamental geometry operations |
| G17 | Style modifiers / style-as-composable-concern | 9, 10 | High | Core to the vision; no plan exists |
| G18 | Role-based composition (resolve builder by role + style) | 10 | High | Enables style cascading at scale |
| G19 | Cross-builder proportion constraints | 10 | Medium | Extends measurement constraints |
| G20 | Event-driven placement / narrative scripting | 11 | Low | Lightweight authored causation |
| G21 | Billboard / sprite primitives | 11 | Low | Simple geometry primitive |
| G22 | Actionable gate suggestions (machine-readable) | 12 | High | Critical for autonomous agent loop |
| G23 | Builder snapshot / rollback | 12 | Medium | Natural for YAML + git |
| G24 | Inter-builder lateral constraints | 8 | Medium | Constraint propagation across siblings |
| G25 | Assembly / connectivity metadata | 8 | Low | Extends PSD with non-spatial relationships |

### Priority Recommendations

**Should be added to current Phase 2 tracks** (high impact, moderate effort, unblocks core vision):
- G3, G4: Tag aggregation and summary queries — add to B2
- G5: Spatial relationship queries — add to B2-003
- G16: Symmetry operations — add to C-track
- G17, G18: Style modifiers and role-based composition — new track or extend B3/B4
- G22: Actionable gate suggestions — add to A2

**Should be planned for late Phase 2 / early Phase 3** (important but depends on Phase 2 foundations):
- G7a: Attachment point declarations (after B2 PSD stabilizes)
- G7b: Negotiation protocol (after B5-001 proves attachment points work)
- G7c: Transition zone blending (after G7b; may be late Phase 2 or Phase 3)
- G13, G15: LOD system and view-dependent generation (after Track D proves quality tiers)
- G19: Cross-builder constraints (after A2 gates are working)
- G23: Builder rollback (after B4 DSL authoring)

**Phase 3** (valid but can wait):
- G8: Morph targets
- G9, G10, G11: Procedural textures and material layering (after C3/C4)
- G12, G14: Terrain and chunk stitching
- G20, G21, G24, G25: Narrative, sprites, lateral constraints, assembly graphs
