# Master Plan - Procedurable

> **Purpose:** Vision, strategy, and philosophy. This is the "why" and "what".
> **Tactical Work:** See `BACKLOG.md` for detailed stories and tasks.
> We follow this plan. We don't freestyle. We only deviate for serious blockers.

---

## Related Documents

### Strategic Documents
- **`BACKLOG.md`** - Work items, stories, acceptance criteria (the "how")
- **`ARCHITECTURE.md`** - System design and technical decisions

### Artist Perspective (What to Build)
- `PROBLEM_DOMAIN.md` - Target builders and their requirements
- `SOLUTION_DOMAIN.md` - Geometry tools inventory

### Programmer Perspective (How to Author)
- `AUTHORING_PROBLEM_DOMAIN.md` - Builder authoring challenges
- `AUTHORING_SOLUTION_DOMAIN.md` - Authoring infrastructure inventory

### Cross-References
- `UNIFIED_ALIGNMENT.md` - Builder × Tool mapping (combined matrix)

### Scale & Algorithms
- `PROCEDURAL_TECHNIQUES.md` - Noise, patterns, layout algorithms
- `SCALE_AMBITION.md` - Infinite worlds, Doom levels, architecture

---

## Vision

**Procedurable is a toolkit for creating "virtual artists"** - procedural generators that make decisions like a human artist would:

1. **Style decisions** - Modern vs rustic, boxy vs rounded
2. **Proportion decisions** - Ergonomic standards, structural plausibility
3. **Composition decisions** - Scene layout, clutter, orientation
4. **Material decisions** - Surface appearance, wear, aging
5. **Production decisions** - LOD, UV density, export format

Each builder is deterministic (seed → same result) but expressive (wide variation space).

---

## Phases Overview

### Phase 1: Infrastructure ✅ COMPLETE
> MCP server and authoring API stable at v1.0.0.

**Delivered:**
- DSL command system with 29+ tested commands
- YAML builder format with expressions, decisions, composition
- Real-time dashboard with mesh preview
- Storage provider interface (filesystem, ready for S3)

### Phase 2: Toolkit Expansion 🟡 IN PROGRESS
> Build geometry/material tools by implementing builders across domains.
> PersonBuilder is the capstone - it uses everything.

**Philosophy:**
- Build tools by creating real builders, not tools in isolation
- Expose built tools before building new ones
- Follow domain analysis for optimal ordering

**Key Milestones (see BACKLOG.md for details):**

| Milestone | Purpose | Status |
|-----------|---------|--------|
| P2-M1 | Procedural Materials | ✅ Steps 1-3 |
| P2-M1b | Expose Lathe/Sweep/Subdiv | ✅ Complete |
| P2-M2 | Scene Constraints & Packing | ✅ Complete |
| P2-M2b | Authoring Infrastructure | ✅ Complete |
| P2-M2c | World Foundations | ✅ Complete |
| P2-M2d | Agent Authoring Layer | ⬜ Introspection, Validation |
| P2-M3 | 2D Shapes & Extrusion | ⬜ |
| P2-M4 | Text & Advanced 2D | ⬜ |
| P2-M5 | 3D Boolean CSG | ⬜ |
| P2-M6 | Botanical Systems | ⬜ |
| P2-M7 | Advanced Materials | ⬜ |
| P2-M8 | Cloth & Soft Bodies | ⬜ |
| P2-M9 | Characters (Capstone) | ⬜ Uses everything |
| P2-M10 | Renderer Package | ⬜ Deployment |

### Phase 3: Animation & Physics ⬜ FUTURE
> Rigged characters, keyframe animation, physics-based procedural animation.

**Prerequisites (must be in Phase 2):**
- Extended Vertex class (bone indices/weights)
- Mesh.morphTargets for blend shapes
- glTF-compatible structures

**Milestones:**
- P3-M1: Rigging (skeleton, weights, LBS skinning)
- P3-M2: Animation (keyframes, clips, curves)
- P3-M3: Physics Integration (rapier.js, bake to keyframes)
- P3-M4: Procedural Animation (walk cycles, ragdoll)

---

## Domain Analysis Summary

We identified **25+ target builders across 8 domains**. Each domain requires specific tools:

