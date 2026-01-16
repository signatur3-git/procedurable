# Procedurable Backlog

> **Purpose:** Tactical work items for AI coding agents and human developers.
> **Source of Truth:** This document defines what to build next. See `MASTER_PLAN.md` for strategy and vision.

---

## How to Use This Backlog

### Story Format

Each story follows this structure for AI agent consumption:

```
## [ID]: Story Title
**Epic:** Parent milestone/epic
**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete | 🔒 Blocked
**Size:** XS (< 1hr) | S (1-4hr) | M (4-8hr) | L (1-2 days) | XL (3+ days)
**Dependencies:** [List of story IDs or "None"]

### Context
Brief description of why this work matters.

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

### Files to Modify
- `path/to/file.ts`

### Notes
Optional implementation hints or agent guidance.
```

### Priority Labels

- **P0 Critical:** Blocking other work
- **P1 High:** Current sprint/focus
- **P2 Medium:** Next up
- **P3 Low:** Future consideration

---

## Quick Status

| Epic                             | Stories | Done | In Progress | Blocked |
|----------------------------------|---------|------|-------------|---------|
| P2-M1b: Expose Built Tools       | 5       | 5    | 0           | 0       |
| P2-M2b: Authoring Infrastructure | 5       | 5    | 0           | 0       |
| P2-M2c: World Foundations        | 5       | 5    | 0           | 0       |
| P2-Dashboard: Visualization      | 3       | 3    | 0           | 0       |
| P2-M2d: Agent Authoring Layer    | 7       | 0    | 0           | 0       |
| P2-M2d: Agent Authoring Layer    | 7       | 0    | 0           | 0       |
| Future/Research (Optional)       | 2       | 0    | 0           | 0       |
| P2-M3: 2D Shapes & Extrusion     | 5       | 0    | 0           | 0       |
| P2-M4: Text & Advanced 2D        | 5       | 0    | 0           | 1       |
| P2-M5: 3D Boolean CSG            | 5       | 0    | 0           | 1       |
| P2-M6: Botanical Systems         | 5       | 0    | 0           | 0       |
| P2-M7: Advanced Materials        | 5       | 0    | 0           | 0       |
| P2-M8: Cloth & Soft Bodies       | 4       | 0    | 0           | 0       |
| P2-M9: Characters (Capstone)     | 6       | 0    | 0           | 0       |
| P2-M10: Renderer Package         | 5       | 0    | 0           | 0       |

---

# ACTIVE WORK

## Epic: P2-M1b - Expose Built Geometry Tools

> **Goal:** Expose Spline, Lathe, Sweep, Subdivision via DSL/YAML to unlock ~15 builders.
> **Status:** 🟡 Steps 1-4 complete, Step 5 remaining

### P2M1b-005: Integration Tests & Cleanup

**Epic:** P2-M1b Expose Built Tools
**Status:** ✅ Complete
**Size:** M
**Priority:** P1
**Dependencies:** None (Steps 1-4 complete)

#### Context

The lathe, sweep, and subdivide commands are implemented and working. We need integration tests to ensure stability and
documentation updates.

#### Acceptance Criteria

- [x] Add integration tests for lathe YAML command
- [x] Add integration tests for sweep YAML command
- [x] Add integration tests for subdivide YAML command
- [x] Clean up test builders (MugBody can be removed)
- [x] Update `docs/DSL_COMMANDS.md` with new geometry commands
- [x] Verify Vase, Mug, Cushion builders work in dashboard

#### Files to Modify

- `src/tests/mcp-integration.test.ts` ✅
- `docs/DSL_COMMANDS.md` ✅
- `builders/` (cleanup)

#### Notes

Use existing test patterns. Each new command needs at least 2 tests (success case, error case).

**Completed:** 2026-01-15
- Added 8 new integration tests for lathe, sweep, subdivide
- Fixed bug in YamlBuilderParser where `when:` condition was checking wrong field
- Documented YAML geometry commands in DSL_COMMANDS.md
- All 41 tests now pass

---

## Epic: P2-M2b - Authoring Infrastructure

> **Goal:** Add conditional/iterative composition, better errors, conditional expressions.
> **Status:** 🟡 Steps 1-2 + Noise complete, Steps 3-4 remaining

### P2M2b-003: Conditional Expressions

**Epic:** P2-M2b Authoring Infrastructure
**Status:** ✅ Complete
**Size:** S
**Priority:** P1
**Dependencies:** None

#### Context

Enable `if(condition, then, else)` in math expressions for complex derived values.

#### Acceptance Criteria

- [x] Add `if(condition, then, else)` function to MathService
- [x] Condition supports: boolean values, comparisons (`>`, `<`), equality (`==`, `!=`)
- [x] Works with decision references: `if($is_round, 0.5, 0.4)`
- [x] Add unit tests for conditional expressions
- [x] Update expression documentation

#### Files to Modify

- `src/core/MathService.ts` ✅
- `src/tests/__tests__/MathService.test.ts` ✅ (new, 24 tests passing)
- `src/builder/YamlBuilderParser.ts` ✅ (derived values with decision access)
- `docs/YAML_BUILDER_FORMAT.md` ✅

#### Notes

Parse condition as sub-expression. Handle string comparisons for decision values.

**Completed:** 2026-01-15
- Added `if()` function to MathService with mathjs integration
- Fixed YamlBuilderParser to pass decision values to derived expressions
- Boolean decisions converted to 1/0 for math expressions
- Derived values added to measurements Map for API access
- 24 unit tests passing, 44 integration tests passing
- ConditionalTest.yaml builder demonstrates all features

---

### P2M2b-004: Better Error Context

**Epic:** P2-M2b Authoring Infrastructure
**Status:** ✅ Complete
**Size:** M
**Priority:** P1
**Dependencies:** None

#### Context

Error messages should include YAML path for easier debugging. Currently errors like "min must be <= max" don't say which
field.

#### Acceptance Criteria

- [x] Include YAML path in error messages
- [x] Format: "Error at decisions.chair_count: min must be <= max"
- [x] Track source locations during YAML parsing
- [x] Errors include line numbers when available
- [x] All existing builders still work

#### Files to Modify

- `src/builder/YamlBuilderParser.ts` ✅
- Error handling throughout ✅

#### Notes

Consider adding a context stack during parsing that tracks current path.

**Completed:** 2026-01-15
- Added ParsingContext class for YAML path tracking
- Wrapped all 5 parsing phases (decisions, measurements, derived, geometry, compositions)
- Enhanced geometry errors with command index
- Created comprehensive test suite (ErrorContext.test.ts)
- Fixed 2 bugs during implementation
- All tests passing (24 unit + 44 integration)

---

### Infrastructure-001: Webhook System & Hot Reload Notifications

**Epic:** P2-M2b Authoring Infrastructure
**Status:** ✅ Complete
**Size:** M
**Priority:** P1
**Dependencies:** None

#### Context

When the authoring server hot-reloads builders, MCP servers experience brief unavailability. This can cause confusing timeouts and errors for agents. Implement a webhook system so MCP servers can be notified of hot reloads and provide better status messages.

#### Acceptance Criteria

- [x] Authoring server webhook registration API (`/api/webhooks/register`, `/unregister`, `/list`)
- [x] Hot reload events broadcast to registered webhooks
- [x] MCP HTTP server auto-registers on startup
- [x] MCP server tracks hot reload status
- [x] Retry logic with exponential backoff (3 retries: 100ms, 200ms, 400ms)
- [x] Tool responses include hot reload status when applicable
- [x] Graceful shutdown unregisters webhooks
- [x] Health endpoints show webhook status

#### Files Modified

