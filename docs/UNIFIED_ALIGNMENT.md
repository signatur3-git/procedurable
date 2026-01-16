# Unified Alignment Matrix

> **Purpose:** Single source of truth for Builder × Tool mappings.
> Combines artist perspective (geometry tools) and programmer perspective (authoring features).

---

## Section 1: Builders × Geometry Tools

> Which geometry tools are required/optional for each target builder?

### Legend

- ✅ Tool built AND exposed via DSL
- 🔧 Tool built but NOT exposed via DSL
- ⬜ Tool not built
- • = Required for this builder
- ○ = Optional/enhances this builder

### Matrix

| Builder          | Loft | Lathe | Sweep | Spline | Subdiv | 2D Shapes | 2D Bool | CSG 3D | Materials | L-System | Constraints | UVs | Bevel | Deformers | Export |
|------------------|:----:|:-----:|:-----:|:------:|:------:|:---------:|:-------:|:------:|:---------:|:--------:|:-----------:|:---:|:-----:|:---------:|:------:|
| **Status**       |  ✅   |   ✅   |   ✅   |   ✅    |   ✅    |     ⬜     |    ⬜    |   ⬜    |     ✅     |    ⬜     |      ✅      |  ⬜  |   ⬜   |     ⬜     |   ⬜    |
|                  |      |       |       |        |        |           |         |        |           |          |             |     |       |           |        |
| **FURNITURE**    |      |       |       |        |        |           |         |        |           |          |             |     |       |           |        |
| DiningChair      |  •   |       |       |        |        |           |         |        |     •     |          |      •      |  ○  |   ○   |           |   ○    |
| Table            |  •   |       |       |        |        |           |         |        |     •     |          |      •      |  ○  |   ○   |           |   ○    |
| Bookshelf        |  •   |       |       |        |        |           |         |        |     •     |          |      ○      |  ○  |   ○   |           |   ○    |
| Desk             |  •   |       |       |        |        |           |         |   ○    |     •     |          |      ○      |  ○  |   •   |           |   ○    |
| Bed              |  •   |       |       |        |   ○    |           |         |        |     •     |    ○     |      ○      |  ○  |       |     ○     |   ○    |
| Sofa             |  •   |       |       |        |   •    |           |         |        |     •     |          |      ○      |  ○  |       |     •     |   ○    |
|                  |      |       |       |        |        |           |         |        |           |          |             |     |       |           |        |
| **VESSELS**      |      |       |       |        |        |           |         |        |           |          |             |     |       |           |        |
| Vase             |      |   •   |       |   •    |        |           |         |        |     •     |          |             |  ○  |       |           |   ○    |
| Bottle           |      |   •   |       |   •    |        |           |         |        |     •     |          |             |  ○  |       |           |   ○    |
| Bowl/Cup/Mug     |      |   •   |   •   |   •    |        |           |         |        |     •     |          |             |  ○  |       |           |   ○    |
|                  |      |       |       |        |        |           |         |        |           |          |             |     |       |           |        |
| **ARCHITECTURE** |      |       |       |        |        |           |         |        |           |          |             |     |       |           |        |
| Simple Room      |      |       |       |        |        |     •     |         |   •    |     •     |          |      •      |  ○  |   •   |           |   ○    |
| Door             |      |       |       |        |        |     •     |    •    |   •    |     •     |          |      ○      |  ○  |   •   |           |   ○    |
| Window           |      |       |       |        |        |     •     |         |   •    |     •     |          |      ○      |  ○  |   •   |           |   ○    |
| Staircase        |  •   |       |   •   |   •    |        |           |         |        |     •     |          |      •      |  ○  |   •   |           |   ○    |
|                  |      |       |       |        |        |           |         |        |           |          |             |     |       |           |        |
| **BOTANICAL**    |      |       |       |        |        |           |         |        |           |          |             |     |       |           |        |
| Simple Tree      |      |       |   •   |   •    |        |           |         |        |     •     |    •     |      ○      |     |       |     ○     |   ○    |
| Potted Plant     |      |   •   |   •   |   •    |        |           |         |        |     •     |    ○     |      ○      |  ○  |       |     ○     |   ○    |
| Flower           |      |       |   •   |        |        |           |         |        |     •     |          |      ○      |     |       |     ○     |   ○    |
|                  |      |       |       |        |        |           |         |        |           |          |             |     |       |           |        |
| **MECHANICAL**   |      |       |       |        |        |           |         |        |           |          |             |     |       |           |        |
| Gear             |      |       |       |        |        |     •     |    •    |        |     •     |          |      ○      |  ○  |   •   |           |   ○    |
| Pipe Assembly    |      |       |   •   |   •    |        |           |         |        |     •     |          |      •      |  ○  |   ○   |           |   ○    |
|                  |      |       |       |        |        |           |         |        |           |          |             |     |       |           |        |
| **SIGNAGE**      |      |       |       |        |        |           |         |        |           |          |             |     |       |           |        |
| Wall Sign        |      |       |       |        |        |     •     |    •    |   ○    |     •     |          |      ○      |  •  |   •   |           |   ○    |
| Standing Sign    |  •   |       |       |        |        |     •     |    •    |        |     •     |          |      ○      |  •  |   •   |           |   ○    |
|                  |      |       |       |        |        |           |         |        |           |          |             |     |       |           |        |
| **CLOTHING**     |      |       |       |        |        |           |         |        |           |          |             |     |       |           |        |
| T-Shirt          |      |       |       |        |        |     •     |         |        |     •     |          |      •      |  ○  |       |     •     |   ○    |
| Pants            |      |       |       |        |        |     •     |         |        |     •     |          |      •      |  ○  |       |     •     |   ○    |
| Hat              |      |   •   |       |        |   •    |           |         |        |     •     |          |      ○      |  ○  |       |     ○     |   ○    |
|                  |      |       |       |        |        |           |         |        |           |          |             |     |       |           |        |
| **CHARACTERS**   |      |       |       |        |        |           |         |        |           |          |             |     |       |           |        |
| Stylized Char    |      |       |       |        |   •    |           |         |        |     •     |          |      ○      |  ○  |       |     ○     |   ○    |
| Person           |  •   |       |   •   |   •    |   •    |           |         |        |     •     |          |      •      |  •  |   •   |     ○     |   •    |
| Animal           |      |       |   •   |   •    |   •    |           |         |        |     •     |          |      •      |  ○  |       |     ○     |   •    |
|                  |      |       |       |        |        |           |         |        |           |          |             |     |       |           |        |
| **ENVIRONMENTS** |      |       |       |        |        |           |         |        |           |          |             |     |       |           |        |
| Room Layout      |      |       |       |        |        |     •     |         |   •    |     •     |          |      •      |  ○  |   •   |           |   ○    |
| WorldSlice       |      |       |       |        |        |           |         |        |     •     |          |      •      |     |       |           |   ○    |

