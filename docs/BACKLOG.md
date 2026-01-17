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
| P2-M2b: Authoring Infrastructure | 6       | 6    | 0           | 0       |
| P2-M2c: World Foundations        | 5       | 5    | 0           | 0       |
| P2-Dashboard: Visualization      | 3       | 3    | 0           | 0       |
| P2-M2d: Agent Authoring Layer    | 7       | 6    | 0           | 0       |
| Future/Research (Optional)       | 2       | 0    | 0           | 0       |
| P2-M3: 2D Shapes & Extrusion     | 5       | 5    | 0           | 0       |
| P2-M3b: Architecture & Flows     | 3       | 0    | 0           | 0       |
| P2-M4: Text & Advanced 2D        | 8       | 2    | 1           | 0       |
| P2-M5: 3D Boolean CSG            | 5       | 0    | 0           | 1       |
| P2-M6: Botanical Systems         | 5       | 0    | 0           | 0       |
| P2-M7: Advanced Materials        | 5       | 0    | 0           | 0       |
| P2-M8: Cloth & Soft Bodies       | 4       | 0    | 0           | 0       |
| P2-M9: Characters (Capstone)     | 6       | 0    | 0           | 0       |
| P2-M10: Renderer Package         | 5       | 0    | 0           | 0       |

---

## Implementation Review

See `docs/IMPLEMENTATION_REVIEW.md` for the latest assessment of what’s implemented and which milestones need revisits
for quality or alignment.

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

### P2M2b-006: Unified ExpressionService

**Epic:** P2-M2b Authoring Infrastructure
**Status:** ✅ Complete
**Size:** M
**Priority:** P1
**Dependencies:** P2M2b-003

#### Context

The YAML parser had **four separate condition evaluation functions** with different capabilities:

1. `evaluateCondition()` - Simple regex, only `==`, `!=`, boolean checks
2. `evaluateCompositionCondition()` - More features but still regex-based
3. `evaluateExpression()` - Full MathService with `eq()`, `if()`
4. `evaluatePositionComponent()` - MathService but only builder context

This fragmentation caused constant issues:
- String comparisons worked in `derived:` but not in `when:` conditions
- Measurements accessible in some contexts but not others
- Different syntax required for different YAML sections
- Agents confused about which syntax to use where

#### Acceptance Criteria

- [x] Create unified `ExpressionService` module
- [x] Single `EvaluationContext` interface with all values
- [x] `evaluateCondition()` handles all condition types
- [x] `evaluateNumeric()` handles all expression types
- [x] String comparison works everywhere via `eq()` OR simple `==`
- [x] Refactor YamlBuilderParser to use unified service
- [x] Comprehensive test suite (32 tests)
- [x] All existing builders still work

#### Files Created/Modified

- `src/builder/ExpressionService.ts` ✅ - New unified service
- `src/tests/__tests__/ExpressionService.test.ts` ✅ - 32 tests
- `src/builder/YamlBuilderParser.ts` ✅ - Refactored to use service

#### Implementation Notes

**EvaluationContext** contains:
- `decisions` - Decision values (string, number, boolean)
- `measurements` - Measurements and derived values
- `constraints` - Constraints from parent builders

**Key Functions:**
- `evaluateNumeric(expr, ctx)` - Returns number, uses MathService
- `evaluateCondition(condition, ctx)` - Returns boolean, handles all formats
- `evaluatePosition(value, ctx)` - Returns number, handles string or number input
- `createContext(builder, decisionValues)` - Helper to build context

**Unified Condition Evaluation:**
1. Simple boolean check: `is_round`
2. MathService expressions: `eq(style, 'modern')`, `if(x > 0, 1, 0)`
3. Regex fallback for edge cases: `style == modern`, `count > 3`

**Benefits:**
- Consistent behavior across all YAML sections
- Agents can use same syntax everywhere
- Easier to test and maintain
- String comparisons via both `eq()` and `==`

**Completed:** 2026-01-17
- Created unified ExpressionService (247 lines)
- Added comprehensive tests (32 passing)
- Refactored YamlBuilderParser to use service
- All 106 tests passing (61 expression + 45 shape/extrude)

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
**Status:** ✅ Complete
**Size:** M
**Priority:** P2
**Dependencies:** P2M2c-001, P2M2c-002, P2M2c-003

#### Context

Create demo builder showing fields + scatter + instancing together.

#### Acceptance Criteria

- [x] Create `WorldSlice.yaml` demo builder
- [x] Uses field(noise) as terrain height
- [x] Uses Poisson scatter for tree/rock placement
- [x] Returns instances (not merged mesh)
- [x] Deterministic by coordinate (same seed+coords → same output)

#### Files Modified

- `builders/WorldSlice.yaml` ✅ (new, comprehensive demo)
- `builders/Rock.yaml` ✅ (new, procedural rock builder)
- `src/builder/YamlBuilderParser.ts` ✅ (array placement support)
- `src/mcp/http-server.ts` ✅ (hot reload blocking)

#### Implementation Notes

**WorldSlice.yaml Features:**
- Ground plane with terrain-aware vertices (50-100m variable size)
- Dual Poisson scatter: trees + rocks with different spacing
- Coordinate-based generation (chunk_seed hash)
- All instances output (asInstance: true)
- Decisions for terrain_frequency, terrain_amplitude, tree_density, rock_density
- Measurements for tree/rock variation (height, width, size ranges)
- Proper derived expressions for half_size, chunk_seed calculation

**Rock.yaml Features:**
- Procedural rock generation with 5 decisions (width, height, depth, skew_x, skew_z)
- Uses box geometry with skewed center
- Proper decision-to-measurement flow via derived section
- Random size/shape variation

**Parser Enhancements:**
- Array placement support (multiple scatter operations in one builder)
- Fixed decision type validation (changed invalid 'range' to 'number')
- Fixed expression evaluation (removed $ prefix confusion)

**Hot Reload Fix:**
- Added isReloading check before executing commands
- Returns clear error message during cache reload
- Prevents stale data from being served
- Maintains 2-second reload window

**Testing:**
- Rock builder: Generates varied rocks (8 vertices, 6 faces)
- WorldSlice: Successfully scatters 80+ trees and 15+ rocks
- Both builders vary with seed
- All instances properly transformed with rotation
- 95 total instances in test (80 trees + 15 rocks)

**Completed:** 2026-01-16
- Complete world generation demo working
- Dual-placement scatter functional
- Hot reload improvements implemented
- P2-M2c: World Foundations - COMPLETE! 🚀

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
**Status:** ✅ Complete
**Size:** M
**Priority:** P2
**Dependencies:** None

#### Context

Agent needs to discover available builders and their interfaces.

#### Acceptance Criteria

- [x] DSL command: `system.list_builders` - returns all available builders
- [x] DSL command: `builder.get_interface <name>` - returns parameters, decisions, variation axes
- [x] DSL command: `system.list_tools` - returns available geometry commands
- [x] Interface output includes types, ranges, and defaults