- `src/authoring/server.ts` ✅ - Webhook registry, notification system
- `src/mcp/http-server.ts` ✅ - Webhook handler, auto-registration, status tracking
- `src/mcp/server.ts` ✅ - Retry logic with exponential backoff
- `docs/WEBHOOK_SYSTEM.md` ✅ - Comprehensive documentation

#### Implementation Notes

- Authoring server broadcasts `hot_reload` events to all registered webhooks
- MCP server sets `isReloading` flag for 2 seconds after receiving notification
- Error messages include helpful hints during hot reload: "The authoring server is currently reloading builder: X"
- Fetch retry logic handles brief unavailability during hot reloads
- All webhook operations are async to avoid blocking server

**Completed:** 2026-01-16

---

# NEXT UP (P2)

## Epic: P2-M2c - World Foundations

> **Goal:** Add fields, scatter, instancing for world-scale content from single seed.
> **Status:** ⬜ Not Started
> **Reference:** `AUTHORING_PROBLEM_DOMAIN.md` (Level 7), `SCALE_AMBITION.md`

### P2M2c-001: Scalar Field Abstraction

**Epic:** P2-M2c World Foundations
**Status:** ✅ Complete
**Size:** M
**Priority:** P2
**Dependencies:** None

#### Context

Introduce minimal `ScalarField` concept for terrain, density masks, and world queries.

#### Acceptance Criteria

- [x] Create `ScalarField` interface with `sample(x, y, z): number`
- [x] Implement `field.constant(value)` adapter
- [x] Implement `field.noise2d(seed, frequency, amplitude)` wrapper for MathService
- [x] Implement `field.remap(field, inMin, inMax, outMin, outMax)`
- [x] Implement `field.clamp(field, min, max)`
- [x] Add unit tests for all field types

#### Files to Modify

- `src/core/ScalarField.ts` ✅ (new, 300 lines)
- `src/tests/__tests__/ScalarField.test.ts` ✅ (new, 300+ lines, comprehensive tests)

#### Notes

Implemented complete scalar field system with:
- Basic fields: Constant, Noise2D, Noise3D, FBM
- Operations: Remap, Clamp, Add, Multiply, Scale
- Convenient factory API via `field` object
- Real-world examples for terrain, density masks, biomes

**Completed:** 2026-01-15
- Created ScalarField interface and implementations
- Comprehensive test suite with 40+ test cases
- Ready for world generation features

---

### P2M2c-002: Poisson Disk Scatter

**Epic:** P2-M2c World Foundations
**Status:** ✅ Complete
**Size:** M
**Priority:** P2
**Dependencies:** P2M2c-001

#### Context

Implement Bridson Poisson disk sampling for natural scatter patterns.

#### Acceptance Criteria

- [x] Implement 2D Poisson disk sampling (Bridson algorithm)
- [x] Support bounds parameter (scatter within rectangle)
- [x] Support minimum distance parameter
- [x] Support field-driven density mask (higher density where mask is high)
- [x] Output: list of {x, z} points
- [x] Deterministic with seed
- [x] Integration with YAML placement system
- [x] Test with real builders (TreeScatter, ForestSlice)
- [x] Fix center/bounds issues

#### Files Modified

- `src/core/Scatter.ts` ✅ (Poisson disk sampling implementation)
- `src/tests/__tests__/scatter.test.ts` ✅ (13 passing tests)
- `src/builder/YamlBuilderParser.ts` ✅ (scatter_poisson placement mode)
- `builders/ForestSlice.yaml` ✅ (instanced scatter demo)
- `builders/TreeScatter.yaml` ✅ (merged scatter demo)
- `builders/Tree.yaml` ✅ (new, simple tree for instancing)

#### Implementation Notes

- Created full Bridson Poisson disk algorithm with spatial grid optimization
- Added density mask support for variable spacing (e.g., denser near center)
- Integrated with YAML placement system as `scatter_poisson` mode
- Fixed center/bounds calculation for proper tree placement
- TreeScatter: Merged geometry (50m×50m, 20-60 trees, centered at 25,25)
- ForestSlice: Instanced geometry (20m×20m, 5-15 trees, centered at 0,0)
- Tree: Simple trunk builder for instancing (no ground plane)
- All tests passing, both demo builders working correctly

**Completed:** 2026-01-16

---

### P2M2c-003: Instancing Output

**Epic:** P2-M2c World Foundations
**Status:** ✅ Complete
**Size:** M
**Priority:** P2
**Dependencies:** None

#### Context

Define output representation for instances (non-merged meshes) for large scenes.

#### Acceptance Criteria

- [x] Define `Instance` interface: `{ builder, transform: {pos, rot, scale}, overrides }`
- [x] Builders can output `instances[]` instead of/alongside merged mesh
- [x] Dashboard renders instances without merging
- [x] Serialize/deserialize instances in scene output

#### Files to Modify

- `src/builder/TracedBuilder.ts` ✅
- `src/builder/YamlBuilderParser.ts` ✅
- `src/authoring/commands/builder.ts` ✅
- `src/tests/mcp-integration.test.ts` ✅
- `builders/ForestSlice.yaml` ✅ (demo)

#### Notes

Implemented complete instancing output system for world-scale scenes.

**TracedBuilder Changes:**
- Added `instances` array to private fields
- Added `asInstance?: boolean` parameter to `compose()` method
- When `asInstance=true`, stores instance data instead of merging mesh
- Instance data includes: id, builderName, transform (position, rotation, scale), overrides, seed
- Updated `build()` to include instances in TracedOutput when array is not empty
- Composition trace includes `asInstance: true` flag for debugging

**YamlBuilderParser Changes:**
- Added `asInstance?: boolean` field to YamlComposition interface
- Added `asInstance?: boolean` field to YamlPlacement interface
- Both `compose:` and `placement:` sections now support instancing
- Pass asInstance flag from YAML to TracedBuilder.compose() calls

**DSL Command:**
- `builder.instances` - Query instance data from last run
- Returns count and array of instances
- Returns friendly message when no instances (all merged)

**Demo Builder:**
- `ForestSlice.yaml` - Ground plane (merged) + trees (instanced)
- Uses `placement` with `asInstance: true`
- Demonstrates instancing for world-scale scenes

**Integration Tests:**
- Test instancing with ForestSlice (verifies instances are created)
- Test non-instancing with DiningScene (verifies default merge behavior)
- Both tests verify correct API responses

**Benefits:**
- Enables efficient large-scale scenes (no mesh merging overhead)
- Supports streaming/chunked worlds
- Maintains deterministic seeding per instance
- Backward compatible (default behavior unchanged)

**Completed:** 2026-01-16
- Full instancing system implemented
- 2 new integration tests added
- Demo builder created
- Ready for world-scale generation (P2M2c-005)

---

### P2M2c-004: Chunk Query Contract

**Epic:** P2-M2c World Foundations
**Status:** ✅ Complete
**Size:** S
**Priority:** P2
**Dependencies:** P2M2c-001, P2M2c-003

#### Context

Define minimal query-based contract for eventual streaming worlds.

#### Acceptance Criteria

- [x] Design document: chunk contract specification
- [x] DSL command: `world.sampleHeight x=<x> z=<z> seed=<seed>`
- [x] DSL command: `world.instances bounds=<...> seed=<seed>`
- [x] Document boundary consistency patterns (padding/border overlap)

#### Files to Modify

- `docs/CHUNK_CONTRACT.md` ✅ (new, comprehensive 400+ line spec)
- `src/authoring/commands/world.ts` ✅ (new, world query commands)
- `src/authoring/server.ts` ✅ (registered world namespace)

#### Notes

Implemented complete chunk query contract for deterministic world generation.

**Documentation (`CHUNK_CONTRACT.md`):**
- Core concept: coordinate-based generation
- Deterministic function contract (same coords + seed → same output)
- Query interface (height queries, instance queries)
- Boundary consistency patterns (center rule, padding, deduplication)
- Implementation examples with code
- Coordinate hash functions (simple and quality versions)
- Testing checklist