---

## Section 2: Builder Levels × Authoring Features

> Which authoring features are required at each builder complexity level?

### Builder Complexity Levels

- **L1 Simple:** Single object, few decisions (Vase)
- **L2 Variable:** Many decision axes (DiningChair)
- **L3 Composed:** Multiple sub-builders (DiningScene)
- **L4 Scene:** Full room/environment
- **L5 Recursive:** Self-referencing (Tree branches)
- **L6 Simulation:** Search/optimization (room packing)
- **L7 World:** Infinite, chunk-based

### Legend

- ✅ = Built
- 🟡 = Partial
- ⬜ = Not built
- • = Required for this level
- ○ = Optional/Nice-to-have

### Matrix

| Feature                 | L1 | L2  | L3  | L4  | L5  | L6  | L7  |
|-------------------------|:--:|:---:|:---:|:---:|:---:|:---:|:---:|
| **DECISION SYSTEMS**    |    |     |     |     |     |     |     |
| Seeded RNG              | ✅• | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  |
| Weighted Choice         | ✅• | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  |
| Range Sampling          | ✅• | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  |
| Conditional Decisions   |    | 🟡• | 🟡• | 🟡• | ⬜•  | ⬜•  | ⬜•  |
| Correlated Decisions    |    | ⬜○  | ⬜○  | ⬜•  | ⬜•  | ⬜•  | ⬜•  |
| Decision Trees          |    |     | ⬜○  | ⬜○  | ⬜•  | ⬜•  | ⬜•  |
|                         |    |     |     |     |     |     |     |
| **CONSTRAINT SYSTEMS**  |    |     |     |     |     |     |     |
| Spatial Placement       |    |     |     | ✅•  | ✅•  | ✅•  | ✅•  |
| Measurement Constraints |    | ⬜○  | ⬜•  | ⬜•  | ⬜•  | ⬜•  | ⬜•  |
| Topology Validation     | ✅○ | ✅○  | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  |
| Style Constraints       |    |     | 🟡○ | 🟡• | 🟡• | 🟡• | 🟡• |
| Physical Constraints    |    |     |     | ⬜○  | ⬜○  | ⬜•  | ⬜•  |
|                         |    |     |     |     |     |     |     |
| **COMPOSITION**         |    |     |     |     |     |     |     |
| Simple Compose          |    |     | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  |
| Parametric Compose      |    |     | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  |
| Iterative/Repeat        |    |     | ✅○  | ✅•  | ✅•  | ✅•  | ✅•  |
| Conditional Compose     |    | ✅○  | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  |
| Recursive Compose       |    |     |     |     | ⬜•  | ⬜•  | ⬜•  |
| Instancing              |    |     | ⬜○  | ⬜•  | ⬜•  | ⬜•  | ⬜•  |
|                         |    |     |     |     |     |     |     |
| **EXPRESSIONS**         |    |     |     |     |     |     |     |
| Math Expressions        | ✅• | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  |
| Conditional Expressions |    | ⬜○  | ⬜•  | ⬜•  | ⬜•  | ⬜•  | ⬜•  |
| String Interpolation    |    | 🟡○ | 🟡○ | 🟡○ | 🟡• | 🟡• | 🟡• |
| List Operations         |    |     |     | ⬜○  | ⬜•  | ⬜•  | ⬜•  |
|                         |    |     |     |     |     |     |     |
| **FIELDS & PATTERNS**   |    |     |     |     |     |     |     |
| Noise (Perlin/FBM)      |    | ✅○  | ✅○  | ✅•  | ✅•  | ✅•  | ✅•  |
| Coordinate Seeding      |    |     |     | ✅○  | ✅•  | ✅•  | ✅•  |
| Scalar/Vector Fields    |    |     |     | ⬜○  | ⬜•  | ⬜•  | ⬜•  |
| Poisson Scatter         |    |     |     | ⬜○  | ⬜•  | ⬜•  | ⬜•  |
|                         |    |     |     |     |     |     |     |
| **SEARCH/ITERATION**    |    |     |     |     |     |     |     |
| Scoring Functions       |    |     | ⬜○  | ⬜•  | ⬜•  | ✅•  | ✅•  |
| Search Drivers          |    |     | ⬜○  | ⬜•  | ⬜•  | ✅•  | ✅•  |
|                         |    |     |     |     |     |     |     |
| **WORLD SYSTEMS**       |    |     |     |     |     |     |     |
| Chunk Contract          |    |     |     |     | ⬜○  | ⬜•  | ⬜•  |
| LOD System              |    |     |     | ⬜○  | ⬜○  | ⬜•  | ⬜•  |
|                         |    |     |     |     |     |     |     |
| **TRACING**             |    |     |     |     |     |     |     |
| Decision Traces         | ✅• | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  |
| Geometry Traces         | ✅• | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  |
| Validation Traces       | ✅• | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  |
|                         |    |     |     |     |     |     |     |
| **STORAGE/API**         |    |     |     |     |     |     |     |
| File Storage            | ✅• | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  |
| DSL Commands            | ✅• | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  |
| MCP Protocol            | ✅• | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  | ✅•  |
| Export Pipeline         | ⬜○ | ⬜○  | ⬜•  | ⬜•  | ⬜•  | ⬜•  | ⬜•  |

