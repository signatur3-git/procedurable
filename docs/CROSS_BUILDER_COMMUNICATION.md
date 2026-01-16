# Cross-Builder Communication: Current State & Future Needs

## Question
How can parent builders pass context to child builders beyond simple overrides? Examples:
- Pose constraints (e.g., "chair must face table")
- Bounding box constraints (e.g., "fit within this space")
- Style themes (e.g., "all furniture should be modern")
- Physical constraints (e.g., "weight budget", "height limits")

This is analogous to Vue.js component communication where stores/provide-inject enable cross-component state.

---

## Current Capabilities ✅

### 1. Decision Overrides (Works Today)
**Mechanism:** `$variable` references in YAML compose blocks

```yaml
# DiningScene.yaml
decisions:
  table_style:
    type: choice
    options: [rectangular, round]
  
  wood_type:
    type: choice
    options: [oak, walnut, maple]

compose:
  table:
    builder: Table
    offset: { x: 0, y: 0, z: 0 }
    overrides:
      table_style: $table_style  # Pass parent decision to child
      wood_type: $wood_type       # Propagate material choice
```

**How it works:**
- Parent decisions and measurements can be passed via `$name` syntax
- Child builder receives these as decision overrides
- Child's randomness is constrained by parent's choices

**Limitations:**
- ❌ One-way only (parent → child)
- ❌ No sibling communication (chair1 can't see chair2's position)
- ❌ No constraint negotiation (child can't reject parent's request)
- ❌ String-based references only (no complex objects)

---

### 2. Measurement Expressions (Works Today)
**Mechanism:** Parent can compute values from decisions and pass them

```yaml
# Parent builder
decisions:
  chair_count: 
    type: count
    min: 2
    max: 6

measurements:
  table_width: 1.2

derived:
  spacing: "table_width / chair_count"  # Compute spacing

compose:
  chair_1:
    builder: Chair
    offset: { x: "spacing * 0", y: 0, z: 0 }
    overrides:
      target_width: $spacing  # Pass computed constraint
```