#### Files Modified

- `src/authoring/commands/system.ts` ✅ - Added `list_builders` and `list_tools` commands
- `src/authoring/commands/builder.ts` ✅ - Added `get_interface` command

#### Implementation Details

**`system.list_builders`:**
- Lists all YAML builders with metadata (name, description, tags, source, modifiedAt, size)
- Returns total count and breakdown by source type
- Sorted alphabetically by name
- Currently returns 15 YAML builders

**`system.list_tools`:**
- Comprehensive list of all geometry commands (vertex, loop, face, loft, box, cylinder, lathe, sweep, subdivide)
- Composition tools (compose, placement with modes)
- Math functions available in expressions
- Each command includes: name, description, parameters, and usage example

**`builder.get_interface <name>`:**
- Returns complete builder interface by parsing YAML definition
- Extracts decisions with all properties (type, min, max, options, weights, probability, default)
- Extracts measurements with values, base, variation, source
- Extracts derived expressions
- Extracts compositions with all parameters
- Extracts placements with mode, builder, constraints
- Counts geometry commands by type
- Returns structured JSON for agent consumption

**Testing:**
- ✅ `system.list_builders` - Returns 15 builders with full metadata
- ✅ `system.list_tools` - Returns 9 geometry commands + composition tools + math functions
- ✅ `builder.get_interface Rock` - Returns 5 decisions, 5 measurements, 5 derived, 1 box geometry
- ✅ `builder.get_interface WorldSlice` - Returns 5 decisions, 12 measurements, 4 derived, 2 placements, 5 geometry commands
- ✅ `builder.get_interface DiningChair` - Returns 14 decisions, 13 measurements, 7 derived, 36 geometry commands

**Completed:** 2026-01-16
- All three introspection commands working
- Full builder interface extraction
- Ready for agent discovery and utilization

---

### P2M2d-002: Constraint Context

**Epic:** P2-M2d Agent Authoring Layer
**Status:** ✅ Complete  
**Size:** S
**Priority:** P1
**Dependencies:** None

#### Context

Parent builders need to pass rich constraints to children beyond simple overrides. Enable semantic relationships like "chair must face table" or "fit within this space".

**Reference:** `CROSS_BUILDER_COMMUNICATION.md` Priority 1

#### Acceptance Criteria

- [x] Add `constraints` field to YamlComposition interface
- [x] Pass constraints to child builders as special override: `__constraints__`
- [x] Child builders can query constraints: `builder.getConstraint('max_height')`
- [x] Add constraint validation reporting in TracedOutput
- [x] Example: `ChairInBounds.yaml` demo with spatial constraints
- [x] Example: `RoomWithChair.yaml` demo with pose constraints (parent)
- [x] Documentation in YAML_BUILDER_FORMAT.md

#### Files Modified

- `src/builder/YamlBuilderParser.ts` ✅ - Added constraints field to YamlComposition, resolve $references
- `src/builder/TracedBuilder.ts` ✅ - Added constraints Map, getConstraint/hasConstraint/getConstraints methods
- `builders/ChairInBounds.yaml` ✅ - Demo chair builder showing constraint usage
- `builders/RoomWithChair.yaml` ✅ - Parent builder passing constraints to chair
- `docs/YAML_BUILDER_FORMAT.md` ✅ - Documented constraints system

#### Implementation Details

**TracedBuilder Changes:**
- Added private `constraints: Map<string, any>` field
- Constructor extracts `__constraints__` from overrides and populates constraints Map
- `getConstraint<T>(key): T | undefined` - Query constraint by key
- `hasConstraint(key): boolean` - Check if constraint exists
- `getConstraints(): Record<string, any>` - Get all constraints as object

**YamlBuilderParser Changes:**
- Added `constraints?: Record<string, any>` to YamlComposition interface
- Resolve $references in constraints (same as overrides)
- Pass resolved constraints to `builder.compose()` method

**compose() Method:**
- Added `constraints?: Record<string, any>` to options parameter
- Merges constraints into finalOverrides as `__constraints__` before calling sub-builder
- Child builder receives constraints via constructor

**Demo Builders:**
- `ChairInBounds.yaml` - Chair that can query spatial constraints (max_width, max_depth, max_height)
- `RoomWithChair.yaml` - Parent scene that passes constraints to chair composition

**Documentation:**
- Updated `YAML_BUILDER_FORMAT.md` with constraints section
- Explained difference between overrides (force values) and constraints (pass context)
- Provided usage examples

**Completed:** 2026-01-17
- Full constraint passing system implemented
- Demo builders created (ChairInBounds.yaml, RoomWithChair.yaml)
- Documentation updated (YAML_BUILDER_FORMAT.md)
- Child builders can query parent constraints via `builder.getConstraint()`
- **Constraint access in expressions:** `@constraint_name` syntax in derived values
  - Automatic fallbacks: `@max_*` → 999, `@min_*` → 0
  - Expression transformation: `@name` → `__constraint_name` for MathJS compatibility
  - Example: `final_width: "min(seat_width, @max_width)"`
- **Nested decision overrides:** Prefixed overrides (`chair.constrained`) forwarded to child builders
- **Measurement overrides:** Dashboard measurement changes propagate to constraints
- **Tests:** 11 unit tests passing (Constraints.test.ts)
  - Constraint storage and retrieval
  - Nested constraint objects
  - Constraint composition (merged and instanced)
  - Type safety with generic parameters
  - Separation from decision overrides
  - Expression access with @ prefix
  - Fallback values

**Dashboard Integration:** ✅ Fully working
- Boolean decisions can be toggled and stay overridden
- Measurement changes propagate through constraints to child dimensions
- Visual geometry updates correctly with constraint changes

---

### P2M2d-003: Shared Context Store

**Epic:** P2-M2d Agent Authoring Layer
**Status:** ✅ Complete
**Size:** M
**Priority:** P1
**Dependencies:** None

#### Context

Enable scene-level shared state for sibling awareness and global coordination. Like Vuex/Pinia for builders - children can read theme settings, report their sizes, and see each other's decisions.

**Reference:** `CROSS_BUILDER_COMMUNICATION.md` Priority 2

#### Acceptance Criteria

- [x] Create `SharedContext` class (structured key-value store)
- [x] Add `shared_context` top-level YAML section
- [x] Add `read_context` field to composition (list of keys to inject)
- [x] Add `write_context` field to composition (key-value pairs to write back)
- [x] Pass SharedContext through ParseOptions
- [x] Evaluation order: parent decisions → shared context → children (left-to-right)
- [x] Example: `ThemedRoom.yaml` with global style coordination
- [ ] Example: `AdaptiveLayout.yaml` with sibling size awareness (optional)
- [x] Documentation in YAML_BUILDER_FORMAT.md

#### Files Modified

