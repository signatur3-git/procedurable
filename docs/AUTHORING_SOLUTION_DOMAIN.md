# Authoring Solution Domain

> Tools, algorithms, and patterns used in procedural content generation authoring systems.

This document complements `SOLUTION_DOMAIN.md` (geometry tools) by focusing on **authoring infrastructure** - the programming constructs and algorithms that power procedural generation.

---

## Category 1: Decision Systems

> How builders express and resolve choices.

### 1.1 Random Number Generation
**What it does:** Produce deterministic pseudo-random values from a seed
**Used for:** All variation, reproducibility
**Status:** ✅ Built (`src/platform/math/Random.ts`)
**Implementation:** Seeded PRNG (xorshift or similar)

### 1.2 Weighted Choice
**What it does:** Select from options with non-uniform probability
**Used for:** Style decisions, material selection
**Status:** ✅ Built (TracedBuilder.decide with weights)
**Algorithm:** Cumulative distribution sampling

### 1.3 Range Sampling
**What it does:** Pick value within continuous range
**Used for:** Dimensions, angles, variation amounts
**Status:** ✅ Built (TracedBuilder.decideNumber)
**Options:** Uniform, gaussian, triangular distributions

### 1.4 Conditional Decisions
**What it does:** Make decisions based on prior decisions
**Used for:** Style-dependent options, progressive refinement
**Status:** 🟡 Partial (YAML `condition:` for counts only)
**Needed:** General `if/then/else` in YAML

### 1.5 Correlated Decisions
**What it does:** Vary multiple values together
**Used for:** Proportional scaling, style coherence
**Status:** ⬜ Not built
**Approach:** Named correlation groups, shared random offset

### 1.6 Decision Trees
**What it does:** Hierarchical branching decisions
**Used for:** Complex style systems, species variation
**Status:** ⬜ Not built
**Approach:** Nested decision blocks in YAML

---

## Category 2: Constraint Systems

> How builders enforce rules and validity.

### 2.1 Spatial Constraints (Placement)
**What it does:** Position objects without overlap
**Used for:** Scene layout, furniture arrangement
**Status:** ✅ Built (`src/platform/scene/Placement.ts`)
**Algorithm:** Candidate generation + collision filtering

### 2.2 Measurement Constraints
**What it does:** Enforce relationships between values
**Used for:** "A must be less than B", "C = A + B"
**Status:** ⬜ Not built
**Approach:** Constraint solver, or derived values with validation