**DSL Commands:**
- `world.sampleHeight x=<x> z=<z> seed=<seed>` - Query terrain height at point
- `world.instances bounds={minX:0,maxX:50,minZ:0,maxZ:50} seed=<seed>` - Query instances in region

**Features:**
- Coordinate hashing for deterministic seeding
- Integrates with ScalarField (P2M2c-001) for terrain
- Integrates with PoissonDisk (P2M2c-002) for scatter
- Integrates with Instance (P2M2c-003) for output
- Boundary-safe generation with center rule
- Ready for infinite world streaming

**Completed:** 2026-01-15
- Full specification document
- Working DSL commands
- All three systems integrated (fields, scatter, instances)
- Foundation for chunk-based world streaming

---

### P2M2c-005: WorldSlice Demo Builder

**Epic:** P2-M2c World Foundations
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P2
**Dependencies:** P2M2c-001, P2M2c-002, P2M2c-003

#### Context

Create demo builder showing fields + scatter + instancing together.

#### Acceptance Criteria

- [ ] Create `WorldSlice.yaml` demo builder
- [ ] Uses field(noise) as terrain height
- [ ] Uses Poisson scatter for tree/rock placement
- [ ] Returns instances (not merged mesh)
- [ ] Deterministic by coordinate (same seed+coords → same output)

#### Files to Modify

- `builders/WorldSlice.yaml` (new)

---

## Epic: P2-Dashboard - Visualization Improvements

> **Goal:** Fix dashboard rendering to visualize all builder features correctly.
> **Status:** ⬜ Not Started
> **Priority:** P2

### Dashboard-001: Instance Rendering

**Epic:** P2-Dashboard Visualization
**Status:** ✅ Complete
**Size:** M
**Priority:** P2
**Dependencies:** P2M2c-003 (Instancing Output)

#### Context

The dashboard currently only renders merged mesh geometry. Builders using `asInstance: true` (like ForestSlice with scattered trees) only show the ground plane because instance data isn't being rendered.

#### Acceptance Criteria