- `src/builder/SharedContext.ts` ✅ - New class for scene-level state
- `src/builder/YamlBuilderParser.ts` ✅ - Process shared_context, read_context, write_context
- `builders/ThemedRoom.yaml` ✅ - Demo with theme coordination
- `docs/YAML_BUILDER_FORMAT.md` ✅ - Documented shared context
- `src/tests/__tests__/SharedContext.test.ts` ✅ - 15 unit tests

#### Implementation Details

**SharedContext Class:**
- `get<T>(key)`, `set(key, value)`, `has(key)`
- `getMultiple(keys[])`, `setMultiple(obj)`
- `reset()` - Reset to initial state
- `snapshot()` - Get current state
- `toObject()` - Convert to plain object

**YAML Integration:**
- `shared_context` top-level section initializes SharedContext
- `read_context: [keys...]` injects context values as overrides
- `write_context: { key: "$expr" }` writes child measurements back
- Sequential evaluation: siblings see previous siblings' writes

**Completed:** 2026-01-17
- Full shared context implementation
- 15 unit tests passing
- Demo builder created
- Documentation updated

---

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
**Status:** ✅ Complete (Phase 1-3), Phase 4 Deferred
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

**Phase 1: Core Scene Graph** ✅
- [x] Create SceneGraph class with node hierarchy
- [x] SceneNode with: name, tags, bounds, transform, parent/children
- [x] Tag-based queries: getNodesByTag(), getNodesByTags()
- [x] Name-based queries: findNodesByName()
- [x] World transform calculation
- [x] World bounds calculation
- [x] Store in TracedOutput: `sceneGraph: SceneGraph`

**Phase 2: YAML Schema** ✅
- [x] Add `tags?: string[]` to geometry commands
- [x] Add `tags?: string[]` to YamlComposition
- [x] SceneGraph initialized in parseAndExecuteBuilder

**Phase 3: Query DSL Commands** ✅
- [x] DSL command: `scene.query_by_tag <tag>` - find parts by functional tag
- [x] DSL command: `scene.query_by_name <pattern>` - find parts by name pattern
- [x] DSL command: `scene.query_by_tags <tag1,tag2>` - find by multiple tags (AND)
- [x] DSL command: `scene.query_nearby <x,y,z> radius=<r>` - spatial query
- [x] DSL command: `scene.query_facing <x,y,z> angle=<deg>` - orientation query
- [x] DSL command: `scene.tags` - list all available tags
- [x] DSL command: `scene.info` - get scene graph statistics
- [x] Return: list of scene nodes with names, tags, bounds, transforms

**Phase 4: Builder-Accessible Queries** ⬜ Deferred
- [ ] Builders can query scene during composition via `builder.queryScene(tag)`
- [ ] Example: Chair can check `builder.queryScene('table')` to face it
- [ ] Example: Clutter can query `builder.queryScene('surface')` to place on tables
- [ ] **Status:** DEFERRED - See rationale below

#### Files Modified

- `src/builder/SceneGraph.ts` ✅ - Graph data structure with queries
- `src/builder/TracedBuilder.ts` ✅ - Added sceneGraph field to TracedOutput
- `src/builder/YamlBuilderParser.ts` ✅ - Added tags to schema, initialize graph
- `src/authoring/commands/scene.ts` ✅ - Scene query DSL commands (7 commands)
- `src/authoring/server.ts` ✅ - Registered scene command namespace
- `src/tests/__tests__/SceneGraph.test.ts` ✅ - 11 unit tests
- `builders/TaggedChair.yaml` ✅ - Demo with tagged geometry
- `docs/YAML_BUILDER_FORMAT.md` ⬜ - (Documentation update needed)

#### Implementation Summary

**Completed:** 2026-01-17
- ✅ SceneGraph class with hierarchical nodes
- ✅ Tag indexing for O(1) tag queries
- ✅ Spatial queries (nearby, facing direction)
- ✅ World transform and bounds calculation
- ✅ YAML schema extended with tags field
- ✅ 7 DSL commands for scene queries
- ✅ Demo builder (TaggedChair.yaml) with semantic tags
- ✅ 11 unit tests passing
- ✅ Integrated with TracedOutput and authoring server

#### Phase 4 Deferral Rationale

**Technical Challenges:**
1. **Evaluation Order Complexity** - Requires sequential left-to-right composition with scene graph updates between each child. Current architecture treats composition as conceptually parallel.
2. **API Design Decisions** - Multiple open questions:
   - Pass SceneGraph as parameter to builder functions?
   - Add `builder.queryScene()` method to TracedBuilder?
   - How to handle scene graph updates during composition?
3. **Circular Dependencies** - If Chair queries Table before Table builds, need error handling or deferred resolution logic.
4. **Testing Complexity** - Would require integration tests that verify query results mid-composition.

**Strategic Reasons:**
1. **No Immediate Use Case** - Current builders successfully use:
   - Shared Context for state sharing (P2M2d-003) ✅
   - Constraints for spatial limits (P2M2d-002) ✅
   - Decision overrides for variation (P2M2d-001) ✅
2. **DSL Commands Provide 80% of Value** - Agents can query scene graph after building:
   - `scene.query_by_tag surface` - Find all surfaces
   - `scene.query_nearby 0,0,0 radius=1.0` - Spatial awareness
   - `scene.query_facing 0,0,1 angle=45` - Orientation queries
3. **Core Functionality Complete** - Scene graph with tags, spatial queries, and DSL access already enables:
   - Agent semantic understanding
   - Post-build spatial analysis
   - Validation and layout planning
4. **Additive Feature** - Phase 4 can be added later without refactoring existing work.

**Future Implementation Path** (when builder-time queries become necessary):
1. Add `SceneGraph` parameter to composition options
2. Implement sequential composition mode (left-to-right with graph updates)
3. Add `builder.queryScene(tag)` method to TracedBuilder
4. Create demo builders that use queries (e.g., ChairFacingTable.yaml)
5. Document evaluation order guarantees and limitations
6. Add integration tests for mid-composition queries

**Decision:** Phase 4 deferred. Focus shifts to P2M2d-006 (Builder Introspection), which has clearer immediate value for agent discovery and iteration workflows.

---

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
**Status:** ✅ Complete
**Size:** M
**Priority:** P2
**Dependencies:** None

#### Context

Agent needs structured feedback on build quality for iterative improvement.

#### Acceptance Criteria

- [x] DSL command: `builder.validate` - runs validation suite
- [x] Returns structured results: `{ check, status, reason, metric?, value? }`
- [x] Checks include: mesh validity, stability hints, ergonomics (for furniture)
- [x] Agent can parse results and iterate
- [x] Domain-specific validation (Chair, Table, Door)
- [x] Grouped results by status (passed, warnings, failed)

#### Files Modified

- `src/validation/ValidationAPI.ts` ✅ - Complete validation system with domain checks
- `src/authoring/commands/builder.ts` ✅ - Added `builder.validate` command
- `src/validation/MeshValidation.ts` ✅ - (existing, reused)
- `src/validation/MeshChecks.ts` ✅ - (existing, reused)