| Domain | Example Builders | Key Tools Needed |
|--------|-----------------|------------------|
| Furniture | Chair, Table, Bed | Loft, Subdivision, Constraints |
| Vessels | Vase, Mug, Bowl | Lathe, Sweep |
| Architecture | Room, Door, Window | 2D Shapes, CSG |
| Botanical | Tree, Plant, Flower | L-Systems, Sweep |
| Mechanical | Gear, Pipe | 2D Boolean, Radial Array |
| Signage | Sign, Label | Text, Extrusion |
| Clothing | Shirt, Pants | Patterns, Drape |
| Characters | Person, Animal | All of the above |

**Key Insight:** Expose built tools before building new ones. We had Lathe, Sweep, Subdivision built but not exposed - high value, low effort.

---

## Agent Authoring Vision

AI agents should be able to:

1. **Discover** - List builders, query their interfaces, see variation axes
2. **Create** - Build scenes by composing builders with overrides
3. **Validate** - Get structured feedback on mesh quality, ergonomics, stability
4. **Iterate** - Use goal-seeking commands like "place chairs around table"

This requires (P2-M2d):
- `system.list_builders`, `builder.get_interface`
- Semantic tagging of parts (structure, surface, decoration)
- Validation API with structured results
- High-level placement commands

---

## World-Scale Vision

For infinite worlds and large scenes (P2-M2c + future):

1. **Fields** - Scalar/vector fields for terrain, density, biomes
2. **Scatter** - Poisson disk for natural placement
3. **Instancing** - Non-merged output for large scenes
4. **Chunks** - Query-based generation for streaming
5. **Coordinate seeding** - Same coords + seed = same result

---

## Rules

1. **Follow the plan** - Don't add features not in the current milestone
2. **Fix bugs immediately** - But don't pivot the entire architecture
3. **Document decisions** - Update BACKLOG.md when plans change
4. **One milestone at a time** - Finish before starting the next
5. **Exit criteria matter** - Milestone isn't done until criteria are met
6. **Expose before building** - DSL-expose built tools before writing new ones
7. **Domain-driven tools** - Build tools by implementing real builders
8. **PersonBuilder is capstone** - It comes last, uses everything
9. **All DSL commands require integration tests** - No shipping untested commands
10. **Phase 3 foundation in Phase 2** - Design structures for future rigging/animation

---

## Session Log

### 2026-01-13
- Created Master Plan with two phases
- Phase 1: Infrastructure (MCP + Authoring) → v1.0.0 RC
- Phase 2: Toolkit Expansion (domain-driven)
- PersonBuilder frozen as capstone for Phase 2
- **M4 COMPLETE:** DiningScene, command console, COMPOSITION_API.md

### 2026-01-14
- **Domain Analysis Complete:**
  - PROBLEM_DOMAIN.md (25 target builders, 8 domains)
  - SOLUTION_DOMAIN.md (tool inventory)
  - ALIGNMENT_MATRIX.md (optimal ordering)
- **P2-M1b Progress:** Lathe, Sweep, Subdivision exposed. Vase, Mug, Cushion created.
- **P2-M2 COMPLETE:** AABB, Placement.ts, DiningScene fixed (no overlaps)
- **Authoring Analysis:** Created AUTHORING_*.md documents
- **Scale Vision:** PROCEDURAL_TECHNIQUES.md, SCALE_AMBITION.md
- **P2-M2b Progress:** Conditional/iterative composition, Perlin/FBM noise

### 2026-01-15
- **Documentation Consolidation:**
  - Created BACKLOG.md with structured stories for AI agents
  - Slimmed MASTER_PLAN.md to strategy/vision focus
  - Created UNIFIED_ALIGNMENT.md (merged alignment matrices)
  - Fixed M6 naming inconsistency (Agent Authoring → P2-M2d)
- **P2-M1b COMPLETE:**
  - Added 8 integration tests for lathe, sweep, subdivide (41 total tests, all passing)
  - Fixed critical bug in YamlBuilderParser: `when:` condition was checking `cmd.geometry` instead of `cmd.when`
  - Documented YAML geometry commands in DSL_COMMANDS.md (lathe, sweep, subdivide, profiles, splines)
  - All geometry builders verified: Vase, Mug, Cushion working correctly