- [x] Fetch instance data from `builder.instances` command
- [x] Render each instance as a separate Three.js mesh
- [x] Apply correct transforms (position, rotation, scale) to each instance
- [x] Show instance count in UI
- [x] Color instances differently from merged geometry (olive green #6b8e23)
- [x] ForestSlice shows all scattered trees
- [ ] TreeScatter should be updated to use Poisson scatter (deferred - placeholder is acceptable)

#### Files Modified

- `src/dashboard/main.ts` ✅ - Instance fetching, rendering, and UI display
  - Added instance fetching in runCurrentSeed
  - Added instance rendering loop in updateMainMesh
  - Each instance recursively fetches sub-builder mesh
  - Transform (position, rotation, scale) applied correctly
  - Instance count shown in detail panel
  - Loading indicator during mesh updates

**Completed:** 2026-01-16
- ForestSlice now renders all 11 scattered tree instances
- Instances colored olive green to distinguish from merged geometry
- Instance count displayed in detail panel

---

### Dashboard-002: Decision Override UI

**Epic:** P2-Dashboard Visualization
**Status:** ✅ Complete
**Size:** M
**Priority:** P2
**Dependencies:** None

#### Context

The dashboard displays decision values but provides no UI to override them. Users can't manually test different variations (e.g., `is_round: true` vs `false`, `size_category: small/medium/large`) without changing seeds repeatedly and hoping for the right random value.

#### Acceptance Criteria

- [x] Add UI controls next to each decision in the panel
- [x] Boolean decisions → toggle switch
- [x] Choice decisions → dropdown menu
- [x] Number decisions → input field
- [x] Count decisions → number input (same as number)
- [x] "Reset to Default" button per decision
- [x] "Reset All" button
- [x] Use `decision.override` command to set values
- [x] Re-run builder automatically when decision is changed
- [x] Show "(overridden)" indicator in UI for non-default values

#### Files Modified

- `src/dashboard/main.ts` ✅ - Interactive decision controls
  - Added toggle switches for boolean decisions
  - Added dropdown selects for choice decisions
  - Added number inputs for numeric decisions
  - Added reset buttons with visual feedback
  - Functions: overrideDecision, toggleDecision, resetDecision, resetAllDecisions
  - Exposed functions globally for HTML onclick handlers
  - Automatic re-run on decision change
- `dashboard.html` ✅ - Styling for controls
  - Toggle switch styling with smooth animations
  - Input/select styling matching dashboard theme
  - Reset button hover effects
  - Overridden state highlighting (blue left border)

**Completed:** 2026-01-16
- All decision types have interactive controls
- Overridden decisions highlighted with blue border
- Reset buttons appear only for overridden decisions
- Reset All button in section header

---

### Dashboard-003: Mesh Update on Seed Change

**Epic:** P2-Dashboard Visualization
**Status:** ✅ Complete
**Size:** S
**Priority:** P2
**Dependencies:** None

#### Context

When changing seeds via the UI, the decision values update but the 3D mesh doesn't always refresh correctly. Some builders show the same geometry for different seeds.

#### Acceptance Criteria

- [x] Verify seed change triggers full mesh refresh
- [x] Clear old geometry before adding new
- [x] Test with ConditionalTest (geometry should change based on `is_round`)
- [x] Test with Cushion (different shapes should be visible)
- [x] Add visual indicator when mesh is loading
- [ ] Camera should re-center on bounds change (deferred - optional)

#### Files Modified

- `src/dashboard/main.ts` ✅ - Mesh update reliability
  - Added loading state at start of updateMainMesh
  - Ensured old mesh is cleared before rendering new
  - Added finally block to always clear loading state
  - Empty geometry check before creating mesh
  - Better error handling with fallback to placeholder

**Completed:** 2026-01-16
- Loading overlay shows during mesh updates
- Old geometry properly cleared each time
- Mesh updates reliably on seed changes
- Loading state cleaned up even on errors

Possible bug: Mesh update might be cached or not clearing properly
Test case: ConditionalTest with seeds 1,2,3,100 should show different geometries

---

## Epic: P2-M2d - Agent Authoring Layer

> **Goal:** Enable AI agents to discover, utilize, and validate procedural capabilities.
> **Status:** ⬜ Not Started
> **Reference:** MASTER_PLAN.md "Agent-Authoring Layer" section

### P2M2d-001: System Introspection

**Epic:** P2-M2d Agent Authoring Layer
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P2
**Dependencies:** None

#### Context

Agent needs to discover available builders and their interfaces.

#### Acceptance Criteria

- [ ] DSL command: `system.list_builders` - returns all available builders
- [ ] DSL command: `builder.get_interface <name>` - returns parameters, decisions, variation axes
- [ ] DSL command: `system.list_tools` - returns available geometry commands
- [ ] Interface output includes types, ranges, and defaults

#### Files to Modify

- `src/authoring/commands/` (new commands)
- `src/builder/YamlBuilderParser.ts` (expose metadata)

---

### P2M2d-002: Constraint Context

**Epic:** P2-M2d Agent Authoring Layer
**Status:** ⬜ Not Started
**Size:** S
**Priority:** P1
**Dependencies:** None

#### Context

Parent builders need to pass rich constraints to children beyond simple overrides. Enable semantic relationships like "chair must face table" or "fit within this space".

**Reference:** `CROSS_BUILDER_COMMUNICATION.md` Priority 1

#### Acceptance Criteria

- [ ] Add `constraints` field to YamlComposition interface
- [ ] Pass constraints to child builders as special override: `__constraints__`
- [ ] Child builders can query constraints: `builder.getConstraint('max_height')`
- [ ] Add constraint validation reporting in TracedOutput
- [ ] Example: `ChairInBounds.yaml` demo with spatial constraints
- [ ] Example: `ChairFacingTable.yaml` demo with pose constraints
- [ ] Documentation in YAML_BUILDER_FORMAT.md

#### Files to Modify

- `src/builder/YamlBuilderParser.ts` (add constraints field)
- `src/builder/TracedBuilder.ts` (getConstraint method, validation)
- `builders/ChairInBounds.yaml` (new demo)
- `builders/ChairFacingTable.yaml` (new demo)
- `docs/YAML_BUILDER_FORMAT.md` (document constraints)

#### Example Usage

```yaml
compose:
  chair_1:
    builder: Chair
    offset: { x: 0, y: 0, z: 1 }
    constraints:
      max_height: 0.9
      max_footprint: 
        width: 0.5
        depth: 0.5
      pose:
        facing: center
        angle_tolerance: 15
      required_tags: [seating, stable]
```

#### Notes

Constraints are passed as metadata, not enforced by framework. Child builder is responsible for:
1. Reading constraints via `builder.getConstraint(key)`
2. Validating its output satisfies constraints
3. Reporting violations in validation.issues

This enables semantic relationships while keeping children autonomous.

---

### P2M2d-003: Shared Context Store

**Epic:** P2-M2d Agent Authoring Layer
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P1
**Dependencies:** None

#### Context

Enable scene-level shared state for sibling awareness and global coordination. Like Vuex/Pinia for builders - children can read theme settings, report their sizes, and see each other's decisions.

**Reference:** `CROSS_BUILDER_COMMUNICATION.md` Priority 2

#### Acceptance Criteria

- [ ] Create `SharedContext` class (structured key-value store)
- [ ] Add `shared_context` top-level YAML section
- [ ] Add `read_context` field to composition (list of keys to inject)
- [ ] Add `write_context` field to composition (key-value pairs to write back)
- [ ] Pass SharedContext through ParseOptions
- [ ] Evaluation order: parent decisions → shared context → children (left-to-right)
- [ ] Example: `ThemedRoom.yaml` with global style coordination
- [ ] Example: `AdaptiveLayout.yaml` with sibling size awareness
- [ ] Documentation in YAML_BUILDER_FORMAT.md

#### Files to Modify

- `src/builder/SharedContext.ts` (new)
- `src/builder/YamlBuilderParser.ts` (process shared_context section)
- `builders/ThemedRoom.yaml` (new demo)
- `builders/AdaptiveLayout.yaml` (new demo)
- `docs/YAML_BUILDER_FORMAT.md` (document shared context)

#### Example Usage

```yaml
# Scene-level shared state
shared_context:
  theme:
    style: modern
    primary_wood: oak
    accent_metal: steel
  spatial:
    room_width: 5.0
    occupied_zones: []

compose:
  table:
    builder: Table
    read_context: [theme, spatial]
    write_context:
      table_bounds: $bounds  # Report size back
      table_center: $center
  
  chair_1:
    builder: Chair
    read_context: [theme, table_bounds, table_center]
    write_context:
      chair_1_position: $position
```

#### Notes

**Evaluation Order Challenge:** Need to decide:
1. **Sequential:** Left-to-right, children can see previous siblings
2. **Two-pass:** All children read, then all write, then rebuild
3. **Lazy:** On-demand resolution with cycle detection

Recommend **Sequential** for MVP - simple and predictable. Add two-pass in future if needed.

**Type Safety:** SharedContext is `Map<string, any>` for flexibility. Could add schema validation later.

---

### P2M2d-005: Semantic Scene Graph

**Epic:** P2-M2d Agent Authoring Layer
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P2
**Dependencies:** None

#### Context

Enable functional understanding of scenes through semantic tags and queryable scene graph. This enables:
1. **Agent understanding** - "Find all seating surfaces" instead of "find specific mesh indices"
2. **Cross-component queries** - Children can query siblings: "Where are the other chairs?"
3. **Constraint validation** - "Am I sitting on a stable surface?"
4. **Layout algorithms** - "Place decorations on all horizontal surfaces"

**Relationship to Cross-Builder Communication:**
- Complements **Shared Context Store (P2M2d-003)** - Context is write-only, Scene Graph is read-only query
- Enables spatial queries: "What's near me?", "What am I facing?"
- Enables semantic queries: "Find all support structures", "Get table surface"

#### Acceptance Criteria

**Phase 1: Tagging**
- [ ] Add `tag:` property to YAML geometry commands (faces, loops, vertices)
- [ ] Add `tags:` array property to composition (tag entire sub-builder)
- [ ] Tags propagate through composition hierarchy
- [ ] Store tags in TracedOutput with geometry references
- [ ] Example tags: 'structure', 'surface', 'decoration', 'support', 'seating', 'handle'

**Phase 2: Scene Graph API**
- [ ] Build scene graph after composition: `SceneGraph` class with nodes
- [ ] Each node has: name, tags, bounds (AABB), parent/children, transform
- [ ] Store in TracedOutput: `sceneGraph: SceneGraph`

**Phase 3: Query DSL Commands**
- [ ] DSL command: `scene.query_by_tag <tag>` - find parts by functional tag
- [ ] DSL command: `scene.query_by_part <name>` - find parts by instance name
- [ ] DSL command: `scene.query_nearby <name> radius=<r>` - spatial query
- [ ] DSL command: `scene.query_facing <name> angle=<deg>` - orientation query
- [ ] Return: list of scene nodes with names, tags, bounds, transforms

**Phase 4: Builder-Accessible Queries (Advanced)**
- [ ] Builders can query scene during composition via `builder.queryScene(tag)`
- [ ] Example: Chair can check `builder.queryScene('table')` to face it
- [ ] Example: Clutter can query `builder.queryScene('surface')` to place on tables
- [ ] **Note:** Requires evaluation order (parent/siblings before this child)

#### Files to Modify

- `src/builder/SceneGraph.ts` (new - graph data structure)
- `src/builder/TracedBuilder.ts` (store tags, build scene graph)
- `src/builder/YamlBuilderParser.ts` (parse tags, build scene graph)
- `src/authoring/commands/scene.ts` (new - query commands)
- `builders/TaggedChair.yaml` (new demo - chair with tagged parts)
- `builders/SemanticRoom.yaml` (new demo - room with queries)
- `docs/YAML_BUILDER_FORMAT.md` (document tags and queries)

#### Example Usage

**Tagging geometry:**
```yaml
geometry:
  - loop: seat_top
    vertices: [seat_tl, seat_tr, seat_br, seat_bl]
    purpose: seating
    tags: [surface, seating, horizontal]  # NEW
  
  - loop: leg_bottom
    vertices: [...]
    purpose: structure
    tags: [support, structure, ground_contact]  # NEW
```

**Tagging compositions:**
```yaml
compose:
  table:
    builder: Table
    offset: { x: 0, y: 0, z: 0 }
    tags: [furniture, table, surface_provider]  # NEW - tag entire sub-builder
  
  chair_1:
    builder: Chair
    offset: { x: 1, y: 0, z: 0 }
    tags: [furniture, seating, chair]  # NEW
```

**Querying from DSL:**
```bash
# Find all surfaces for clutter placement
scene.query_by_tag surface

# Find table to get its size
scene.query_by_part table

# Find what's near chair_1
scene.query_nearby chair_1 radius=1.0

# Find what chair_1 is facing
scene.query_facing chair_1 angle=45
```

**Advanced: Builder-time queries (Phase 4):**
```yaml
# Future: Chair queries scene to orient itself
compose:
  chair_1:
    builder: SmartChair
    # SmartChair internally does:
    # const tables = builder.queryScene('table')
    # const tableCenter = tables[0].bounds.center
    # Face toward tableCenter
```

#### Notes

**Scene Graph Structure:**
```typescript
interface SceneNode {
  name: string;              // "chair_1"
  path: string;              // "scene.dining.chair_1"
  tags: string[];            // ["furniture", "seating"]
  bounds: AABB;              // Bounding box
  transform: Mat4;           // World transform
  parent: SceneNode | null;  // Parent node
  children: SceneNode[];     // Child nodes
  geometryRefs?: {           // References to actual mesh data
    vertices: number[];
    faces: number[];
    loops: Map<string, number[]>;
  };
}

class SceneGraph {
  root: SceneNode;
  nodes: Map<string, SceneNode>;  // Fast lookup by name
  
  queryByTag(tag: string): SceneNode[];
  queryByName(name: string): SceneNode | null;
  queryNearby(name: string, radius: number): SceneNode[];
  queryFacing(name: string, angleDeg: number): SceneNode[];
}
```

**Evaluation Order for Phase 4 (Builder Queries):**
If builders need to query the scene during composition, we need:
1. Build parent geometry first
2. Build siblings left-to-right
3. Each child can query what came before
4. **Limitation:** Can't query what comes after (no forward references)

This is acceptable - most use cases are "face the table" or "avoid siblings", not "predict future siblings".

**Comparison to Shared Context:**
- **Shared Context (P2M2d-003):** Write values, siblings read them (theme, sizes, etc.)
- **Scene Graph (P2M2d-005):** Query spatial/semantic relationships (location, tags, bounds)
- Both enable cross-component awareness but serve different purposes
- They can work together: Context for state, Scene Graph for queries

**Priority Note:**
This is a **large story** (L) because it has 4 phases. Consider splitting:
- **P2M2d-005a:** Tagging only (S) - Quick value
- **P2M2d-005b:** Scene Graph + Query DSL (M) - Agent use cases
- **P2M2d-005c:** Builder-time queries (M) - Advanced cross-component

---

### P2M2d-006: Builder Validation API

**Epic:** P2-M2d Agent Authoring Layer
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P2
**Dependencies:** None

#### Context

Agent needs structured feedback on build quality.

#### Acceptance Criteria

- [ ] DSL command: `builder.validate` - runs validation suite
- [ ] Returns structured results: `{ check, status, reason, metric?, value? }`
- [ ] Checks include: mesh validity, stability hints, ergonomics (for furniture)
- [ ] Agent can parse results and iterate

#### Files to Modify

- `src/validation/MeshValidation.ts`
- `src/authoring/commands/`

---

### P2M2d-007: Goal-Seeking Primitives

**Epic:** P2-M2d Agent Authoring Layer  
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P3
**Dependencies:** P2-M2 (Placement), P2M2d-002 (Constraint Context)

#### Context

High-level commands that encode artistic intent, not just geometry.

#### Acceptance Criteria

- [ ] DSL command: `scene.place_around <target> <builder> count=N spacing=X`
- [ ] DSL command: `scene.add_clutter <surface_tag> <builder> density=X`
- [ ] Both use constraint-based placement from P2-M2
- [ ] Collision avoidance built-in

#### Files to Modify

- `src/builder/Placement.ts`
- `src/authoring/commands/`

---

## Epic: P2-M3 - 2D Shapes & Extrusion

> **Goal:** Build gears, signs, moldings, patterns.
> **Status:** ⬜ Not Started

### P2M3-001: 2D Shape Primitives

**Epic:** P2-M3 2D Shapes
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P2
**Dependencies:** None

#### Context

Add 2D shape system as foundation for extrusion and 2D boolean operations.

#### Acceptance Criteria

- [ ] Add `shape2d:` YAML construct
- [ ] Support types: rect, circle, polygon (point list), ellipse
- [ ] Store as array of 2D points (closed loop)
- [ ] DSL command: `geometry.shape2d`
- [ ] Add unit tests

#### Files to Modify

- `src/geometry/Shape2D.ts` (new)
- `src/builder/YamlBuilderParser.ts`

---

### P2M3-002: 2D Extrusion

**Epic:** P2-M3 2D Shapes
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P2
**Dependencies:** P2M3-001

#### Context

Extrude 2D shapes into 3D with proper normals.

#### Acceptance Criteria

- [ ] Add `extrude2d:` YAML geometry command
- [ ] Parameters: shape reference, depth, cap options (none/front/back/both)
- [ ] Generate proper normals for extruded faces
- [ ] Test: Simple sign backplate

#### Files to Modify

- `src/geometry/Extrude.ts` (new)
- `src/builder/YamlBuilderParser.ts`

---

### P2M3-003: Bevel & Chamfer

**Epic:** P2-M3 2D Shapes
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P2
**Dependencies:** P2M3-002

#### Context

Add beveled edges to extruded shapes for production quality.

#### Acceptance Criteria

- [ ] Add bevel option to extrude: `bevel: { size: 0.02, segments: 2 }`
- [ ] Chamfer as bevel with segments=1
- [ ] Smooth normals on bevel
- [ ] Test: Sign with beveled edges

#### Files to Modify

- `src/geometry/Extrude.ts`

---

### P2M3-004: Radial Array

**Epic:** P2-M3 2D Shapes
**Status:** ⬜ Not Started
**Size:** S
**Priority:** P2
**Dependencies:** P2M3-001

#### Context

Duplicate elements around a center point for gears, decorative patterns.

#### Acceptance Criteria

- [ ] Add `radialArray:` YAML construct
- [ ] Parameters: element, count, center, axis, radius
- [ ] Works with 2D shapes and 3D geometry

#### Files to Modify

- `src/builder/YamlBuilderParser.ts`

---

### P2M3-005: Gear Builder Demo

**Epic:** P2-M3 2D Shapes
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P2
**Dependencies:** P2M3-001, P2M3-002, P2M3-004

#### Context

Combined test demonstrating the full 2D→3D pipeline.

#### Acceptance Criteria

- [ ] Create `Gear.yaml` builder
- [ ] 2D tooth profile
- [ ] Radial array around center
- [ ] Extrude to 3D
- [ ] Works in dashboard

#### Files to Modify

- `builders/Gear.yaml` (new)

---

## Epic: P2-M4 - Text & Advanced 2D

> **Goal:** Signage, labels, engravings.
> **Status:** ⬜ Not Started
> **Blocked by:** P2-M3 (needs 2D shapes)

### P2M4-001: Font Integration

**Epic:** P2-M4 Text
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** P2M3-001

#### Context

Parse font files to extract glyph outlines.

#### Acceptance Criteria

- [ ] Integrate opentype.js for font parsing
- [ ] Bundle 1-2 default fonts (sans, serif)
- [ ] DSL command: `text.outline <char>` - get glyph outline
- [ ] Return 2D point arrays

#### Files to Modify

- `package.json` (add opentype.js)
- `src/text/FontParser.ts` (new)

---

### P2M4-002: Text to 2D Path

**Epic:** P2-M4 Text
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** P2M4-001

#### Context

Convert text strings to 2D shapes for extrusion.

#### Acceptance Criteria

- [ ] Add `text:` YAML construct
- [ ] Parameters: content, font, size
- [ ] Convert glyphs to 2D shape
- [ ] Handle multi-character strings (kerning)

#### Files to Modify

- `src/text/TextToShape.ts` (new)
- `src/builder/YamlBuilderParser.ts`

---

### P2M4-003: 2D Boolean Operations

**Epic:** P2-M4 Text
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P3
**Dependencies:** P2M3-001

#### Context

Union, subtract, intersect 2D polygons for complex profiles and text holes.

#### Acceptance Criteria

- [ ] Implement 2D polygon boolean: union, subtract, intersect
- [ ] Handle holes in polygons (letter A, O, R)
- [ ] Use for complex profiles
- [ ] Add `boolean2d:` YAML construct

#### Files to Modify

- `src/geometry/Boolean2D.ts` (new)

#### Notes

Consider using clipper-lib or similar library.

---

### P2M4-004: Text Extrusion

**Epic:** P2-M4 Text
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** P2M4-002, P2M4-003, P2M3-002

#### Context

Extrude text shapes with holes to 3D.

#### Acceptance Criteria

- [ ] Extrude text shapes to 3D
- [ ] Handle multi-component glyphs (holes)
- [ ] Optional bevel on text edges
- [ ] Test: "HELLO" as 3D text

#### Files to Modify

- `src/geometry/Extrude.ts`

---

### P2M4-005: Wall Sign Builder

**Epic:** P2-M4 Text
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** P2M4-004

#### Context

Combined test demonstrating text pipeline.

#### Acceptance Criteria

- [ ] Create `WallSign.yaml` builder
- [ ] Background plate (2D extrude with bevel)
- [ ] Text content (text → extrude, positioned on plate)
- [ ] Material decisions (wood sign vs metal sign)
- [ ] Works in dashboard

#### Files to Modify

- `builders/WallSign.yaml` (new)

---

## Epic: P2-M5 - 3D Boolean CSG

> **Goal:** Architecture (windows), mechanical (assemblies).
> **Status:** ⬜ Not Started
> **Note:** May use external library (csg.js)

### P2M5-001: CSG Library Integration

**Epic:** P2-M5 CSG
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P3
**Dependencies:** None

#### Context

Evaluate and integrate CSG library for boolean operations.

#### Acceptance Criteria

- [ ] Evaluate: csg.js port vs @jscad/csg vs custom
- [ ] Implement mesh → CSG solid conversion
- [ ] Implement CSG solid → mesh conversion
- [ ] Handle coordinate system differences

#### Files to Modify

- `package.json`
- `src/geometry/CSG.ts` (new)

---

### P2M5-002: Boolean Operations

**Epic:** P2-M5 CSG
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** P2M5-001

#### Context

Implement union, subtract, intersect for 3D meshes.

#### Acceptance Criteria

- [ ] Implement union (combine two meshes)
- [ ] Implement subtract (cut one from another)
- [ ] Implement intersect (keep overlap only)
- [ ] Add unit tests

#### Files to Modify

- `src/geometry/CSG.ts`

---

### P2M5-003: CSG DSL Integration

**Epic:** P2-M5 CSG
**Status:** ⬜ Not Started
**Size:** S
**Priority:** P3
**Dependencies:** P2M5-002

#### Context

Expose CSG operations via YAML.

#### Acceptance Criteria

- [ ] Add `boolean:` YAML construct
- [ ] Parameters: operation (union/subtract/intersect), meshA, meshB
- [ ] Handle result as new named mesh

#### Files to Modify

- `src/builder/YamlBuilderParser.ts`

---

### P2M5-004: Mesh Cleanup & Repair

**Epic:** P2-M5 CSG
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P3
**Dependencies:** P2M5-002

#### Context

CSG often produces degenerate geometry that needs repair.

#### Acceptance Criteria

- [ ] Handle coincident faces
- [ ] Handle non-manifold results
- [ ] Add mesh cleanup/repair step
- [ ] Remove degenerate triangles

#### Files to Modify

- `src/geometry/MeshRepair.ts` (new)
- `src/validation/MeshValidation.ts`

---

### P2M5-005: Architecture Demos

**Epic:** P2-M5 CSG
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** P2M5-003

#### Context

Demonstrate CSG for architectural elements.

#### Acceptance Criteria

- [ ] Create `SimpleRoom.yaml` with window opening (box - box)
- [ ] Create `Door.yaml` with panel details
- [ ] Create `Window.yaml` with frame and panes
- [ ] All work in dashboard

#### Files to Modify

- `builders/SimpleRoom.yaml` (new)
- `builders/Door.yaml` (new)
- `builders/Window.yaml` (new)

---

## Epic: P2-M6 - Botanical Systems

> **Goal:** Trees, plants, organic branching.
> **Status:** ⬜ Not Started

### P2M6-001: L-System Grammar

**Epic:** P2-M6 Botanical
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** None

#### Context

Implement L-system string rewriting for branching structures.

#### Acceptance Criteria

- [ ] Implement L-system string rewriting
- [ ] Support: F (forward), + - (turn), [ ] (push/pop)
- [ ] Support custom symbols
- [ ] Define grammar in YAML
- [ ] Add unit tests

#### Files to Modify

- `src/geometry/LSystem.ts` (new)

---

### P2M6-002: Turtle Interpretation

**Epic:** P2-M6 Botanical
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** P2M6-001

#### Context

Convert L-system strings to 3D geometry instructions.

#### Acceptance Criteria

- [ ] Track position, direction, branch stack
- [ ] Support turning angles in 3D
- [ ] Output: list of branch segments with positions/radii
- [ ] Random angle variations

#### Files to Modify

- `src/geometry/LSystem.ts`

---

### P2M6-003: Branch Geometry

**Epic:** P2-M6 Botanical
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** P2M6-002, Sweep (P2-M1b)

#### Context

Convert branch segments to actual mesh geometry.

#### Acceptance Criteria

- [ ] Convert segments to swept cylinders
- [ ] Taper radius along branches
- [ ] Generate bark material regions
- [ ] Smooth branch junctions

#### Files to Modify

- `src/geometry/LSystem.ts`

---

### P2M6-004: Foliage System

**Epic:** P2-M6 Botanical
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** P2M6-002, Instancing (P2M2c-003)

#### Context

Add leaves at branch tips.

#### Acceptance Criteria

- [ ] Leaf placement at branch tips
- [ ] Simple leaf geometry (quad or shaped)
- [ ] Instance leaves for performance
- [ ] Leaf density parameter

#### Files to Modify

- `src/geometry/LSystem.ts`
- `src/geometry/Foliage.ts` (new)

---

### P2M6-005: Tree Builder Demo

**Epic:** P2-M6 Botanical
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** P2M6-003, P2M6-004

#### Context

Complete tree builder demonstrating L-systems.

#### Acceptance Criteria

- [ ] Create `SimpleTree.yaml` builder
- [ ] Species decision (oak, pine, etc.)
- [ ] Season decision (full, autumn, bare)
- [ ] Age/size variation
- [ ] Works in dashboard

#### Files to Modify

- `builders/SimpleTree.yaml` (new)

---

## Epic: P2-M7 - Advanced Materials

> **Goal:** Realistic surfaces with wear, aging, PBR output.
> **Status:** ⬜ Not Started (Deferred from P2-M1)

### P2M7-001: Layer Stack System

**Epic:** P2-M7 Materials
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P3
**Dependencies:** Materials (P2-M1 Steps 1-3)

#### Context

Define layered material system for complex surfaces.

#### Acceptance Criteria

- [ ] Define layer structure (base + overlays)
- [ ] Implement mask types (AO, curvature, noise)
- [ ] Implement blend modes (multiply, overlay, add)
- [ ] YAML syntax for layer stacks

#### Files to Modify

- `src/builder/MaterialLibrary.ts`

---

### P2M7-002: Smart Materials

**Epic:** P2-M7 Materials
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P3
**Dependencies:** P2M7-001

#### Context

Preset materials with automatic wear/aging.

#### Acceptance Criteria

- [ ] Worn wood preset (edge wear from curvature map)
- [ ] Dirty/aged preset (dirt from AO map)
- [ ] Metal presets (clean, rusted, brushed)
- [ ] Configurable wear amount

#### Files to Modify

- `src/builder/MaterialLibrary.ts`

---

### P2M7-003: Procedural Textures

**Epic:** P2-M7 Materials
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P3
**Dependencies:** Noise (P2-M2b)

#### Context

Generate textures procedurally for infinite variation.

#### Acceptance Criteria

- [ ] Noise functions (perlin, simplex, worley)
- [ ] Pattern generators (wood grain, marble veins)
- [ ] Integrate with layer masks
- [ ] Output as texture data

#### Files to Modify

- `src/builder/ProceduralTexture.ts` (new)

---

### P2M7-004: PBR Output

**Epic:** P2-M7 Materials
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** P2M7-001, P2M7-003

#### Context

Export standard PBR texture set.

#### Acceptance Criteria

- [ ] Generate albedo, roughness, metalness, normal maps
- [ ] Export as texture files or embedded
- [ ] Standard PBR material format (glTF-compatible)
- [ ] Configurable resolution

#### Files to Modify

- `src/builder/MaterialExport.ts` (new)

---

### P2M7-005: Material Editor UI

**Epic:** P2-M7 Materials
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P3
**Dependencies:** P2M7-001

#### Context

Visual material editing in dashboard.

#### Acceptance Criteria

- [ ] Preview panel in dashboard
- [ ] Layer stack visualization
- [ ] Real-time parameter adjustment
- [ ] Save/load material presets

#### Files to Modify

- `src/dashboard/`
- `dashboard.html`

---

## Epic: P2-M8 - Cloth & Soft Bodies

> **Goal:** Clothing, curtains, tablecloths.
> **Status:** ⬜ Not Started

### P2M8-001: Static Drape Approximation

**Epic:** P2-M8 Cloth
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P3
**Dependencies:** Subdivision (P2-M1b)

#### Context

Simple gravity-based draping without full physics simulation.

#### Acceptance Criteria

- [ ] Gravity-based vertex displacement
- [ ] Collision with simplified body/object mesh
- [ ] Configurable drape amount
- [ ] Not a physics simulation (baked result)

#### Files to Modify

- `src/geometry/Drape.ts` (new)

---

### P2M8-002: 2D Pattern Definition

**Epic:** P2-M8 Cloth
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** 2D Shapes (P2-M3)

#### Context

Define flat pattern pieces like real clothing.

#### Acceptance Criteria

- [ ] Define flat pattern pieces in YAML
- [ ] Mark seam edges (which edges connect)
- [ ] Pattern library for common garments
- [ ] Seam constraints

#### Files to Modify

- `src/geometry/Pattern.ts` (new)

---

### P2M8-003: Pattern to 3D

**Epic:** P2-M8 Cloth
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P3
**Dependencies:** P2M8-001, P2M8-002

#### Context

Assemble patterns into 3D garments.

#### Acceptance Criteria

- [ ] Place patterns on body reference
- [ ] Stitch seam edges together
- [ ] Apply static drape deformation
- [ ] Handle multiple pattern pieces

#### Files to Modify

- `src/geometry/Garment.ts` (new)

---

### P2M8-004: Garment Builders

**Epic:** P2-M8 Cloth
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** P2M8-003

#### Context

Demo garment builders.

#### Acceptance Criteria

- [ ] Create `TShirt.yaml` (simple tube + sleeves)
- [ ] Create `Pants.yaml` (two tubes + waist)
- [ ] Create `Hat.yaml` (may use subdivision)
- [ ] All work in dashboard

#### Files to Modify

- `builders/TShirt.yaml` (new)
- `builders/Pants.yaml` (new)
- `builders/Hat.yaml` (new)

---

## Epic: P2-M9 - Characters (Capstone)

> **Goal:** Human and animal figures - uses ALL previous milestones.
> **Status:** ⬜ Not Started

### P2M9-001: PersonBuilder Polish

**Epic:** P2-M9 Characters
**Status:** ⬜ Not Started
**Size:** XL
**Priority:** P3
**Dependencies:** P2-M1b, P2-M8

#### Context

Complete the frozen PersonBuilder with proper anatomy.

#### Acceptance Criteria

- [ ] Integrate anatomy proportions with subdivision
- [ ] Head with basic facial features
- [ ] Hands with fingers (or simplified mittens)
- [ ] Proper edge loop topology at joints
- [ ] Pose-able (even if not rigged)

#### Files to Modify

- `src/builder/PersonBuilder.ts`

---

### P2M9-002: Body Variations

**Epic:** P2-M9 Characters
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P3
**Dependencies:** P2M9-001

#### Context

Add body type, height, gender, age variations.

#### Acceptance Criteria

- [ ] Body type decisions (slim, average, muscular, heavy)
- [ ] Height variation
- [ ] Gender expression options
- [ ] Age indicators (posture, proportions)

#### Files to Modify

- `src/builder/PersonBuilder.ts`

---

### P2M9-003: Clothing Integration

**Epic:** P2-M9 Characters
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P3
**Dependencies:** P2M9-001, P2-M8

#### Context

Dress characters with garments from P2-M8.

#### Acceptance Criteria

- [ ] Apply TShirt, Pants from P2-M8
- [ ] Clothing adapts to body size
- [ ] Layer properly (shirt under jacket)
- [ ] Material decisions

#### Files to Modify

- `src/builder/PersonBuilder.ts`

---

### P2M9-004: Character Materials

**Epic:** P2-M9 Characters
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** P2-M7, P2M9-001

#### Context

Skin and clothing materials for characters.

#### Acceptance Criteria

- [ ] Skin material with variation
- [ ] Clothing materials with decisions
- [ ] Full baked maps

#### Files to Modify

- `src/builder/PersonBuilder.ts`
- `src/builder/MaterialLibrary.ts`

---

### P2M9-005: Stylized Characters

**Epic:** P2-M9 Characters
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P3
**Dependencies:** P2M9-001

#### Context

Non-realistic character styles.

#### Acceptance Criteria

- [ ] Simplified proportions (chibi, cartoon)
- [ ] Exaggerated features
- [ ] Consistent style options

#### Files to Modify

- `src/builder/PersonBuilder.ts`

---

### P2M9-006: Animal Builder

**Epic:** P2-M9 Characters
**Status:** ⬜ Not Started
**Size:** XL
**Priority:** P3
**Dependencies:** P2M9-001

#### Context

Quadruped and other animal body plans.

#### Acceptance Criteria

- [ ] Quadruped body plan
- [ ] Species variations (dog, cat, horse)
- [ ] Fur/skin material hints
- [ ] Recognizable species

#### Files to Modify

- `src/builder/AnimalBuilder.ts` (new)

---

## Epic: P2-M10 - Renderer Package

> **Goal:** Deployment in games/apps with minimal bundle.
> **Status:** ⬜ Not Started

### P2M10-001: Package Split

**Epic:** P2-M10 Renderer
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P3
**Dependencies:** None (can start anytime)

#### Context

Separate runtime renderer from authoring tools.

#### Acceptance Criteria

- [ ] Extract `@procedurable/core` (math, geometry primitives)
- [ ] Extract `@procedurable/renderer` (mesh display only)
- [ ] Keep `@procedurable/authoring` separate
- [ ] Define package boundaries

#### Files to Modify

- `package.json`
- Create package structure

---

### P2M10-002: Minimal Bundle

**Epic:** P2-M10 Renderer
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** P2M10-001

#### Context

Minimize renderer bundle size for web use.

#### Acceptance Criteria

- [ ] Tree-shake unused code
- [ ] Target ~50KB for renderer
- [ ] No MCP/authoring dependencies
- [ ] Measure and document bundle size

#### Files to Modify

- Build configuration
- `vite.config.ts`

---

### P2M10-003: Builder Loading

**Epic:** P2-M10 Renderer
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** P2M10-001

#### Context

Load builders at runtime from URL/CDN.

#### Acceptance Criteria

- [ ] Load YAML builders from URL/CDN
- [ ] Cache compiled builders
- [ ] Lazy load on demand
- [ ] Handle load errors gracefully

#### Files to Modify

- `src/builder/BuilderLoader.ts` (new)

---

### P2M10-004: Export Formats

**Epic:** P2-M10 Renderer
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P3
**Dependencies:** None

#### Context

Export meshes to standard 3D formats.

#### Acceptance Criteria

- [ ] glTF export (meshes + materials)
- [ ] OBJ export (meshes only)
- [ ] JSON scene format
- [ ] Include materials/textures

#### Files to Modify

- `src/export/GLTFExporter.ts` (new)
- `src/export/OBJExporter.ts` (new)

---

### P2M10-005: Integration Examples

**Epic:** P2-M10 Renderer
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** P2M10-001, P2M10-004

#### Context

Show how to use Procedurable in other frameworks.

#### Acceptance Criteria

- [ ] React component wrapper example
- [ ] Three.js integration example
- [ ] Babylon.js integration example
- [ ] Documentation for each

#### Files to Modify

- `examples/` (new directory)
- `docs/INTEGRATIONS.md` (new)

---

# FUTURE / RESEARCH (Optional, Deferred)

> These stories are **not on the critical path** for Phase 2 or 3. They're research topics or advanced features that we may tackle if specific use cases emerge.

## FR-001: Composition Feedback Loop

**Epic:** Future Research
**Status:** ⬜ Deferred
**Size:** L
**Priority:** P4 (Optional)
**Dependencies:** P2M2d-002 (Constraint Context), P2M2d-003 (Shared Context)

#### Context

Enable two-pass composition where children can report their requirements and parent can adapt. This is **Priority 3** from the Cross-Builder Communication analysis but deferred until we have proven use cases that can't be solved with Constraint Context + Shared Context.

**Reference:** `CROSS_BUILDER_COMMUNICATION.md` Priority 3

#### When to Implement

**Defer until we encounter:**
- Multiple real builders that need adaptive spacing
- Complex negotiation scenarios (e.g., chair says "I need 0.6m" but table only has 0.5m)
- Use cases where one-shot composition with constraints isn't sufficient

#### Acceptance Criteria

- [ ] Add `feedback_required: true` flag to composition
- [ ] Two-pass execution:
  1. Build children with feedback_required
  2. Children report actual sizes/requirements in TracedOutput
  3. Parent adapts based on feedback
  4. Rebuild children with new parameters
- [ ] Add feedback data structure to TracedOutput
- [ ] Example: `AdaptiveTable.yaml` that adjusts spacing based on actual chair sizes
- [ ] Documentation in YAML_BUILDER_FORMAT.md

#### Files to Modify

- `src/builder/TracedBuilder.ts` (feedback in TracedOutput)
- `src/builder/YamlBuilderParser.ts` (two-pass logic)
- `builders/AdaptiveTable.yaml` (new demo if needed)

#### Notes

**Complexity:** This adds significant complexity:
- Evaluation order becomes more complex
- Risk of infinite loops if not careful
- Need to decide what can/can't change between passes

**Alternative:** Most adaptive scenarios can be handled with:
1. Pre-computation in parent (today)
2. Shared Context Store (P2M2d-003)
3. Constraint Context for negotiation (P2M2d-002)

Only implement if we hit real limitations with the above approaches.

---

## FR-002: Constraint Solver

**Epic:** Future Research
**Status:** ⬜ Deferred
**Size:** XL
**Priority:** P4 (Optional)
**Dependencies:** P2M2d-002 (Constraint Context)

#### Context

Automatic constraint satisfaction for complex multi-builder scenarios. This is **Priority 4** from the Cross-Builder Communication analysis. Defer until we have many constraint-heavy use cases that are painful to author manually.

**Reference:** `CROSS_BUILDER_COMMUNICATION.md` Priority 4

#### When to Implement

**Defer until:**
- We have 5+ builders with complex interdependent constraints
- Manual constraint handling becomes a significant authoring burden
- Agents need to generate complex scenes with many constraints

#### Acceptance Criteria

**Phase 1: Simple Solver**
- [ ] Random sampling with constraint validation
- [ ] DSL command: `scene.solve_constraints maxAttempts=100`
- [ ] Validate against declared constraints
- [ ] Return best solution found

**Phase 2: Advanced (if needed)**
- [ ] Hill climbing or simulated annealing
- [ ] Support for soft constraints (priorities)
- [ ] SMT solver integration (Z3 or similar)

#### Files to Modify

- `src/solver/ConstraintSolver.ts` (new)
- `src/authoring/commands/scene.ts` (new commands)

#### Research Questions

1. **What constraints matter most?**
   - Spatial (fit in bounds, no overlap)
   - Relational (face toward, aligned with)
   - Style (consistency across scene)
   - Physical (stable, supported)

2. **What solving strategy?**
   - Simple: Random sampling + validation (easy, may be sufficient)
   - Medium: Heuristic search (hill climbing, genetic algorithms)
   - Advanced: SMT solver (powerful but complex integration)

3. **Performance requirements?**
   - Real-time interactive? (need fast solver)
   - Batch generation? (can afford slower, better solutions)

#### Notes

**This is a research project, not a feature.** We should:
1. Collect real use cases first
2. Understand what constraints matter
3. Try simple approaches (random sampling)
4. Only go advanced if needed

**Risk:** Over-engineering a solution before we understand the problem. Better to start with manual constraint handling and upgrade if needed.

---

# PHASE 3 (Future)

> **Note:** Phase 3 requires Phase 2 foundation work. These are placeholders for planning.

## Epic: P3-M1 - Rigging

**Dependencies:** P2-M9 Characters, Extended Vertex class
**Scope:** Skeleton definition, bone weights, linear blend skinning

## Epic: P3-M2 - Animation

**Dependencies:** P3-M1 Rigging
**Scope:** Keyframes, clips, interpolation curves

## Epic: P3-M3 - Physics Integration

**Dependencies:** P3-M2 Animation
**Scope:** rapier.js integration, rigid bodies, bake to keyframes

## Epic: P3-M4 - Procedural Animation

**Dependencies:** P3-M3 Physics
**Scope:** Walk cycles, ragdoll, secondary motion

---

# Archive: Completed Milestones

## ✅ Phase 1 (Complete)

| Milestone                     | Completed  | Summary                                   |
|-------------------------------|------------|-------------------------------------------|
| M1: Agent Inspection Enhanced | 2026-01-13 | DSL command system working                |
| M2: Real-Time Dashboard       | 2026-01-13 | Single seed view with navigation          |
| M3: Agent Builder Editing     | 2026-01-13 | Measurements/decisions via DSL            |
| M4: Builder Composition       | 2026-01-13 | Core compose(), DiningScene created       |
| M5: Storage & YAML Builders   | 2026-01-14 | YAML format, expression engine, repeat/if |
| M6: MCP v1.0.0 RC             | 2026-01-14 | API frozen, 29 integration tests          |

## ✅ Phase 2 (Partial)

| Milestone                             | Completed  | Summary                                                         |
|---------------------------------------|------------|-----------------------------------------------------------------|
| P2-M1: Procedural Materials Steps 1-3 | 2026-01-14 | Vertex colors, MaterialLibrary, map baking                      |
| P2-M1b Steps 1-4                      | 2026-01-14 | Lathe, Sweep, Subdivision exposed. Vase, Mug, Cushion builders. |
| P2-M2: Scene Constraints              | 2026-01-14 | AABB, Placement.ts, DiningScene fixed                           |
| P2-M2b Steps 1-2 + Noise              | 2026-01-14 | Conditional/iterative composition, Perlin/FBM noise             |