#### Implementation Summary

**Completed:** 2026-01-17
- ✅ Structured ValidationCheck interface with status, reason, metric, value
- ✅ Complete validation pipeline: mesh validity → geometry quality → domain-specific
- ✅ Domain-specific validators:
  - **Chair:** Seat height (0.4-0.5m), seat width, back height ergonomics
  - **Table:** Table height (0.7-0.75m), surface area usability
  - **Door:** Standard dimensions (2.0-2.1m height, 0.8-0.9m width)
  - **Stability:** Center of mass, aspect ratio checks
- ✅ `builder.validate` DSL command returns structured JSON
- ✅ Results grouped by status for easy agent parsing

**Example Usage:**
```bash
builder.open DiningChair
builder.run seed=1
builder.validate

# Returns:
{
  "valid": true,
  "summary": { "passed": 8, "warnings": 1, "failed": 0 },
  "checks": [
    {
      "check": "ergonomics_seat_height",
      "status": "pass",
      "reason": "Seat height is ergonomic",
      "metric": "seat_height",
      "value": 0.45
    },
    ...
  ],
  "passed": [...],
  "warnings": [...],
  "failed": []
}
```

**Validation Categories:**
1. **Mesh Validity** - Indices, NaN detection, degenerate faces
2. **Geometry Quality** - Scale, complexity, empty mesh
3. **Domain-Specific** - Ergonomics, standards, usability
4. **Stability** - Center of mass, aspect ratio (for furniture)

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
**Status:** ✅ Complete
**Size:** M
**Priority:** P2
**Dependencies:** None

#### Context

Add 2D shape system as foundation for extrusion and 2D boolean operations.

#### Acceptance Criteria

- [x] Add `shape2d:` YAML construct
- [x] Support types: rect, circle, polygon (point list), ellipse
- [x] Store as array of 2D points (closed loop)
- [x] DSL command: `geometry.shape2d`
- [x] Add unit tests

#### Files Modified

- `src/geometry/Shape2D.ts` ✅ - Complete 2D shape system
  - Shape2D class with Point2D interface
  - Factory methods: rect(), circle(), polygon(), ellipse()
  - fromDef() for creating from definition objects
  - Geometry queries: getBounds(), getArea(), isClockwise()
  - Transformations: translate(), scale(), rotate(), reverse()
  - 3D conversion: to3D() for mesh generation
  - Deep copy support: clone()
- `src/tests/__tests__/Shape2D.test.ts` ✅ - Comprehensive unit tests (26 passing)
  - Rectangle creation (centered, offset)
  - Circle creation (segments, radius validation)
  - Polygon creation (custom points, minimum requirements)
  - Ellipse creation (non-uniform radii)
  - fromDef() factory tests
  - Geometry queries (bounds, area, winding)
  - Transformations (translate, scale, rotate, chaining)
  - 3D conversion tests
  - Reverse/winding tests
  - Clone/deep copy tests
- `src/authoring/commands/geometry.ts` ✅ - DSL command interface
  - geometry.shape2d command for creating shapes via DSL
  - Support for rect, circle, ellipse types
  - Returns point data, bounds, area, winding direction
- `src/authoring/server.ts` ✅ - Registered geometry namespace
- `src/tests/mcp-integration.test.ts` ✅ - Integration tests added

#### Implementation Notes

**Shape2D Architecture:**
- Immutable transformations (return new Shape2D instances)
- Points stored in XZ plane (Y=0 assumed, customizable on 3D conversion)
- Support for counter-clockwise and clockwise winding
- Shoelace formula for area calculation
- Deep copy semantics for all transformations

**Supported Shapes:**
1. **Rectangle:** `Shape2D.rect(width, height, center?)`
   - 4 points, counter-clockwise from bottom-left
2. **Circle:** `Shape2D.circle(radius, segments, center?)`
   - Customizable segment count (default 32)
   - Starts at angle 0 (positive X axis)
3. **Ellipse:** `Shape2D.ellipse(radiusX, radiusZ, segments, center?)`
   - Independent X and Z radii
4. **Polygon:** `Shape2D.polygon(points[])`
   - Explicit point list
   - Minimum 3 points required

**DSL Commands:**
```bash
# Create rectangle
geometry.shape2d type=rect width=2 height=1 x=0 z=0

# Create circle
geometry.shape2d type=circle radius=1 segments=32 x=0 z=0

# Create ellipse
geometry.shape2d type=ellipse radiusX=2 radiusZ=1 segments=32
```

**Next Steps (P2M3-002):**
- Integrate with YAML builder parser for `shape2d:` construct
- Implement `extrude2d:` command using Shape2D
- Generate 3D meshes from 2D profiles

**Completed:** 2026-01-17
- Full 2D shape primitive system
- 26 unit tests passing
- DSL command interface
- Ready for extrusion integration

---

### P2M3-002: 2D Extrusion

**Epic:** P2-M3 2D Shapes
**Status:** ✅ Complete
**Size:** M
**Priority:** P2
**Dependencies:** P2M3-001

#### Context

Extrude 2D shapes into 3D with proper normals.

#### Acceptance Criteria

- [x] Add `extrude2d:` YAML geometry command
- [x] Parameters: shape reference, depth, cap options (none/front/back/both)
- [x] Generate proper normals for extruded faces
- [x] Test: Simple sign backplate

#### Files Modified

- `src/geometry/Extrude.ts` ✅ - Complete 2D to 3D extrusion system
  - extrude2D() function for extruding Shape2D into 3D geometry
  - Support for depth, offset, and cap options (none/front/back/both)
  - Automatic normal generation using cross products
  - Fan triangulation for caps
  - extrudeShape() helper for creating from parameters
- `src/tests/__tests__/Extrude.test.ts` ✅ - Comprehensive unit tests (19 passing)
  - Basic extrusion tests (square, circle)
  - Cap options tests (none, front, back, both)
  - Normal generation validation
  - Geometry validation (indices, degenerates)
  - extrudeShape helper tests
  - Complex shapes (transformed, high-poly)
- `src/builder/YamlBuilderParser.ts` ✅ - YAML integration
  - Added YamlShape interface for 2D shape definitions
  - Added shapes: section to YamlBuilderDefinition
  - Added extrude2d to YamlGeometryCommand type
  - Process shapes section and store on builder
  - extrude2d command processing with shape evaluation
- `builders/Sign.yaml` ✅ - Demo builder
  - Three shape variations (rectangle, circle, rounded)
  - Size decisions (small, medium, large)
  - Demonstrates extrude2d with when: conditionals
- `src/tests/mcp-integration.test.ts` ✅ - Integration tests

#### Implementation Notes

**Extrusion Architecture:**
- Extrudes 2D shapes along Y axis (XZ plane → 3D)
- Front face at Y=offset, back face at Y=offset+depth
- Side faces: quads triangulated into pairs
- Caps: fan triangulation from first vertex
- Per-vertex normals: accumulated from adjacent faces, normalized

