# Authoring Alignment Matrix

> Maps authoring challenges to required tools/features, helping prioritize infrastructure work.

This matrix shows which **authoring features** are needed for different **builder complexity levels** and **use cases**.

---

## Matrix: Builder Levels × Authoring Features

| Feature | L1 Simple | L2 Variable | L3 Composed | L4 Scene | L5 Recursive | L6 Simulation | L7 World |
|---------|:---------:|:-----------:|:-----------:|:--------:|:------------:|:-------------:|:--------:|
| **Status** | | | | | | | |
| | | | | | | | |
| **DECISION SYSTEMS** | | | | | | | |
| Seeded RNG | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • |
| Weighted Choice | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • |
| Range Sampling | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • |
| Conditional Decisions |  | 🟡 • | 🟡 • | 🟡 • | ⬜ • | ⬜ • | ⬜ • |
| Correlated Decisions |  | ⬜ ○ | ⬜ ○ | ⬜ • | ⬜ • | ⬜ • | ⬜ • |
| Decision Trees |  |  | ⬜ ○ | ⬜ ○ | ⬜ • | ⬜ • | ⬜ • |
| | | | | | | | |
| **CONSTRAINT SYSTEMS** | | | | | | | |
| Spatial Placement |  |  |  | ✅ • | ✅ • | ✅ • | ✅ • |
| Measurement Constraints |  | ⬜ ○ | ⬜ • | ⬜ • | ⬜ • | ⬜ • | ⬜ • |
| Topology Validation | ✅ ○ | ✅ ○ | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • |
| Style Constraints |  |  | 🟡 ○ | 🟡 • | 🟡 • | 🟡 • | 🟡 • |
| Physical Constraints |  |  |  | ⬜ ○ | ⬜ ○ | ⬜ • | ⬜ • |
| | | | | | | | |
| **COMPOSITION** | | | | | | | |
| Simple Compose |  |  | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • |
| Parametric Compose |  |  | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • |
| Iterative/Repeat |  |  | ✅ ○ | ✅ • | ✅ • | ✅ • | ✅ • |
| Conditional Compose |  | ✅ ○ | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • |
| Placement-Based |  |  |  | ✅ • | ✅ • | ✅ • | ✅ • |
| Recursive Compose |  |  |  |  | ⬜ • | ⬜ • | ⬜ • |
| Instancing |  |  | ⬜ ○ | ⬜ • | ⬜ • | ⬜ • | ⬜ • |
| | | | | | | | |
| **EXPRESSIONS** | | | | | | | |
| Math Expressions | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • |
| Conditional Expressions |  | ⬜ ○ | ⬜ • | ⬜ • | ⬜ • | ⬜ • | ⬜ • |
| String Interpolation |  | 🟡 ○ | 🟡 ○ | 🟡 ○ | 🟡 • | 🟡 • | 🟡 • |
| List Operations |  |  |  | ⬜ ○ | ⬜ • | ⬜ • | ⬜ • |
| | | | | | | | |
| **FIELDS & PATTERNS** | | | | | | | |
| Noise (Perlin/FBM) |  | ✅ ○ | ✅ ○ | ✅ • | ✅ • | ✅ • | ✅ • |
| Coordinate-based seeding |  |  |  | ✅ ○ | ✅ • | ✅ • | ✅ • |
| Scalar/Vector Fields |  |  |  | ⬜ ○ | ⬜ • | ⬜ • | ⬜ • |
| Masked scattering |  |  |  | ⬜ ○ | ⬜ • | ⬜ • | ⬜ • |
| | | | | | | | |
| **SEARCH / ITERATION** | | | | | | | |
| Scoring / Objective functions |  |  | ⬜ ○ | ⬜ • | ⬜ • | ✅ • | ✅ • |
| Search drivers (multi-run) |  |  | ⬜ ○ | ⬜ • | ⬜ • | ✅ • | ✅ • |
| | | | | | | | |
| **FIELDS & WORLD** | | | | | | | |
| Field composition |  |  |  | ⬜ ○ | ⬜ • | ⬜ • | ⬜ • |
| Poisson disk sampling |  |  |  | ⬜ ○ | ⬜ • | ⬜ • | ⬜ • |
| Instancing representation |  |  | ⬜ ○ | ⬜ • | ⬜ • | ⬜ • | ⬜ • |
| Chunk contract |  |  |  |  | ⬜ ○ | ⬜ • | ⬜ • |
| | | | | | | | |
| **TRACING** | | | | | | | |
| Decision Traces | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • |
| Measurement Traces | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • |
| Geometry Traces | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • |
| Composition Traces |  |  | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • |
| Validation Traces | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • |
| | | | | | | | |
| **STORAGE/API** | | | | | | | |
| File Storage | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • |
| DSL Commands | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • |
| MCP Protocol | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • |
| Export Pipeline | ⬜ ○ | ⬜ ○ | ⬜ • | ⬜ • | ⬜ • | ⬜ • | ⬜ • |
| Chunk/Streaming contract |  |  |  |  | ⬜ ○ | ⬜ • | ⬜ • |