- **P2-M2b-003 COMPLETE: Conditional Expressions**
  - Added `if(condition, then, else)` function to MathService
  - Fixed YamlBuilderParser derived value evaluation to include decision values
  - Boolean decisions converted to 1/0 for math expressions
  - Derived values now accessible via measurements API
  - 24 unit tests + 3 integration tests passing (44/44 total integration tests)
  - ConditionalTest.yaml builder demonstrates usage
- **P2-M2b-004 COMPLETE: Better Error Context**
  - Added ParsingContext class for YAML path tracking during parsing
  - Wrapped all 5 parsing phases with try-catch-finally for proper error context
  - Enhanced geometry errors to include both path and command index
  - Error format: "Error at {yaml.path}: {message}" (e.g., "Error at decisions.bad_number: min must be <= max")
  - Created comprehensive test suite (ErrorContext.test.ts)
  - Fixed 2 bugs: builder.name access, resolveColor arguments
  - All existing builders still work (68/68 tests passing)
- **Cross-Builder Communication Analysis:**
  - Created CROSS_BUILDER_COMMUNICATION.md documenting current state and future needs
  - Added P2M2d-002 (Constraint Context) and P2M2d-003 (Shared Context Store) to backlog as mandatory
  - Added FR-001 (Feedback Loop) and FR-002 (Constraint Solver) to backlog as optional/deferred
  - Enhanced P2M2d-005 (Semantic Scene Graph) with cross-component query capabilities
  - Three complementary mechanisms: Constraints (parent→child), Context (global state), Scene Graph (queries)
- **P2-M2c-001 COMPLETE: Scalar Field Abstraction**
  - Created ScalarField interface for terrain, density masks, and world queries
  - Implemented 4 basic fields: Constant, Noise2D, Noise3D, FBM
  - Implemented 5 operations: Remap, Clamp, Add, Multiply, Scale
  - Convenient factory API via `field` object
  - 40+ comprehensive unit tests in ScalarField.test.ts
  - Foundation for world-scale generation ready
- **P2-M2c-002 COMPLETE: Poisson Disk Scatter**
  - Implemented Bridson's algorithm with grid acceleration (O(n) performance)
  - Rectangle and circle bounds support
  - Field-driven density (integrates with ScalarField from P2M2c-001!)
  - Deterministic seeding for reproducible patterns
  - 30+ comprehensive tests covering all edge cases
  - Real-world examples: forest scatter, rock scatter, table clutter, clearings
  - TreeScatter.yaml demo builder created
- **Hot Reload Fix: YAML Builder Cache Invalidation**
  - Fixed MCP server caching issue - YAML builders were cached at startup and never refreshed
  - Added `invalidateBuilderCache()` function to reload/remove cached builders on file changes
  - Added `setupCacheInvalidation()` to register file watcher callback
  - File changes now automatically invalidate cache - no server restart needed for YAML edits!
  - Console logs file changes: "File change detected: TreeScatter (modified)" → "Cache reloaded: TreeScatter"

### 2026-01-16
- **P2-M2c-003 COMPLETE: Instancing Output**
  - Added `asInstance?: boolean` parameter to `compose()` method
  - When true, stores instance data instead of merging mesh
  - Instance data: id, builderName, transform (position, rotation, scale), overrides, seed
  - Added `instances` array to TracedBuilder and TracedOutput
  - Updated YamlComposition and YamlPlacement interfaces with `asInstance` field
  - Both `compose:` and `placement:` sections support instancing
  - New DSL command: `builder.instances` - query instance data from last run
  - ForestSlice.yaml demo: ground plane (merged) + trees (instanced)
  - 2 integration tests added: instancing with ForestSlice, non-instancing with DiningScene
  - Enables efficient world-scale scenes without mesh merging overhead
- **P2-M2c COMPLETE: World Foundations Epic**
  - 5/5 stories complete: Fields, Scatter, Instancing, Chunk Contract, WorldSlice (ready)
  - Foundation ready for infinite world streaming
  - Deterministic coordinate-based generation
  - All systems integrate: fields drive scatter density, scatter creates instances
  - CHUNK_CONTRACT.md documents deterministic function contract
  - Next up: P2-M2d (Agent Authoring Layer)