**Cap Options:**
- `none` - Hollow extrusion (no end caps)
- `front` - Cap at start (Y=offset)
- `back` - Cap at end (Y=offset+depth)
- `both` - Both caps (default)

**YAML Integration:**
```yaml
shapes:
  sign_shape:
    type: rect
    width: $width
    height: $height
    center: { x: 0, z: 0 }

geometry:
  - extrude2d: sign_plate
    shape: sign_shape
    depth: $thickness
    caps: both
    offset: 0
    color: $wood
```

**Supported Shape Types:**
- `rect` - Rectangle with width/height
- `circle` - Circle with radius/segments
- `ellipse` - Ellipse with radiusX/radiusZ/segments
- `polygon` - Custom points array

**Performance:**
- Rectangle: 8 vertices, 12 faces (with caps)
- Circle (32 segments): 64 vertices, ~100 faces (with caps)
- High-poly (64 segments): 128 vertices, ~200 faces

**Next Steps (P2M3-003):**
- Add bevel/chamfer support to extrude2d
- Smooth normals on beveled edges
- Enhanced Sign builder with bevels

**Completed:** 2026-01-17
- Full 2D → 3D extrusion system
- 19 unit tests passing
- YAML integration with shapes: section
- Demo Sign builder working
- Integration tests added

---

### P2M3-003: Bevel & Chamfer

**Epic:** P2-M3 2D Shapes
**Status:** ✅ Complete
**Size:** M
**Priority:** P2
**Dependencies:** P2M3-002

#### Context

Add beveled edges to extruded shapes for production quality.

#### Acceptance Criteria

- [x] Add bevel option to extrude: `bevel: { size: 0.02, segments: 2 }`
- [x] Chamfer as bevel with segments=1
- [x] Smooth normals on bevel
- [x] Test: Sign with beveled edges

#### Files Modified

- `src/geometry/Extrude.ts` ✅
  - Added `BevelParams` interface (size, segments)
  - Added `bevel` parameter to `ExtrudeParams`
  - Implemented `extrude2DWithBevel()` for beveled extrusion
  - Creates additional geometry layers for bevel segments
  - Chamfer: segments=1 (single 45° cut)
  - Rounded bevel: segments>1 (smooth curve)
  - Automatic bevel size clamping to depth/2
  - Inset calculation for beveled edges
- `src/tests/__tests__/Extrude.test.ts` ✅
  - Added 4 new tests for bevel functionality
  - Tests chamfer (segments=1)
  - Tests rounded bevel (segments>1)
  - Tests bevel size clamping
  - Tests bevels on circular shapes
  - All 23 tests passing
- `src/builder/YamlBuilderParser.ts` ✅
  - Added bevel parameter to extrude2d YAML command
  - Added bevel to YamlGeometryCommand type
  - Expression evaluation for bevel size and segments
- `builders/Sign.yaml` ✅
  - Added bevel to rounded shape as demonstration

#### Implementation Notes

**Bevel Architecture:**
- **Chamfer** (segments=1): Single angled cut, creates 4 layers
  - Front cap → Front bevel inner → Back bevel inner → Back cap
  - Inset amount = bevel size
- **Rounded Bevel** (segments>1): Smooth curve with multiple layers
  - Additional intermediate layers interpolated with cosine curve
  - Creates smoother transition for professional look

**Layer Generation:**
```
Layer 0: Front cap face (Y = offset)
Layer 1: Front bevel inner (Y = offset + bevelSize, inset)
Layer 2..N-2: Intermediate bevel segments (if segments > 1)
Layer N-1: Back bevel inner (Y = offset + depth - bevelSize, inset)
Layer N: Back cap face (Y = offset + depth)
```

**Inset Calculation:**
- Simplified approach: moves vertices toward shape center
- Inset factor for chamfer: bevel size
- Inset factor for rounded: bevel size × 0.7071 (cos 45°)

**YAML Syntax:**
```yaml
geometry:
  - extrude2d: sign_plate
    shape: rounded_shape
    depth: 0.05
    bevel:
      size: 0.01        # Distance from edge
      segments: 2       # 1=chamfer, 2+=rounded
    caps: both
```

**Performance:**
- Chamfer (segments=1): 4 layers × point count vertices
- Rounded (segments=3): 5 layers × point count vertices
- More segments = smoother but more geometry

**Completed:** 2026-01-17
- Full bevel and chamfer support
- 23 unit tests passing (4 new bevel tests)
- YAML integration complete
- Sign builder demonstrates beveled edges

---

### P2M3-004: Radial Array

**Epic:** P2-M3 2D Shapes
**Status:** ✅ Complete
**Size:** S
**Priority:** P2
**Dependencies:** P2M3-001

#### Context

Duplicate elements around a center point for gears, decorative patterns.

#### Acceptance Criteria

- [x] Add `radialArray:` YAML construct
- [x] Parameters: element, count, center, axis, radius
- [x] Works with 2D shapes and 3D geometry

#### Files Modified

- `src/builder/YamlBuilderParser.ts` ✅
  - Added `radialArray` to YamlGeometryCommand type
  - Implemented radial array processing in geometry section
  - Supports count, radius, center, and axis parameters
  - Rotates and positions geometry around center point
  - Provides context variables: `__radial_index`, `__radial_angle`, `__radial_angle_deg`
- `src/geometry/MeshTransform.ts` - Used existing rotate() function
- `builders/RadialPattern.yaml` ✅ - Demo builder

#### Implementation Notes

**YAML Syntax:**
```yaml
geometry:
  - radialArray: pattern_name
    count: 8                      # Number of copies
    radius: 1.0                   # Distance from center
    center: { x: 0, y: 0, z: 0 }  # Center point (optional)
    axis: y                        # Rotation axis: x, y, or z (default: y)
    geometry:
      # Geometry to duplicate
      - extrude2d: element
        shape: element_shape
        depth: 0.05
```

**Features:**
- Duplicates geometry in a circular pattern
- Automatic rotation and translation
- Configurable axis (x, y, or z)
- Radius can be 0 for in-place rotation
- Works with any geometry commands (vertices, faces, extrude2d, etc.)
- Context variables available inside radialArray:
  - `__radial_index` - Current element index (0 to count-1)
  - `__radial_angle` - Angle in radians
  - `__radial_angle_deg` - Angle in degrees

**Transform Pipeline:**
1. Build geometry for current instance
2. Rotate around specified axis by angle = (i / count) × 2π
3. Translate to position: center + (cos(angle), sin(angle)) × radius
4. Merge with accumulated mesh

**Axis Behavior:**
- `axis: y` - Rotate around Y (XZ plane), typical for gears/patterns
- `axis: x` - Rotate around X (YZ plane)
- `axis: z` - Rotate around Z (XY plane)

**Use Cases:**
- Gears and mechanical parts
- Decorative patterns and rosettes
- Flower petals
- Radial symmetry elements
- Architectural details