---

## Section 3: Tool Priority Analysis

### Current Tool Status Summary

| Tool                  | Status | Phase | Builders Unlocked                |
|-----------------------|--------|-------|----------------------------------|
| Loft                  | ✅      | 1     | Furniture, architecture          |
| Lathe                 | ✅      | 1     | Vessels                          |
| Sweep                 | ✅      | 1     | Handles, pipes, botanical        |
| Spline                | ✅      | 1     | Used by sweep/lathe              |
| Subdivision           | ✅      | 1     | Organic shapes                   |
| Materials (basic)     | ✅      | 2     | All builders enhanced            |
| Constraints/Placement | ✅      | 2     | Scene quality                    |
| 2D Shapes             | ⬜      | 2     | Gears, signs, moldings, clothing |
| 2D Boolean            | ⬜      | 2     | Text holes, complex profiles     |
| CSG 3D                | ⬜      | 2     | Architecture openings            |
| UVs                   | ⬜      | 2     | All production assets            |
| Bevel/Normals         | ⬜      | 2     | Hard-surface quality             |
| Deformers             | ⬜      | 2     | Soft goods, realism              |
| L-System              | ⬜      | 2     | Botanical                        |
| Export (glTF)         | ⬜      | 2     | Deployment                       |
| Instancing            | ⬜      | 2     | Large scenes                     |
| Fields                | ⬜      | 2     | World-scale                      |