**Legend:**
- ✅ = Built, 🟡 = Partial, ⬜ = Not built
- • = Required for this level
- ○ = Optional/Nice-to-have for this level

---

## Matrix: Use Cases × Authoring Features

| Feature | Agent Authoring | Human Authoring | Runtime Gen | Batch Export | Streaming Worlds |
|---------|:---------------:|:---------------:|:-----------:|:------------:|:---------------:|
| **Status** | | | | | |
| | | | | | |
| **CRITICAL** | | | | | |
| Bulk Commands | ✅ • | ✅ ○ | ✅ • | ✅ • | ✅ • |
| Clear Error Messages | 🟡 • | 🟡 • | 🟡 ○ | 🟡 • | 🟡 • |
| Deterministic Seeding | ✅ • | ✅ • | ✅ • | ✅ • | ✅ • |
| Coordinate-based seeding |  |  | ✅ ○ | ✅ ○ | ✅ • |
| Query-based generation |  |  | ⬜ ○ | ⬜ ○ | ⬜ • |
| | | | | | |
| **HIGH VALUE** | | | | | |
| Hot Reload | ⬜ ○ | 🟡 • | ⬜  | ⬜  | ⬜  |
| Live Preview | ⬜  | ✅ • | ⬜  | ⬜  | ⬜  |
| YAML DSL | ✅ • | ✅ • | ✅ ○ | ✅ • | ✅ • |
| TypeScript API | ✅ ○ | ✅ • | ✅ • | ✅ • | ✅ • |
| Fields (scalar/vector) | ⬜ ○ | ⬜ ○ | ⬜ • | ⬜ ○ | ⬜ • |
| Instancing | ⬜ ○ | ⬜ ○ | ⬜ • | ⬜ • | ⬜ • |
| | | | | | |
| **MEDIUM VALUE** | | | | | |
| Comparison View | ⬜ ○ | ⬜ • | ⬜  | ⬜  | ⬜  |
| Parameter Sliders | ⬜  | ⬜ • | ⬜  | ⬜  | ⬜  |
| Builder Templates | ⬜ • | ⬜ • | ⬜  | ⬜  | ⬜  |
| Dependency Tracking | ⬜ ○ | ⬜ ○ | ⬜  | ⬜ • | ⬜ • |
| | | | | | |
| **LOWER PRIORITY** | | | | | |
| Cloud Storage | ⬜ ○ | ⬜ ○ | ⬜ • | ⬜ • | ⬜ • |
| Collaboration | ⬜  | ⬜ ○ | ⬜  | ⬜  | ⬜  |
| Version History | ⬜ ○ | ⬜ ○ | ⬜  | ⬜ ○ | ⬜ ○ |

---

## Feature Priority Scoring (Updated)

### Tier 1: Critical Path

| Feature | Status | Blocks | Effort |
|---------|--------|--------|--------|
| **Better Error Context** (YAML path + line numbers) | 🟡 | All authoring | M |
| **Conditional Expressions** (`if()` in math) | ⬜ | Derived values everywhere | S |
| **Instancing** | ⬜ | Big scenes, batching | M |
| **Export Pipeline** (glTF at minimum) | ⬜ | All real-world use | L |

### Tier 1b: “World Foundations” (if worlds are a near-term ambition)

| Feature | Status | Blocks | Effort |
|---------|--------|--------|--------|
| **Scalar Field Abstraction** (thin wrapper over noise + composition) | ⬜ | Terrain/biomes/scatter | M |
| **Poisson Disk Sampling** | ⬜ | Natural scattering | S |
| **Chunk Contract** (query-based generation API) | ⬜ | Streaming worlds | M |

### Tier 2: High Value

| Feature | Status | Enables | Effort |
|---------|--------|---------|--------|
| Measurement Constraints (A < B validation) | ⬜ | Guaranteed valid output | M |
| Mesh Repair (auto-fix issues) | ⬜ | CSG, complex geometry | L |
| Decision Trees | ⬜ | Complex style systems | M |
| Scoring + search drivers | ⬜ | “artist iteration loop” | M |

---

## Related Documents

- `AUTHORING_PROBLEM_DOMAIN.md` - What authors need to accomplish
- `AUTHORING_SOLUTION_DOMAIN.md` - Available tools and algorithms
- `MASTER_PLAN.md` - Overall milestone planning
- `ALIGNMENT_MATRIX.md` - Geometry tools alignment (artist perspective)