**Completed:** 2026-01-17
- Full radial array implementation
- Demo RadialPattern builder
- Works with extrude2d and other geometry
- Ready for Gear builder (P2M3-005)

---

### P2M3-005: Gear Builder Demo

**Epic:** P2-M3 2D Shapes
**Status:** 🟡 In Progress
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

## Epic: P2-M3b - Architecture & Flow Consolidation

> **Goal:** Clarify system flows and reduce duplicated implementations by consolidating around central services.
> **Status:** ⬜ Not Started
> **Priority:** P1
> **Blocked by:** None

### P2M3b-001: System Flow Map (High-Level)

**Epic:** P2-M3b Architecture & Flow Consolidation
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P1
**Dependencies:** None

#### Context

We need a single, high-level view of how data and commands flow through the system to keep implementations consistent.

#### Acceptance Criteria

- [ ] Document end-to-end flows (authoring → parsing → geometry → mesh → dashboard)
- [ ] Identify central services and their responsibilities
- [ ] Include "source of truth" notes for key abstractions
- [ ] Link to supporting docs (ARCHITECTURE.md, DSL_COMMANDS.md, YAML_BUILDER_FORMAT.md)

#### Files to Modify

- `docs/SYSTEM_FLOW.md` (new)

---

### P2M3b-002: Service Inventory + Reuse Policy

**Epic:** P2-M3b Architecture & Flow Consolidation
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P1
**Dependencies:** P2M3b-001

#### Context

We are reimplementing similar logic across tools. We need a simple inventory of central services and reuse guidance.

#### Acceptance Criteria

- [ ] List core services (MathService, YamlBuilderParser, Shape2D, Path2D, etc.) and intended usage
- [ ] Define "do not duplicate" areas and preferred extension points
- [ ] Add a checklist for new features (which service should own the logic?)

#### Files to Modify

- `docs/SYSTEM_FLOW.md`

---

### P2M3b-003: Consolidation Target List

**Epic:** P2-M3b Architecture & Flow Consolidation
**Status:** ⬜ Not Started
**Size:** S
**Priority:** P1
**Dependencies:** P2M3b-001

#### Context

We should identify concrete areas where functionality is duplicated and plan consolidation work.

#### Acceptance Criteria

- [ ] Identify at least 3 duplicated or fragmented areas
- [ ] Propose the owning service for each area
- [ ] Capture follow-up refactor tickets (future epics)

#### Files to Modify

- `docs/SYSTEM_FLOW.md`

---

## Epic: P2-M4 - Text & Advanced 2D

> **Goal:** Signage, labels, engravings.
> **Status:** 🟡 In Progress
> **Blocked by:** P2-M3b (architecture & flow consolidation)

### Milestone Acceptance Ladder (P2-M4)

See `docs/MILESTONE_ACCEPTANCE_LADDERS.md#p2-m4-text--advanced-2d` for the full ladder.

**Exit Criteria (Level 1, Summary)**
- Bezier-preserving Path2D with configurable tessellation tolerance.
- Text holes via 2D boolean operations.
- Extruded text supports bevels and consistent normals.
- Text-on-2D-path distortion with predictable spacing.

### Current State (P2-M4 Evaluation)

- **Done:** Font integration, text → 2D shapes, procedural fallback font.
- **In Progress:** Path2D bezier preservation + tessellation.
- **Missing for Level 1:** Path-based Shape2D integration, 2D boolean ops for holes, robust extrude for multi-contour glyphs,
  and text-on-path deformation.
- **Missing for Level 2:** Typography domain model and calligraphic stroke rendering.

### P2M4-001: Font Integration

**Epic:** P2-M4 Text
**Status:** ✅ Complete
**Size:** M
**Priority:** P3
**Dependencies:** P2M3-001

#### Context

Parse font files to extract glyph outlines.

#### Acceptance Criteria

- [x] Integrate opentype.js for font parsing
- [x] Bundle 1-2 default fonts (sans, serif) - *Deferred: users provide fonts*
- [x] DSL command: `text.load <name> path=<path>` - Load font files
- [x] DSL command: `text.list` - List loaded fonts
- [x] DSL command: `text.outline <char> font=<name>` - Get glyph outline
- [x] DSL command: `text.text <string> font=<name>` - Get text outlines with kerning
- [x] Return 2D point arrays with hole detection
- [x] Unit tests (8 tests passing)
- [x] Documentation in DSL_COMMANDS.md

#### Files Modified

- `package.json` ✅ - Added opentype.js + @types/opentype.js
- `src/text/FontParser.ts` ✅ - Font loading and glyph outline extraction
- `src/authoring/commands/text.ts` ✅ - Text command namespace
- `src/authoring/server.ts` ✅ - Register text namespace
- `src/tests/__tests__/FontParser.test.ts` ✅ - 8 unit tests passing
- `docs/DSL_COMMANDS.md` ✅ - Documented text commands

#### Implementation Details

**FontParser Features:**
- Load TrueType/OpenType fonts via opentype.js
- Extract glyph outlines as 2D point arrays (x, z coordinates)
- Detect holes in glyphs (letters like A, O, P, R)
- Automatic kerning support for text strings
- Bezier curve approximation (quadratic & cubic)
- Bounding box calculation

**Winding Order:**
- Counter-clockwise contours = outer boundaries
- Clockwise contours = holes (proper for 2D boolean operations)

**Completed:** 2026-01-17
- Full font loading system implemented
- 4 DSL commands available
- 8 unit tests passing
- Ready for P2M4-002 (Text to 2D Path)

---

### P2M4-002: Text to 2D Path

**Epic:** P2-M4 Text
**Status:** ✅ Complete
**Size:** M
**Priority:** P3
**Dependencies:** P2M4-001

#### Context

Convert text strings to 2D shapes for extrusion.

#### Acceptance Criteria

- [x] Add `text:` shape type to YAML format
- [x] Parameters: content, font, size, spacing
- [x] Convert glyphs to 2D shape
- [x] Handle multi-character strings with kerning
- [x] Integrate with extrude2d command
- [x] Unit tests (9 tests passing)
- [x] Demo builder: TextSign.yaml
- [x] Documentation in YAML_BUILDER_FORMAT.md

#### Files Modified

- `src/text/TextToShape.ts` ✅ - Text to shape conversion
- `src/builder/YamlBuilderParser.ts` ✅ - Added text type to YamlShape, integrated with extrude2d
- `src/tests/__tests__/TextToShape.test.ts` ✅ - 9 unit tests passing
- `builders/TextSign.yaml` ✅ - Demo builder showing text extrusion
- `docs/YAML_BUILDER_FORMAT.md` ✅ - Documented shapes section including text

#### Implementation Details

**TextToShape Module:**
- `textToShape()` - Convert text string to 2D shape with contours
- `charToShape()` - Single character conversion
- `measureText()` - Get text dimensions without full generation
- Automatic centering support
- Configurable character spacing