### High-Impact Next Steps

1. **2D Shapes** - Biggest breadth unlock (gears, signage, moldings, clothing patterns)
2. **Export (glTF)** - Required for any real-world use
3. **Instancing** - Required for large scenes, performance
4. **Conditional Expressions** - Small effort, unblocks complex derived values

---

## Section 4: Use Cases × Features

### Use Case Definitions

- **Agent Authoring:** AI agent creates/modifies builders
- **Human Authoring:** Developer creates builders manually
- **Runtime Gen:** Generate content in-game/in-app
- **Batch Export:** Generate assets for external use
- **Streaming Worlds:** Infinite world generation

### Matrix

| Feature               | Agent | Human | Runtime | Batch | Streaming |
|-----------------------|:-----:|:-----:|:-------:|:-----:|:---------:|
| **CRITICAL**          |       |       |         |       |           |
| Bulk Commands         |  ✅•   |  ✅○   |   ✅•    |  ✅•   |    ✅•     |
| Clear Errors          |  🟡•  |  🟡•  |   🟡○   |  🟡•  |    🟡•    |
| Deterministic Seeding |  ✅•   |  ✅•   |   ✅•    |  ✅•   |    ✅•     |
| Coordinate Seeding    |       |       |   ✅○    |  ✅○   |    ✅•     |
|                       |       |       |         |       |           |
| **HIGH VALUE**        |       |       |         |       |           |
| Hot Reload            |  ⬜○   |  🟡•  |    ⬜    |   ⬜   |     ⬜     |
| Live Preview          |   ⬜   |  ✅•   |    ⬜    |   ⬜   |     ⬜     |
| YAML DSL              |  ✅•   |  ✅•   |   ✅○    |  ✅•   |    ✅•     |
| TypeScript API        |  ✅○   |  ✅•   |   ✅•    |  ✅•   |    ✅•     |
| Instancing            |  ⬜○   |  ⬜○   |   ⬜•    |  ⬜•   |    ⬜•     |
|                       |       |       |         |       |           |
| **MEDIUM VALUE**      |       |       |         |       |           |
| Comparison View       |  ⬜○   |  ⬜•   |    ⬜    |   ⬜   |     ⬜     |
| Builder Templates     |  ⬜•   |  ⬜•   |    ⬜    |   ⬜   |     ⬜     |
| Dependency Tracking   |  ⬜○   |  ⬜○   |    ⬜    |  ⬜•   |    ⬜•     |

---

## Related Documents

- `MASTER_PLAN.md` - Overall strategy and phases
- `BACKLOG.md` - Detailed work items and stories
- `PROBLEM_DOMAIN.md` - Target builders (artist perspective)
- `SOLUTION_DOMAIN.md` - Tool inventory (artist perspective)
- `AUTHORING_PROBLEM_DOMAIN.md` - Authoring challenges (programmer perspective)
- `AUTHORING_SOLUTION_DOMAIN.md` - Authoring tools (programmer perspective)