**Limitations:**
- ❌ Static at composition time (can't adapt based on child's output)
- ❌ No feedback loop (child can't report "I need more space")

---

### 3. Placement System (Works Today)
**Mechanism:** Automatic positioning with collision avoidance

```yaml
placement:
  builder: Chair
  count: 6
  mode: rectangle  # or circle
  bounds: { width: 2.0, depth: 2.0 }
  minDistance: 0.1
  overrides:
    style: $chair_style
```

**What it provides:**
- ✅ Automatic non-overlapping placement
- ✅ Uses child's AABB for collision detection
- ✅ Rotation toward center (for circle mode)

**Limitations:**
- ❌ No "pose" concept (just position + rotation)
- ❌ Can't enforce "chair must face table"
- ❌ Child doesn't know about siblings
- ❌ No adaptive spacing (fixed minDistance)

---

### 4. Composition Traces (Works Today)
**Mechanism:** After building, parent can inspect child's output

```typescript
// In TypeScript API
const output = builder.build();
const chairMeasurements = output.measurements.get('chair_1.seat_height');
const chairDecisions = output.decisions.get('chair_1.leg_style');
```

**Limitations:**
- ❌ Read-only after the fact
- ❌ Can't use for real-time negotiation
- ❌ Not accessible during composition

---

## What We're Missing ❌

### 1. Constraint Context (Not Built)
**Need:** Pass rich constraint objects to children

```yaml
# DESIRED: Not yet implemented
compose:
  chair_1:
    builder: Chair
    constraints:
      pose:
        facing: table  # Semantic constraint
        angle_tolerance: 15  # degrees
      bounds:
        max_height: 1.0  # Must fit under table overhang
        footprint: { width: 0.5, depth: 0.5 }
      style:
        theme: modern
        color_palette: [wood_oak, metal_steel]
```

**Why it matters:**
- Enables semantic relationships ("face the table")
- Allows negotiation (child can report "can't satisfy")
- Supports complex multi-builder coordination

---

### 2. Shared Context Store (Not Built)
**Analogy:** Like Vuex/Pinia for Vue components

```yaml
# DESIRED: Not yet implemented
# Scene-level shared state
context:
  theme:
    style: modern
    primary_wood: oak
    accent_metal: steel
  physics:
    gravity: -9.8
    weight_budget: 100  # kg total for all furniture

compose:
  table:
    builder: Table
    use_context: [theme, physics]  # Pull from shared context
  
  chair_1:
    builder: Chair
    use_context: [theme]
    contribute_context:
      weight: 8  # Report weight back to context
```

**Benefits:**
- ✅ Sibling awareness (chairs see each other's decisions)
- ✅ Global coordination (color palette consistency)
- ✅ Bi-directional communication

---

### 3. Constraint Solvers (Not Built)
**Need:** Let builders negotiate instead of dictate

```yaml
# DESIRED: Not yet implemented
compose:
  table:
    builder: Table
    requests:
      - constraint: "total_width < room_width"
        priority: required
      - constraint: "chair_count >= 4"
        priority: desired
  
  chairs:
    builder: Chair
    repeat: 
      count: $chair_count
    constraints:
      - fit_around: table
      - min_spacing: 0.1
```

**Implementation ideas:**
- Simple version: Try multiple seeds until constraints satisfied
- Advanced: Constraint satisfaction solver
- Hybrid: Heuristics + random sampling

---

### 4. Reactive Composition (Not Built)
**Need:** Child builders can influence parent

```typescript
// DESIRED: Not yet implemented
interface CompositionFeedback {
  actualSize?: AABB;      // "I'm bigger than you thought"
  requirements?: {         // "I need more space"
    minSpacing: number;
    clearance: number;
  };
  metadata?: {             // "Here's info for siblings"
    seatHeight: number;
    armrestHeight?: number;
  };
}
```

---

## Workarounds You Can Use Today ✅

### Workaround 1: Pre-compute Everything in Parent
```yaml
decisions:
  chair_count: { type: count, min: 2, max: 6 }
  table_style: { type: choice, options: [rectangular, round] }

measurements:
  table_width: 1.2
  table_depth: 0.8

derived:
  # Compute chair spacing in parent
  chair_spacing: "if(chair_count > 4, 0.6, 0.8)"
  
  # Compute chair facing angles
  chair_angle_1: "0"
  chair_angle_2: "90"
  chair_angle_3: "180"
  chair_angle_4: "270"

compose:
  chair_1:
    builder: Chair
    offset: { x: "-table_width / 2 - 0.3", y: 0, z: 0 }
    rotation: { x: 0, y: "$chair_angle_1", z: 0 }
```

**Pros:** Works with current system
**Cons:** Parent must know all child details, verbose

---

### Workaround 2: Use Decision Overrides Extensively
```yaml
# Parent creates "style guide" decisions
decisions:
  scene_style: { type: choice, options: [modern, rustic] }
  primary_wood: { type: choice, options: [oak, walnut] }
  metal_finish: { type: choice, options: [brushed, polished] }

compose:
  table:
    builder: Table
    overrides:
      style: $scene_style
      wood_type: $primary_wood
      leg_material: $metal_finish
  
  chair_1:
    builder: Chair
    overrides:
      style: $scene_style
      wood_type: $primary_wood
      leg_material: $metal_finish
```

**Pros:** Ensures visual consistency
**Cons:** Every child must support same decision names

---

### Workaround 3: Placement System for Spatial Constraints
```yaml
# Use placement system instead of manual compose
placement:
  builder: Chair
  count: 6
  mode: rectangle
  bounds: { width: 2.5, depth: 1.5 }
  center: { x: 0, y: 0, z: 0 }
  minDistance: 0.1
  overrides:
    style: $scene_style
```

**Pros:** Automatic collision avoidance
**Cons:** Limited to simple spatial relationships

---

## What Should We Build? 🎯

### Priority 1: Constraint Context (Medium Effort, High Value)
**Add to YAML schema:**
```yaml
compose:
  chair_1:
    builder: Chair
    offset: { x: 0, y: 0, z: 1 }
    constraints:  # NEW
      max_height: 0.9
      max_footprint: { width: 0.5, depth: 0.5 }
      required_tags: [seating, stable]
```

**Implementation:**
- Add `constraints` field to YamlComposition interface
- Pass as special override: `__constraints__`
- Child can query: `builder.getConstraint('max_height')`
- Child validates before building

**Estimated effort:** 2-4 hours (Small story)

---

### Priority 2: Shared Context Store (Medium Effort, Medium Value)
**Add to YAML schema:**
```yaml
# NEW top-level section
shared_context:
  theme:
    style: modern
    primary_color: wood_oak
  physics:
    gravity: -9.8

compose:
  table:
    builder: Table
    read_context: [theme]
  chair:
    builder: Chair
    read_context: [theme]
    write_context:
      chair_seat_height: $seat_height  # Contribute back
```

**Implementation:**
- New `SharedContext` class (like Map but structured)
- Pass through ParseOptions
- Children can read/write during build
- **Challenge:** Need to decide on evaluation order

**Estimated effort:** 4-8 hours (Medium story)

---

### Priority 2.5: Semantic Scene Graph (Medium-High Effort, High Value)
**Complement to Shared Context - for queries instead of state:**

```yaml
geometry:
  - loop: seat_top
    vertices: [...]
    tags: [surface, seating, horizontal]  # NEW

compose:
  table:
    builder: Table
    tags: [furniture, table, surface_provider]  # NEW
```

**Query DSL:**
```bash
scene.query_by_tag surface        # Find all surfaces
scene.query_by_part table         # Get table by name
scene.query_nearby chair_1 radius=1.0   # Spatial query
scene.query_facing chair_1 angle=45     # Orientation query
```

**Why this matters:**
- **Shared Context** = Write/read state (theme, sizes, decisions)
- **Scene Graph** = Query spatial/semantic relationships (location, tags, bounds)
- Enables "face the table", "place on surfaces", "avoid other furniture"
- Agents can understand scene functionally, not just geometrically

**Implementation:**
- `SceneGraph` class with nodes (name, tags, bounds, transform, parent/children)
- Build graph after composition
- Query API for tags, names, spatial relationships
- **Advanced:** Builders can query during composition (Phase 4)

**Estimated effort:** 8-16 hours (Large story, can split into phases)

**Status:** Already planned as **P2M2d-005** in BACKLOG

---

### Priority 3: Feedback Loop (High Effort, High Value)
**Allow children to report requirements:**
```yaml
compose:
  chair_1:
    builder: Chair
    feedback_required: true  # NEW
    adapt_to_feedback: true  # NEW
```

**Implementation:**
- Two-pass composition:
  1. Build children with feedback_required
  2. Parent adapts based on feedback
  3. Rebuild children with new parameters
- Store feedback in TracedOutput
- **Challenge:** Avoiding infinite loops

**Estimated effort:** 8-16 hours (Large story)

---

### Priority 4: Constraint Solver (Very High Effort, Very High Value)
**Automatic satisfaction of constraints:**
```typescript
const solver = new ConstraintSolver();
solver.addConstraint('chair_spacing > 0.3');
solver.addConstraint('total_width < room_width');
solver.addConstraint('chair_count >= 4', { priority: 'desired' });

const solution = solver.solve(builder, { maxAttempts: 100 });
```

**Implementation options:**
- Simple: Random sampling with validation
- Medium: Hill climbing / simulated annealing
- Advanced: SMT solver integration (Z3)

**Estimated effort:** 16-40 hours (Extra Large story)

---

## Recommendations 💡

### Three Complementary Mechanisms

We need **three different mechanisms** for cross-builder communication, each serving a distinct purpose:

| Mechanism | Purpose | Direction | When Available | Example Use |
|-----------|---------|-----------|----------------|-------------|
| **Constraint Context** | Parent constrains child | Parent → Child | Composition time | "Fit in this space", "Face this direction" |
| **Shared Context Store** | Global state sharing | Any ↔ Any | Build time | "Use this theme", "Report your size" |
| **Semantic Scene Graph** | Query relationships | Query from built scene | After composition | "Find all surfaces", "What's near me?" |

**How they work together:**
1. **Constraint Context** - Parent sets requirements for children
2. **Shared Context** - Children share decisions and measurements
3. **Scene Graph** - Anyone can query the final assembled scene

**Example scenario:**
```yaml
# Constraint Context: Parent constrains child
compose:
  chair:
    constraints:
      max_height: 0.9
      pose: { facing: center }

# Shared Context: Global coordination
shared_context:
  theme: { style: modern, wood: oak }

# Scene Graph: Query after building
# DSL: scene.query_by_tag surface
# DSL: scene.query_facing chair_1 angle=45
```

### For Your Immediate Use Case:
**Use Workaround 1 or 2 today:**
- Pre-compute all spatial relationships in parent
- Use decision overrides for style consistency
- Use placement system for automatic spacing

### For Phase 2 Roadmap:
**Add these stories to P2-M2d (Agent Authoring Layer):**

1. **P2M2d-002: Constraint Context** (Priority: High, Size: S)
   - Add `constraints` field to composition
   - Child builders can query constraints
   - Validation reports constraint violations
   - **Estimated effort:** 2-4 hours

2. **P2M2d-003: Shared Context Store** (Priority: High, Size: M)
   - Scene-level key-value store
   - Builders can read/write during composition
   - Enables sibling awareness
   - **Estimated effort:** 4-8 hours

3. **P2M2d-005: Semantic Scene Graph** (Priority: Medium, Size: L)
   - Tag geometry with semantic meaning
   - Build queryable scene graph
   - DSL commands for spatial/semantic queries
   - **Estimated effort:** 8-16 hours (can split into phases)
   - **Note:** Already planned in BACKLOG!

### For Phase 3 or Later:
4. **P3M-XXX: Constraint Solver** (Priority: Low for now, Size: XL)
   - Automatic constraint satisfaction
   - Useful for complex scenes with many constraints
   - Can be deferred until we have many constraint-heavy use cases

---

## Analogy to Vue.js

| Vue Concept | Procedurable Equivalent | Status |
|-------------|------------------------|--------|
| Props | Decision Overrides | ✅ Built |
| Emit | ❌ No equivalent | ⬜ Not built |
| Provide/Inject | Shared Context | ⬜ Not built |
| Vuex/Pinia Store | Shared Context Store | ⬜ Not built |
| Computed Props | Derived Measurements | ✅ Built |
| Watchers | ❌ No equivalent | ⬜ Not built |
| Refs | Composition Traces | ✅ Built (read-only) |

**Key difference:** Vue is reactive (changes propagate), Procedurable is static (one-shot generation). This means we need explicit two-pass or feedback mechanisms.

---

## Conclusion

**You can do a lot today** with decision overrides and the placement system, but you're right that we're missing:

1. ✅ **Rich constraint objects** - Easy to add (Priority 1)
2. ✅ **Shared context store** - Moderate effort (Priority 2)
3. ❌ **Feedback loops** - Higher effort but very valuable (Priority 3)
4. ❌ **Constraint solvers** - Future work (Priority 4)

**I recommend adding Priority 1 and 2 to the P2-M2d epic.** They're natural extensions of the composition system and will unlock much more expressive builder relationships.

Would you like me to create backlog stories for Constraint Context and Shared Context Store?