**YAML Integration:**
- Added `text` type to `YamlShape` interface
- Properties: `content`, `font`, `size`, `spacing`, `center`
- Integrated with `extrude2d` command
- Font must be pre-loaded via `text.load` command

**Current Limitations:**
- Only outer contours are used (first non-hole contour)
- Holes in glyphs (A, O, P, R, etc.) are not yet subtracted
- Requires P2M4-003 (2D Boolean Operations) for proper hole handling
- Multiple outer contours (rare) use only the first one

**Example Usage:**
```yaml
shapes:
  sign_text:
    type: text
    content: "HELLO"
    font: "simple"  # Built-in procedural font (no external files needed)
    size: 0.5
    spacing: 0.02
    center: { x: 0, z: 0 }

geometry:
  - extrude2d: text
    shape: sign_text
    depth: 0.05
    bevel:
      size: 0.01
      segments: 2
```

**Completed:** 2026-01-17
- Full text-to-shape pipeline working
- 17 unit tests passing (FontParser + TextToShape)
- TextSign.yaml demo builder created
- **NEW:** ProceduralFont system implemented - built-in "simple" font
- Available letters: H, E, L, O, I, N, X, T (plus space)
- No external font files required for basic text
- External fonts still supported via text.load command
- Ready for P2M4-003 (Path2D with Bezier Curves)

---

### P2M4-003: Path2D with Bezier Curves

**Epic:** P2-M4 Text & Vector Graphics
**Status:** 🔄 In Progress
**Size:** L
**Priority:** P2
**Dependencies:** P2M3-001

#### Context

Implement proper vector graphics with bezier curves instead of polygon approximation.
This is foundational for fonts, calligraphy, musical notes, patterns, and any curved 2D graphics.

**Problem:** Current implementation approximates curves as many small line segments (polygons).
This loses precision, doesn't scale cleanly, and isn't true vector graphics.

**Solution:** Store bezier curve data (Path2D), tessellate only when rendering/extruding.

**Reference:** `docs/BEZIER_CURVE_IMPLEMENTATION.md`

#### Acceptance Criteria

**Phase 1: Path2D Foundation**
- [x] Create `src/geometry/Path2D.ts` with curve segment types
- [x] Implement `PathSegment` types: moveTo, lineTo, quadraticCurveTo, cubicCurveTo, closePath
- [x] Implement `tessellateQuadraticCurve()` and `tessellateCubicCurve()`
- [x] Implement `pathToPolygon()` for converting curves to triangles
- [x] Implement helper functions: `createRectPath()`, `createCirclePath()`
- [ ] Tessellation supports configurable tolerance/segment budget and preserves bounds within tolerance
- [ ] Unit tests for all tessellation functions
- [ ] Unit tests for path creation helpers

**Phase 2: Shape2D Integration**
- [ ] Add `type: 'path'` to Shape2D
- [ ] Add `Shape2D.fromPath(path: Path2D, curveSegments?: number)`
- [ ] Existing extrusion works with path-based shapes
- [ ] Unit tests for Shape2D path integration

**Phase 3: FontParser Integration**
- [ ] Add `FontParser.getGlyphPath()` returning `Path2D` (curves preserved)
- [ ] Keep existing `getGlyphOutline()` for backward compatibility
- [ ] Font loading works with Path2D output
- [ ] Unit tests for glyph path extraction

**Phase 4: YAML Path Type**
- [ ] Add `type: path` to YamlShape interface
- [ ] Parse path segments from YAML:
  ```yaml
  shapes:
    flourish:
      type: path
      segments:
        - { moveTo: { x: 0, z: 0 } }
        - { cubicTo: { c1: {...}, c2: {...}, end: {...} } }
        - { close: true }
  ```
- [ ] Update extrude2d to handle path shapes
- [ ] Unit tests for YAML path parsing

**Phase 5: Vector Graphics Library**
- [ ] Create sample letter builders using paths (e.g., LetterA.yaml with curves)
- [ ] Create sample icon builders (Heart.yaml, Star.yaml)
- [ ] Demonstrate smooth scaling
- [ ] Documentation for authoring vector graphics

#### Files to Create/Modify

- `src/geometry/Path2D.ts` ✅ Created
- `src/tests/__tests__/Path2D.test.ts` (new)
- `src/geometry/Shape2D.ts` - Add path support
- `src/text/FontParser.ts` - Add getGlyphPath()
- `src/builder/YamlBuilderParser.ts` - Add path type
- `builders/letters/LetterA.yaml` (new) - Demo with curves
- `builders/icons/Heart.yaml` (new) - Demo icon

#### Technical Design

**Path2D Data Model:**
```typescript
type PathSegment =
  | { type: 'moveTo'; point: Point2D }
  | { type: 'lineTo'; point: Point2D }
  | { type: 'quadraticCurveTo'; control: Point2D; end: Point2D }
  | { type: 'cubicCurveTo'; control1: Point2D; control2: Point2D; end: Point2D }
  | { type: 'closePath' };

interface Path2D {
  segments: PathSegment[];
  closed: boolean;
}
```

**Integration Flow:**
```
Sources (Font, SVG, YAML) → Path2D (curves) → tessellate → Shape2D (polygon) → extrude → Mesh
```

**Key Principle:** Store curves, tessellate late.

---

### P2M4-004: 2D Boolean Operations

**Epic:** P2-M4 Text
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P3
**Dependencies:** P2M4-003

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

### P2M4-005: Text Extrusion

**Epic:** P2-M4 Text
**Status:** ⬜ Not Started
**Size:** M
**Priority:** P3
**Dependencies:** P2M4-003, P2M4-004

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

### P2M4-006: Wall Sign Builder

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

### P2M4-007: Text on Path (2D + 3D)

**Epic:** P2-M4 Text
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P2
**Dependencies:** P2M4-003, P2M4-005

#### Context

Text should be deformable along 2D or 3D curves (arches, ribbons, engravings), not just flat extrusion.

#### Acceptance Criteria

- [ ] Add text-on-path API (authoring + YAML): map glyph outlines along a curve
- [ ] 2D path deformation with consistent spacing and baseline alignment
- [ ] 3D path deformation with curvature-aware normals
- [ ] Preserve glyph proportions under moderate curvature (no extreme shear)
- [ ] Demo builder: CurvedBanner.yaml or ArchSign.yaml
- [ ] Unit tests for spacing + baseline stability

#### Files to Modify

- `src/text/TextOnPath.ts` (new)
- `src/geometry/Path3D.ts` (new or reuse existing curve types)
- `src/builder/YamlBuilderParser.ts`
- `builders/CurvedBanner.yaml` (new)

---

### P2M4-008: Typography Domain Model + Calligraphy Strokes

**Epic:** P2-M4 Text
**Status:** ⬜ Not Started
**Size:** L
**Priority:** P2
**Dependencies:** P2M4-003

#### Context

We need typography-aware output rather than crude letter approximations. This milestone adds typographic metrics and
calligraphic stroke modeling for high-quality text rendering.