### 2.3 Topology Constraints
**What it does:** Ensure mesh validity
**Used for:** Watertight meshes, manifold geometry
**Status:** 🟡 Partial (MeshValidation.ts checks but doesn't fix)
**Needed:** Auto-repair operations

### 2.4 Style Constraints
**What it does:** Enforce aesthetic consistency
**Used for:** All parts match a style, color harmony
**Status:** 🟡 Partial (override propagation)
**Needed:** Style inheritance, validation

### 2.5 Physical Constraints
**What it does:** Ensure physical plausibility
**Used for:** Stable furniture, balanced objects
**Status:** ⬜ Not built (Phase 3)
**Approach:** Center of mass, support polygon

---

## Category 3: Composition Patterns

> How builders combine to form complex outputs.

### 3.1 Simple Composition
**What it does:** Place sub-builder at fixed offset
**Used for:** Table with legs, chair with seat
**Status:** ✅ Built (YAML `compose:`)
**Features:** Offset, rotation, scale, overrides

### 3.2 Parametric Composition
**What it does:** Sub-builder position from expressions
**Used for:** Legs at computed corners
**Status:** ✅ Built (expression evaluation in offsets)

### 3.3 Iterative Composition (Array/Repeat)
**What it does:** Multiple instances with pattern
**Used for:** Fence posts, stair steps, teeth
**Status:** ✅ Built (YAML `compose:` with `repeat:`)
**Notes:** Repeat exists for geometry and composition; exposes index var (e.g., `i`)

### 3.4 Conditional Composition
**What it does:** Include/exclude sub-builders based on decision
**Used for:** Optional parts (stretchers, arms)
**Status:** ✅ Built (YAML `compose:` with `if:`)

### 3.5 Placement-Based Composition
**What it does:** Sub-builders at constraint-solved positions
**Used for:** Chairs around table, books on shelf
**Status:** ✅ Built (YAML `placement:`)

### 3.6 Recursive Composition
**What it does:** Builder references itself with termination
**Used for:** Trees, fractals, nested structures
**Status:** ⬜ Not built
**Needed:** Depth limit, base case detection

### 3.7 Instancing
**What it does:** Share geometry, vary only transform
**Used for:** Many identical objects, memory efficiency
**Status:** ⬜ Not built
**Approach:** Instance references in output, shared mesh data

---

## Category 4: Expression & Scripting

> How builders compute values.

### 4.1 Math Expressions
**What it does:** Evaluate mathematical formulas
**Used for:** Derived measurements, positions
**Status:** ✅ Built (`src/platform/math/MathService.ts`)
**Features:** Arithmetic, trig, constants (pi), variables

### 4.2 Conditional Expressions
**What it does:** If-then-else in expressions
**Used for:** "Use A if round, else B"
**Status:** ⬜ Not built
**Syntax idea:** `if(condition, then_value, else_value)`

### 4.3 String Interpolation
**What it does:** Build strings from values
**Used for:** Part names, debug messages
**Status:** 🟡 Partial (template expansion exists)

### 4.4 List/Array Operations
**What it does:** Map, filter, reduce over collections
**Used for:** Generate N items, filter valid positions
**Status:** ⬜ Not built
**Consideration:** Keep YAML simple, add if needed

### 4.5 Custom Functions
**What it does:** Define reusable computations
**Used for:** Complex formulas, domain-specific helpers
**Status:** ⬜ Not built
**Options:** YAML `functions:` block, or TypeScript only

---

## Category 5: Tracing & Debugging

> How builders expose their internals.

### 5.1 Decision Traces
**What it does:** Record what was decided and why
**Used for:** Debugging, understanding variation
**Status:** ✅ Built (TracedBuilder.decisions map)
**Output:** Name, value, source (random/override/default)

### 5.2 Measurement Traces
**What it does:** Record computed measurements
**Used for:** Debugging dimensions, verification
**Status:** ✅ Built (TracedBuilder.measurements map)

### 5.3 Geometry Traces
**What it does:** Link vertices/faces to source operations
**Used for:** Understanding mesh structure
**Status:** ✅ Built (TracedBuilder.traces map)
**Keys:** `vertex:name`, `loop:name`, `face:name`

### 5.4 Composition Traces
**What it does:** Show sub-builder hierarchy
**Used for:** Understanding scene structure
**Status:** ✅ Built (`compose:*` trace keys)

### 5.5 Validation Traces
**What it does:** Report mesh/builder issues
**Used for:** Quality assurance, error detection
**Status:** ✅ Built (TracedBuilder validation)
**Levels:** Error, warning, info

### 5.6 Performance Traces
**What it does:** Timing, vertex/face counts
**Used for:** Optimization, budget tracking
**Status:** 🟡 Partial (counts in output, no timing)

---

## Category 6: Storage & Versioning

> How builders are persisted and managed.

### 6.1 File-Based Storage
**What it does:** Store builders as YAML files
**Used for:** Development, version control
**Status:** ✅ Built (`src/storage/FileSystemStorage.ts`)

### 6.2 Cloud Storage
**What it does:** Store builders in S3-compatible storage
**Used for:** Production, sharing, collaboration
**Status:** ⬜ Not built (documented in DEPLOYMENT_STORAGE.md)

### 6.3 Material Library
**What it does:** Named colors and materials
**Used for:** Reusable material definitions
**Status:** ✅ Built (`src/platform/materials/MaterialLibrary.ts`)

### 6.4 Builder Indexing
**What it does:** List available builders with metadata
**Used for:** Discovery, search, filtering
**Status:** ✅ Built (`builder.list` command)

### 6.5 Schema Versioning
**What it does:** Track YAML format version
**Used for:** Migration, backwards compatibility
**Status:** 🟡 Partial (`version: "1.0"` in YAML, no migration)

### 6.6 Builder Dependencies
**What it does:** Track which builders use which
**Used for:** Impact analysis, recompilation
**Status:** ⬜ Not built

---

## Category 7: API & Integration

> How external tools interact with the system.

### 7.1 DSL Command Interface
**What it does:** Text-based command execution
**Used for:** Agent interaction, scripting
**Status:** ✅ Built (command parser + registry)
**Protocol:** `namespace.command arg1=value1`

### 7.2 Bulk Command Execution
**What it does:** Run multiple commands in one request
**Used for:** Agent efficiency, atomic operations
**Status:** ✅ Built (`/api/execute` with command array)

### 7.3 WebSocket Events
**What it does:** Push updates to clients
**Used for:** Live preview, collaboration
**Status:** ✅ Built (authoring server broadcasts)

### 7.4 REST API
**What it does:** HTTP endpoints for operations
**Used for:** Integration, tooling
**Status:** ✅ Built (`/api/execute`, `/api/help`, `/health`)

### 7.5 MCP Protocol
**What it does:** Model Context Protocol for AI agents
**Used for:** AI-powered builder authoring
**Status:** ✅ Built (`src/servers/mcp/http-server.ts`)

### 7.6 Export Pipeline
**What it does:** Convert output to standard formats
**Used for:** Use in game engines, renderers
**Status:** ⬜ Not built (Phase 2)
**Formats:** glTF, FBX, OBJ

---

## Category 8: Algorithms & Data Structures

> Core computational building blocks.

### 8.1 Spatial Indexing
**What it does:** Fast spatial queries (overlap, nearest)
**Used for:** Placement, collision, selection
**Status:** 🟡 Partial (AABB, no spatial tree)
**Options:** BVH, octree, R-tree

### 8.2 Graph Structures
**What it does:** Represent connectivity
**Used for:** Mesh topology, scene hierarchy, dependencies
**Status:** 🟡 Implicit (mesh has vertex/face refs)

### 8.3 CSG Algorithms
**What it does:** Boolean operations on meshes
**Used for:** Holes, cutouts, unions
**Status:** ⬜ Not built (P2-M5)
**Options:** BSP-based, robust predicates

### 8.4 Triangulation
**What it does:** Convert polygons to triangles
**Used for:** Rendering, export
**Status:** ✅ Built (Face.triangulate)
**Algorithm:** Ear clipping (simple), constrained Delaunay (complex)

### 8.5 Mesh Repair
**What it does:** Fix invalid geometry
**Used for:** Post-boolean cleanup, import repair
**Status:** ⬜ Not built
**Operations:** Fill holes, remove degenerates, fix normals

### 8.6 Path Finding / Graph Traversal
**What it does:** Find routes through graphs
**Used for:** Edge loops, topology analysis
**Status:** ⬜ Not built

---

## Category 9: Noise & Pattern Generation

> Algorithms for natural variation and procedural patterns.
> **Reference:** See `PROCEDURAL_TECHNIQUES.md` for detailed descriptions.

### 9.1 Perlin/Simplex Noise
**What it does:** Smooth, continuous pseudo-random values in N dimensions
**Used for:** Terrain, organic variation, wood grain, cloud patterns
**Status:** ✅ Built (Perlin 2D + 3D in `src/platform/math/MathService.ts`)

### 9.2 Fractal Brownian Motion (FBM)
**What it does:** Layered noise at multiple frequencies (octaves)
**Used for:** Terrain detail, natural textures, clouds
**Status:** ✅ Built (`fbm()` in `src/platform/math/MathService.ts`)

### 9.3 Voronoi Diagrams
**What it does:** Partition space into cells based on seed points
**Used for:** City blocks, cracked patterns, scales, territory
**Status:** ⬜ Not built
**Priority:** HIGH - Layout and patterns
**Effort:** M (Fortune's algorithm or brute force)

### 9.4 Poisson Disk Sampling
**What it does:** Scatter points with minimum distance constraint
**Used for:** Natural object placement (trees, rocks, stars)
**Status:** ⬜ Not built
**Better than:** Random scattering (no clumps, no gaps)
**Effort:** S (~50 lines, Bridson's algorithm)

### 9.5 L-Systems
**What it does:** String rewriting rules for branching structures
**Used for:** Trees, plants, roots, fractals, recursive architecture
**Status:** ⬜ Not built
**Priority:** MEDIUM - Botanical/organic
**Effort:** M (parser + turtle interpreter)

### 9.6 Wave Function Collapse (WFC)
**What it does:** Constraint propagation for tile/voxel filling
**Used for:** Tile-based levels, texture synthesis, city blocks
**Status:** ⬜ Not built
**Priority:** MEDIUM - Complex but powerful
**Effort:** L (constraint propagation, backtracking)

### 9.7 Cellular Automata
**What it does:** Grid-based rules that evolve patterns
**Used for:** Cave generation, organic growth, crystal patterns
**Status:** ⬜ Not built
**Classic:** Game of Life, cave gen "4-5 rule"
**Effort:** S (simple grid iteration)

### 9.8 Gradient/Flow Fields
**What it does:** Vector fields that guide direction/orientation
**Used for:** Grass direction, fur, wind effects, river flow
**Status:** ⬜ Not built
**Effort:** S (vector storage + interpolation)

---

## Category 10: Scale & Streaming

> Infrastructure for large/infinite world generation.
> **Reference:** See `SCALE_AMBITION.md` for architecture analysis.

### 10.1 Coordinate-Based Seeding
**What it does:** Deterministic seed from world position
**Used for:** Reproducible chunks, infinite worlds
**Status:** ✅ Built (`coordinateHash()` in `src/platform/math/MathService.ts`)

### 10.2 Chunk Management
**What it does:** Divide world into loadable/unloadable regions
**Used for:** Memory management, streaming, Minecraft-style
**Status:** ⬜ Not built
**Components:** Chunk grid, loading radius, cache eviction
**Effort:** M (infrastructure change)

### 10.3 Lazy Generation
**What it does:** Generate content only when accessed
**Used for:** Infinite worlds, on-demand detail
**Status:** ⬜ Not built
**Pattern:** Query-based builders instead of eager
**Effort:** L (architecture change)

### 10.4 Level of Detail (LOD)
**What it does:** Multiple detail levels for distance-based rendering
**Used for:** Large visible areas, performance
**Status:** ⬜ Not built
**Approaches:** Pre-generate levels, simplify on fly, imposters
**Effort:** L

### 10.5 Seamless Boundaries
**What it does:** Ensure chunk edges match perfectly
**Used for:** Terrain, roads, rivers across chunks
**Status:** ⬜ Not built
**Patterns:** Border overlap, two-pass generation
**Effort:** M

### 10.6 Hierarchical Generation
**What it does:** Coarse structure first, refine on demand
**Used for:** Galaxy → planet → continent → region → local
**Status:** ⬜ Not built
**Pattern:** Each level seeds the next
**Effort:** M

---

## Category 11: Layout & Level Generation

> Algorithms for spatial arrangement and game levels.

### 11.1 BSP Space Partitioning
**What it does:** Recursively divide space with planes
**Used for:** Doom-style rooms, indoor layouts
**Status:** ⬜ Not built
**Output:** Room polygons, connectivity graph
**Effort:** M

### 11.2 Graph-Based Mission Structure
**What it does:** Define progression as graph, then spatialize
**Used for:** Key/lock puzzles, dungeon flow
**Status:** ⬜ Not built
**Pattern:** Mission graph → room assignment → connections
**Effort:** M

### 11.3 Constraint-Based Layout
**What it does:** Define spatial rules, solver finds arrangement
**Used for:** Architecture, furniture layout
**Status:** 🟡 Partial (placement system)
**Needs:** General constraint solver
**Effort:** L

### 11.4 Template Variation
**What it does:** Pre-authored structure with procedural variation
**Used for:** Buildings, quest templates, room types
**Status:** 🟡 Partial (compose with overrides)
**Effort:** S (mostly have it)

### 11.5 Inside-Out Generation
**What it does:** Generate contents first, build container around
**Used for:** Character-driven scenes, functional spaces
**Status:** ⬜ Not built
**Pattern:** Occupants → space needs → room → architecture
**Effort:** M

---

## Category 12: Fields (Scalar/Vector)

> A field is a function over space that can be sampled at arbitrary coordinates.
> This is one of the main “missing primitives” for natural scenes and whole worlds.

### 12.1 Scalar Fields
**What it does:** `f(x,y,z) -> number`
**Used for:** Heightmaps, density masks, temperature, moisture, distance-to-road
**Status:** ⬜ Not built (we have noise functions, but no field composition model)

### 12.2 Vector Fields
**What it does:** `f(x,y,z) -> Vec2/Vec3`
**Used for:** Wind, river flow, hair direction, flocking guidance
**Status:** ⬜ Not built

### 12.3 Field Composition
**What it does:** Combine fields (add/mul/remap/clamp/warp)
**Used for:** Biome blending, masked scattering, erosion inputs
**Status:** ⬜ Not built

### 12.4 Field-derived Scattering
**What it does:** Sample a field to modulate placement density
**Used for:** Forests avoid slopes; rocks clump near ridges, etc.
**Status:** ⬜ Not built

---

## Category 13: Search & Optimization (Generate→Evaluate→Revise)

> Infrastructure to simulate an artist’s iterative workflow.

### 13.1 Scoring / Objective Functions
**What it does:** Assign a numeric score + reasons to an output
**Used for:** “Find a good seed,” “match style,” “avoid awkward proportions”
**Status:** ⬜ Not built

### 13.2 Constraint Satisfaction as Optimization
**What it does:** Soft constraints with penalties
**Used for:** Layouts that can degrade gracefully (like chair-count reduction)
**Status:** ⬜ Not built

### 13.3 Search Drivers
**What it does:** Explore decision space across many runs
**Used for:** Automated refinement, agent-driven iteration
**Status:** ⬜ Not built
**Candidates:** hill-climbing, simulated annealing, evolutionary search

---

## Category 14: Grammars & History Simulation

> High-level generative systems beyond direct mesh operations.

### 14.1 Shape/Graph Grammars
**What it does:** Rewrite rules over graphs/regions rather than strings
**Used for:** Architectural facades, city growth, street networks
**Status:** ⬜ Not built

### 14.2 Erosion & Weathering (History)
**What it does:** Simulate time to get believable results
**Used for:** Terrain erosion, dirt accumulation, cracks, wear
**Status:** ⬜ Not built

---

## Category 15: Authoring UX Patterns

> How builders are created and edited.

### 15.1 Live Preview
**What it does:** Instant visualization of changes
**Used for:** Rapid iteration
**Status:** ✅ Built (Dashboard + WebSocket)

### 15.2 Seed Browsing
**What it does:** Quickly view different variations
**Used for:** Finding good outputs, testing ranges
**Status:** ✅ Built (prev/next/random in dashboard)

### 15.3 Parameter Sliders
**What it does:** Adjust measurements interactively
**Used for:** Tuning proportions
**Status:** ⬜ Not built (would need UI work)

### 15.4 Decision Overrides
**What it does:** Lock specific decisions
**Used for:** Testing specific configurations
**Status:** ✅ Built (overrides in builder.run)

### 15.5 Comparison View
**What it does:** Side-by-side output comparison
**Used for:** A/B testing, regression detection
**Status:** ⬜ Not built

### 15.6 Error Highlighting
**What it does:** Show errors in context
**Used for:** Debugging, fixing issues
**Status:** ⬜ Not built (errors are text only)

---

## Status Summary

### Built & Working (✅)
- Seeded RNG, weighted choice, range sampling
- Placement constraints
- Simple, parametric, placement-based composition
- Conditional + iterative composition (`if:` / `repeat:` in YAML compose)
- Math expressions
- Noise + coordinate seeding (Perlin 2D/3D, FBM, coordinateHash)
- All tracing types
- File storage, material library
- DSL, REST, WebSocket, MCP APIs
- Live preview, seed browsing, decision overrides

### Partially Built (🟡)
- Conditional decisions (counts only)
- Topology validation (check but not repair)
- Performance traces (counts, no timing)
- Schema versioning (no migration)
- Spatial indexing (AABB, no spatial tree)
- Constraint-based layout (placement only)

### Not Built - Authoring (⬜)
- Correlated decisions, decision trees
- Measurement, style, physical constraints
- Recursive composition, instancing
- Conditional expressions, list operations, custom functions
- Cloud storage, dependency tracking
- Export pipeline
- CSG, mesh repair
- Parameter sliders, comparison view, error highlighting

### Not Built - Patterns & Worlds (⬜)
- Voronoi diagrams, Poisson disk sampling
- L-Systems, Wave Function Collapse, cellular automata
- Field system (scalar/vector) + field composition
- Chunk management, lazy generation, LOD, seamless boundaries
- BSP room generation, graph-based mission structure, inside-out generation
- Search/optimization loops (scoring + search drivers)
- Shape/graph grammars, erosion/weathering

---

## Recommendations

### Immediate (High Value, Low Effort)
1. **Conditional expressions** (`if()` in math) - reduce YAML boilerplate
2. **Better error context** - YAML path + (eventually) line numbers
3. **Poisson disk sampling** - unlock natural scattering fast
4. **Scalar field abstraction** (thin wrapper around noise + composition)

### Medium Term (High Value, Medium Effort)
5. **Voronoi diagrams** - city blocks, cracked patterns
6. **Chunk contract** - start defining query-based world builders
7. **Instancing** - necessary once scenes grow

### Long Term (Architecture Changes)
8. **Lazy generation + LOD** - infinite/large worlds
9. **Search/optimization loop** - true “artist-like iteration”
10. **History simulation** (erosion/weathering) - “nature-like” believability

---

## Related Documents

- `AUTHORING_PROBLEM_DOMAIN.md` - What authors need to accomplish
- `AUTHORING_ALIGNMENT_MATRIX.md` - Feature prioritization
- `PROCEDURAL_TECHNIQUES.md` - Algorithm catalog
- `SCALE_AMBITION.md` - Large-scale architecture analysis
- `SOLUTION_DOMAIN.md` - Geometry tools (artist perspective)
- `DSL_COMMANDS.md` - Available commands

---

## Category 12: Agent Authoring Layer (NEW)

> **The Solution:** Provide a suite of tools that expose the system's capabilities, semantic structure, and validation feedback in a way that is discoverable and parsable by an AI agent. This layer translates the implicit structure of the procedural system into an explicit, queryable API.

### 12.1 Discoverability & Introspection
**What it does:** Allows an agent to ask the system what it can do.
**Problem Level:** Agent Authoring (What can I build?)
**Status:** ⬜ Not built
**DSL:**
- `system.list_builders()` -> `['DiningChair', 'Table', 'Mug']`
- `system.get_builder_interface('DiningChair')` ->
  ```json
  {
    "decisions": {
      "style": { "type": "enum", "values": ["modern", "rustic"] },
      "wood_type": { "type": "enum", "values": ["oak", "walnut"] }
    },
    "measurements": {
      "seat_height": { "type": "range", "min": 0.4, "max": 0.6, "default": 0.45 }
    }
  }
  ```
- `system.list_tools()` -> `['loft', 'sweep', 'subdivide', 'bevel']`

### 12.2 Semantic Scene Graph
**What it does:** Represents the output not just as a mesh, but as a meaningful hierarchy of named, tagged parts.
**Problem Level:** Agent Authoring (What did I just build?)
**Status:** ⬜ Not built (traces are a partial, unstructured solution)
**DSL:**
- Builder output includes a `sceneGraph` property.
- `DiningScene` output:
  ```json
  {
    "sceneGraph": {
      "name": "DiningScene", "uuid": "...", "tag": "scene",
      "children": [
        { "name": "Table-1", "uuid": "...", "tag": "container", "builder": "Table" },
        { "name": "Chair-1", "uuid": "...", "tag": "seating", "builder": "DiningChair" },
        { "name": "Chair-2", "uuid": "...", "tag": "seating", "builder": "DiningChair" }
      ]
    }
  }
  ```
- **Query DSL:**
  - `scene.query_by_tag('seating')` -> Returns nodes for Chair-1 and Chair-2.
  - `scene.get_part_by_name('Table-1')` -> Returns the table node.

### 12.3 Queryable Validation & Metrics
**What it does:** Provides structured, machine-readable feedback on the quality of the generated asset.
**Problem Level:** Agent Authoring (Is it any good?)
**Status:** 🔧 Partially built (validation traces exist but are not structured for agent consumption)
**DSL:**
- `builder.validate()` runs all checks.
- `validation.get_results()` returns a structured array:
  ```json
  [
    {
      "check": "Stability",
      "status": "fail",
      "severity": "error",
      "message": "Center of mass is outside support polygon by 15%.",
      "data": { "com": [0.1, 0.5, -0.2], "support_poly": [...] }
    },
    {
      "check": "Ergonomics",
      "status": "pass",
      "severity": "info",
      "message": "Seat height is within standard range.",
      "data": { "metric": "seat_height", "value": 0.45, "range": [0.4, 0.5] }
    },
    {
      "check": "Aesthetics",
      "status": "warning",
      "severity": "warning",
      "message": "Color contrast on backrest is low.",
      "data": { "contrast_ratio": 1.5, "threshold": 2.0 }
    }
  ]
  ```

### 12.4 Goal-Seeking & Constraint-Based Commands
**What it does:** Exposes high-level, intent-driven commands that the system can solve, freeing the agent from low-level calculations.
**Problem Level:** Agent Authoring (How do I achieve a goal?)
**Status:** 🔧 Partially built (`Placement` API is a good starting point)
**DSL:**
- **`scene.place_around(target, items, options)`**:
  - `scene.place_around('Table-1', 'DiningChair', { count: 4, spacing: 0.5 })`
- **`scene.scatter_on(surface_tag, items, options)`**:
  - `scene.scatter_on('table_surface', 'Mug', { density: 0.3, collision: true })`
- **`scene.align(...)`**, **`scene.distribute(...)`**

### 12.5 Semantic Material & Geometry Queries
**What it does:** Allows an agent to query properties of the final generated mesh using semantic tags.
**Problem Level:** Agent Authoring (What did I build? Is it good?)
**Status:** ⬜ Not built
**DSL:**
- `mesh.get_bounds_of_tag('leg')` -> Returns the combined AABB of all parts tagged 'leg'.
- `mesh.get_surface_area_of_material('wood')` -> Returns total area for cost estimation.
- `mesh.check_clearance('drawer_path', 0.1)` -> Checks if a defined path is clear of other geometry.

---

## Category 13: Asset Analysis & Import

> **Reference:** See `ASSET_ANALYSIS_SYSTEM.md` for detailed architecture

Intelligent import and parametrization of external vector graphics and 3D assets. Rather than simple 1:1 conversion, these tools **analyze** assets to extract semantic information and generate parametric builders.

### 13.1 Geometric Analysis
**What it does:** Extract structural properties from external assets (SVG, fonts, 3D models)
**Used for:** Understanding asset structure, identifying parametrization opportunities
**Status:** ⬜ Not built (Phase 3/Optional)
**Components:**
- **Symmetry Detection** - Find reflection/rotational symmetry axes
- **Proportion Extraction** - Identify dimensional relationships (aspect ratios, golden ratio)
- **Curve Analysis** - Parametrize bezier curves as mathematical expressions
- **Topology Analysis** - Identify connected components, holes, boundaries

**Example Output:**
```typescript
{
  symmetry: {
    vertical: { axis: 0, confidence: 0.95 },
    rotational: { order: 5, center: [0, 0], confidence: 0.88 }
  },
  proportions: {
    aspectRatio: 0.92,
    relationships: [
      { param1: "height", param2: "width", ratio: 0.92, confidence: 0.99 }
    ]
  }
}
```

### 13.2 Semantic Analysis
**What it does:** Understand the **meaning** of shapes, not just their geometry
**Used for:** Auto-tagging, categorization, intelligent organization
**Status:** ⬜ Not built (Phase 3/Optional)
**Components:**
- **Shape Classification** - Categorize as icon/pattern/ornament/text/abstract
- **Tag Generation** - Auto-generate semantic tags from shape + filename
- **Hierarchy Extraction** - Detect grouped/nested elements for composition
- **Context Understanding** - Infer purpose from collection (e.g., UI icons vs decorative)

**Example:**
- Input: `heart-icon.svg` with symmetric curved shape
- Output: `{ category: 'icon', tags: ['heart', 'love', 'emotion', 'symmetric', 'curved'] }`

### 13.3 Variation Detection (Batch Learning)
**What it does:** Analyze multiple similar assets to identify variations and generate parametric decisions
**Used for:** Batch import of icon families, pattern collections
**Status:** ⬜ Not built (Phase 3/Optional)
**Algorithm:**
1. Align all assets (normalize scale, rotation, position)
2. Find point correspondence across variants
3. Cluster variations into discrete styles
4. Extract delta vectors for each variation
5. Generate parametric builder with style decisions

**Example:**
- Input: `heart-rounded.svg`, `heart-sharp.svg`, `heart-modern.svg`
- Output: One `Heart.yaml` builder with `style: [rounded, sharp, modern]` decision

### 13.4 Parametrization Engine
**What it does:** Convert static coordinates → mathematical expressions with decisions/measurements
**Used for:** Generating builders (not just static shapes) from external assets
**Status:** ⬜ Not built (Phase 3/Optional)
**Strategies:**
- **Dimension-based:** `x: 10` → `x: "width * 0.5"`
- **Symmetry-based:** Use detected axes: `x: -5` → `x: "-right_x"`
- **Relationship-based:** Use proportions: `height: 18` → `height: "width * 0.92"`
- **Variation-based:** Use detected variations: multiple curves → `curve_factor` decision

**Example Builder Generation:**
```yaml
# Auto-generated from SVG analysis
name: Heart
description: "Detected: symmetric heart shape with smooth curves"

decisions:
  style:
    type: choice
    options: [rounded, sharp, modern]
    # DETECTED: 3 variants in batch

measurements:
  width:
    value: 0.1
    # DETECTED: Normalized from SVG viewBox

derived:
  height: "width * 0.92"  # DETECTED: Aspect ratio
  half_width: "width / 2"  # DETECTED: Vertical symmetry

shapes:
  heart_outline:
    type: polygon
    points:
      # PARAMETRIZED from analyzed control points
      - { x: 0, z: "-height * 0.3" }
      - { x: "half_width * 0.9", z: "height * 0.15" }
      # ...
```

### 13.5 Format Adapters
**What it does:** Parse various external asset formats
**Used for:** Importing from design tools, asset libraries, CAD
**Status:** 🟡 Partial (fonts via opentype.js)
**Formats:**
- ✅ **TrueType/OpenType Fonts** - via `FontParser.ts`
- ⬜ **SVG** - Path data → polygons (P2M4-Ext-003, simple version planned)
- ⬜ **DXF/DWG** - CAD drawings → builders
- ⬜ **glTF** - 3D models → mesh builders
- ⬜ **OBJ** - Simple 3D format
- ⬜ **JSON Vector Data** - Custom formats

### 13.6 CLI Tool: Asset Analyzer
**What it does:** Command-line tool for batch import and analysis
**Used for:** Processing asset libraries, batch conversion
**Status:** ⬜ Not built (Phase 3/Optional)
**Commands:**
```bash
# Analyze single asset
procedurable analyze heart.svg --output builders/icons/Heart.yaml

# Batch analysis (learns variations)
procedurable analyze-batch icons/*.svg --output builders/icons/

# Options
--smart              # Enable intelligent parametrization
--symmetry           # Detect and use symmetry
--variations         # Look for variations in batch
--tags               # Auto-generate tags
--lod                # Generate LOD levels
```

### 13.7 Integration Strategy
**What it does:** Fit asset import into existing builder workflow
**Used for:** Seamless external asset usage
**Status:** 🟡 Conceptual
**Approaches:**
- **Builder Generation** - Assets → YAML builders (recommended, most flexible)
- **Runtime Loading** - Assets → runtime library (faster, less flexible)
- **Hybrid** - Common assets preloaded, custom assets generated

**Priority:** Optional/Future (Phase 3)
- Implement after P2-M4 base features complete
- Most valuable when users import large asset libraries
- Simple SVG import (P2M4-Ext-003) covers basic needs

---

## Summary Table