#### Acceptance Criteria

- [ ] Expose font metrics: baseline, x-height, cap height, ascender, descender
- [ ] Kerning + ligature support for layout (fallback to defaults when absent)
- [ ] Add calligraphic stroke mode: variable stroke width + pen angle
- [ ] Text-to-path honors metrics and stroke settings
- [ ] Example builder: CalligraphySample.yaml with curved strokes
- [ ] Documentation for typography terms and usage

#### Files to Modify

- `src/text/FontParser.ts`
- `src/text/TextToShape.ts`
- `docs/YAML_BUILDER_FORMAT.md`
- `builders/CalligraphySample.yaml` (new)

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

## Phase 3 - Advanced Asset Tools

> **Reference:** See `ASSET_ANALYSIS_SYSTEM.md` for full architecture

These tools enable intelligent import of external assets (SVG, fonts, 3D models) with automatic analysis and parametrization.

### P3-Advanced-001: Asset Analyzer Framework

**Epic:** Phase 3 - Asset Analysis
**Status:** ⬜ Deferred
**Size:** L
**Priority:** P4 (Optional)
**Dependencies:** P2M4-Ext-003 (Simple SVG Import)

#### Context

Foundation for intelligent asset import. Rather than simple 1:1 conversion, analyze assets to extract semantic information and generate parametric builders.

**When to implement:** After P2-M4 complete, when users request batch import of large asset libraries

#### Acceptance Criteria

- [ ] CLI tool: `procedurable analyze <input> --output <output.yaml>`
- [ ] Format parsers: SVG, DXF, glTF, OBJ
- [ ] Asset data model (vertices, contours, hierarchy)
- [ ] Builder generator framework
- [ ] Unit tests for each format parser
- [ ] Documentation: Asset Import Guide

#### Files to Create

- `tools/asset-analyzer/` (new directory)
- `tools/asset-analyzer/cli.ts` - CLI entry point
- `tools/asset-analyzer/parsers/` - Format parsers
- `tools/asset-analyzer/generator.ts` - YAML builder generator
- `docs/ASSET_IMPORT_GUIDE.md` (new)

---

### P3-Advanced-002: Geometric Analysis Engine

**Epic:** Phase 3 - Asset Analysis
**Status:** ⬜ Deferred
**Size:** M
**Priority:** P4 (Optional)
**Dependencies:** P3-Advanced-001

#### Context

Analyze asset geometry to extract structural properties and identify parametrization opportunities.

#### Acceptance Criteria

- [ ] **Symmetry detection** - vertical, horizontal, rotational
  - Algorithm: Point reflection testing
  - Output: Symmetry axes with confidence scores
  
- [ ] **Proportion extraction** - dimensional relationships
  - Algorithm: Ratio detection (aspect ratio, golden ratio, etc.)
  - Output: Suggested derived measurements
  
- [ ] **Curve analysis** - parametrize bezier curves
  - Algorithm: Curve fitting to simple functions
  - Output: Mathematical expressions for curves
  
- [ ] **Topology analysis** - holes, boundaries, components
  - Algorithm: Connected component detection
  - Output: Contour structure with hole flags

- [ ] Unit tests with known shapes (heart, star, arrow)
- [ ] Confidence scoring for each analysis
- [ ] Documentation in ASSET_ANALYSIS_SYSTEM.md

#### Files to Create

- `tools/asset-analyzer/analysis/geometric.ts` (new)
- `src/tests/asset-analyzer/geometric.test.ts` (new)

#### Example Output

```typescript
{
  symmetry: {
    vertical: { axis: 0, confidence: 0.95 },
    rotational: { order: 5, center: [0, 0], confidence: 0.88 }
  },
  proportions: {
    aspectRatio: 0.92,
    relationships: [
      { param1: "height", param2: "width", ratio: 0.92 }
    ]
  }
}
```

---

### P3-Advanced-003: Semantic Analysis Engine

**Epic:** Phase 3 - Asset Analysis
**Status:** ⬜ Deferred
**Size:** M
**Priority:** P4 (Optional)
**Dependencies:** P3-Advanced-001

#### Context

Understand the **meaning** of shapes, not just geometry. Enable auto-tagging and categorization.

#### Acceptance Criteria

- [ ] **Shape classification** - categorize as icon/pattern/ornament/text/abstract
  - Features: complexity, symmetry, aspect ratio, curvature
  - ML model: K-NN or decision tree trained on labeled dataset
  
- [ ] **Tag generation** - auto-generate semantic tags
  - Sources: filename analysis, shape matching, geometric features
  - Output: Ranked list of relevant tags
  
- [ ] **Hierarchy extraction** - detect grouped/nested elements
  - Parse SVG groups → builder compositions
  - Identify parent-child relationships
  
- [ ] Training data collection (100+ labeled shapes)
- [ ] Validation accuracy > 80% on test set
- [ ] Documentation: Semantic Analysis Guide

#### Files to Create

- `tools/asset-analyzer/analysis/semantic.ts` (new)
- `tools/asset-analyzer/training-data/` (labeled dataset)
- `src/tests/asset-analyzer/semantic.test.ts` (new)

---

### P3-Advanced-004: Parametrization Engine

**Epic:** Phase 3 - Asset Analysis
**Status:** ⬜ Deferred
**Size:** L
**Priority:** P4 (Optional)
**Dependencies:** P3-Advanced-002, P3-Advanced-003

#### Context

Convert static assets → parametric builders. The "smart" part of smart import.

#### Acceptance Criteria

- [ ] **Variation detection** - analyze multiple similar assets
  - Batch processing mode
  - Point correspondence algorithm
  - Variation clustering (k-means or hierarchical)
  - Decision generation from clusters
  
- [ ] **Coordinate parametrization** - replace absolute values with expressions
  - Strategy: dimension-based, symmetry-based, relationship-based
  - Expression synthesis from analysis results
  - Fallback to simple normalization
  
- [ ] **Quality scoring** - rate parametrization quality
  - Metrics: expression complexity, coverage, semantic meaning
  - User feedback loop for improvement
  
- [ ] Example: 3 heart variants → 1 parametric Heart.yaml
- [ ] Benchmarks: Process 1000 icons in < 5 minutes
- [ ] Documentation: Parametrization Guide

#### Files to Create

- `tools/asset-analyzer/analysis/variations.ts` (new)
- `tools/asset-analyzer/parametrization/engine.ts` (new)
- `tools/asset-analyzer/parametrization/strategies.ts` (new)

#### Example Result

```yaml
# Auto-generated from 3 SVG variants
name: Heart
decisions:
  style:
    type: choice
    options: [rounded, sharp, modern]
    # DETECTED: 3 variants in batch
derived:
  curve_factor: "if(eq(style, 'rounded'), 1.0, if(eq(style, 'sharp'), 0.7, 0.9))"
  # GENERATED from variation analysis
```

---

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
