# Procedurable - Architecture & Planning Checklist

## 🎯 Vision
A hierarchical, composable procedural generation system where users can create scenes at any level of detail - from "a city" to "a neo-gothic cathedral with specific dimensions on the corner of 5th and Main."

---

## 🏗️ Core Architecture Concepts

### 1. Builder Hierarchy Pattern

```
Scene
├── CityBuilder
│   ├── DistrictBuilder (residential/commercial/industrial)
│   │   ├── StreetBuilder
│   │   │   └── StreetSegmentBuilder
│   │   ├── BuildingBuilder
│   │   │   ├── HouseBuilder
│   │   │   ├── SkyscraperBuilder
│   │   │   └── ShopBuilder
│   │   └── ParkBuilder
│   └── PopulationBuilder
│       └── PersonBuilder
│           ├── RigBuilder (skeleton)
│           ├── TorsoBuilder
│           ├── HeadBuilder
│           ├── ArmBuilder
│           └── LegBuilder
│
└── InteriorBuilder
    ├── RoomBuilder
    │   ├── WallBuilder
    │   ├── FloorBuilder
    │   └── CeilingBuilder
    └── FurnitureBuilder
        ├── ChairBuilder
        ├── TableBuilder
        ├── BedBuilder
        └── ShelfBuilder
```

---

## 📊 Data Model Design

### Phase 1: Core Data Structures ✅ (Completed)
- [x] `Vec3` - 3D vector math
- [x] `Random` - Seeded PRNG
- [x] `Vertex` - Vertices with attributes
- [x] `Face` - Polygonal faces
- [x] `EdgeLoop` - Closed contours
- [x] `Mesh` - Geometry container
- [x] `MeshOperations` - Extrude, loft, cap

### Phase 2: Archetype & Parameter System (Next Priority)

#### Why Start Here?
These are the **foundation for all builders**. Without them, we can't define reusable templates.

- [ ] **`ParameterDefinition`** - Define what can vary
  ```typescript
  interface ParameterDefinition {
    name: string;
    type: 'number' | 'enum' | 'boolean' | 'vector3';
    defaultValue: any;
    min?: number;
    max?: number;
    options?: string[];  // for enums
    description?: string;
  }
  ```

- [ ] **`ParameterSet`** - Actual values for parameters
  ```typescript
  class ParameterSet {
    values: Map<string, any>;
    validate(definitions: ParameterDefinition[]): boolean;
    interpolate(other: ParameterSet, t: number): ParameterSet;
    randomize(random: Random, constraints?: Partial<ParameterSet>): void;
  }
  ```

- [ ] **`Archetype`** - Template with parameters
  ```typescript
  abstract class Archetype {
    name: string;
    parameters: ParameterDefinition[];
    
    abstract generate(params: ParameterSet, context: GenerationContext): Mesh;
    
    getDefaultParameters(): ParameterSet;
    createVariant(seed: number, constraints?: Partial<ParameterSet>): Mesh;
  }
  ```

- [ ] **`GenerationContext`** - Shared state during generation
  ```typescript
  class GenerationContext {
    random: Random;
    seed: number;
    lodLevel: number;  // 0-1, where 1 is max detail
    constraints: any;  // Scene-specific constraints
    resources: Map<string, any>;  // Shared resources (materials, textures)
  }
  ```

### Phase 3: Constraint System

#### Why This Matters?
Constraints let us say "a house between 8-12m tall" or "Victorian style" without micromanaging every parameter.

- [ ] **`Constraint`** - Base class for all constraints
  ```typescript
  interface Constraint {
    name: string;
    type: 'range' | 'enum' | 'relationship' | 'spatial';
    
    apply(params: ParameterSet): ParameterSet;
    isValid(params: ParameterSet): boolean;
  }
  ```

- [ ] **`RangeConstraint`** - Numeric bounds
  ```typescript
  class RangeConstraint implements Constraint {
    parameterName: string;
    min: number;
    max: number;
  }
  ```

- [ ] **`EnumConstraint`** - Limited choices
  ```typescript
  class EnumConstraint implements Constraint {
    parameterName: string;
    allowedValues: string[];
  }
  ```

- [ ] **`RelationshipConstraint`** - Parameters depend on each other
  ```typescript
  class RelationshipConstraint implements Constraint {
    // e.g., "roof height must be 0.2 * building height"
    relationship: (params: ParameterSet) => boolean;
  }
  ```

- [ ] **`SpatialConstraint`** - Position/placement rules
  ```typescript
  class SpatialConstraint implements Constraint {
    // e.g., "must be at least 2m from other objects"
    checkPlacement: (position: Vec3, context: GenerationContext) => boolean;
  }
  ```

### Phase 4: Builder System

#### Why Builders?
Builders orchestrate multiple archetypes and handle composition, placement, and relationships.

- [ ] **`Builder`** - Base builder class
  ```typescript
  abstract class Builder<T = Mesh> {
    name: string;
    random: Random;
    
    abstract build(spec: BuildSpec, context: GenerationContext): T;
    
    // Helper for child builders
    protected createChild<C>(
      ChildBuilder: new () => Builder<C>,
      spec: BuildSpec
    ): C;
  }
  ```

- [ ] **`BuildSpec`** - What to build (flexible specification)
  ```typescript
  interface BuildSpec {
    type?: string;  // e.g., "house", "person", "chair"
    style?: string;  // e.g., "victorian", "modern", "baroque"
    parameters?: Partial<ParameterSet>;
    constraints?: Constraint[];
    count?: number | [number, number];  // How many to generate
    seed?: number;
    children?: BuildSpec[];  // Nested specifications
  }
  ```

- [ ] **`CompositeBuilder`** - Delegates to child builders
  ```typescript
  class CompositeBuilder extends Builder<SceneObject> {
    childBuilders: Map<string, Builder>;
    
    registerBuilder(type: string, builder: Builder): void;
    
    build(spec: BuildSpec, context: GenerationContext): SceneObject {
      // Delegate to appropriate child builder
      // Handle placement and composition
    }
  }
  ```

### Phase 5: Scene Graph

#### Why Scene Graph?
We need to organize generated objects hierarchically with transforms and metadata.

- [ ] **`SceneObject`** - Node in scene hierarchy
  ```typescript
  class SceneObject {
    id: string;
    name: string;
    mesh?: Mesh;
    transform: Transform;  // position, rotation, scale
    children: SceneObject[];
    parent?: SceneObject;
    metadata: Map<string, any>;  // Type, style, parameters used, etc.
    
    addChild(child: SceneObject): void;
    getWorldTransform(): Transform;
    findByType(type: string): SceneObject[];
  }
  ```

- [ ] **`Transform`** - Position, rotation, scale
  ```typescript
  class Transform {
    position: Vec3;
    rotation: Quaternion;  // Need to implement
    scale: Vec3;
    
    toMatrix(): Matrix4;  // Need to implement
    apply(point: Vec3): Vec3;
    compose(other: Transform): Transform;
  }
  ```

- [ ] **`Scene`** - Root container
  ```typescript
  class Scene {
    root: SceneObject;
    context: GenerationContext;
    builders: Map<string, Builder>;
    
    generate(spec: BuildSpec): void;
    findObjects(predicate: (obj: SceneObject) => boolean): SceneObject[];
    export(format: 'three' | 'gltf' | 'obj'): any;
  }
  ```

---

## 🎭 Example Use Cases (Work Backwards)

### Use Case 1: Simple City
```typescript
const citySpec: BuildSpec = {
  type: 'city',
  style: 'modern',
  parameters: { size: 'medium' },
  seed: 42
};

// Should generate:
// - Grid of streets
// - 20-40 buildings of mixed types
// - Some parks/open spaces
// - Population (optional, for visualization)
```

**Required Components:**
- [x] `CityBuilder` → delegates to district/street/building builders
- [ ] `StreetBuilder` → creates road network
- [ ] `BuildingBuilder` → base class for all buildings
- [ ] `HouseBuilder`, `OfficeBuilder`, etc. → specific building types
- [ ] Layout algorithm (grid, organic, radial)
- [ ] Placement system (collision detection, spacing)

### Use Case 2: Furnished Room
```typescript
const roomSpec: BuildSpec = {
  type: 'room',
  style: 'bedroom',
  parameters: {
    width: 4,
    length: 5,
    height: 2.5
  },
  seed: 123
};

// Should generate:
// - Walls, floor, ceiling
// - Bed (against wall)
// - Nightstand (near bed)
// - Closet (against wall)
// - Window and door (in appropriate walls)
```

**Required Components:**
- [ ] `RoomBuilder` → creates enclosure
- [ ] `FurnitureBuilder` → base for furniture
- [ ] `FurniturePlacementSystem` → knows where furniture can go
- [ ] `WallFeatureBuilder` → doors, windows
- [ ] Furniture archetypes (bed, table, chair, etc.)
- [ ] Style system (modern, traditional, minimalist)

### Use Case 3: Humanoid Character
```typescript
const personSpec: BuildSpec = {
  type: 'person',
  style: 'realistic',
  parameters: {
    height: 1.75,
    gender: 'any',
    age: 30,
    bodyType: 'average'
  },
  seed: 456
};

// Should generate:
// - Skeleton rig (bone structure)
// - Body parts connected at seams
// - Proper proportions (anthropometric data)
// - Optional: clothing
```

**Required Components:**
- [ ] `PersonBuilder` → orchestrates body creation
- [ ] `RigBuilder` → creates skeleton (hierarchy of bones)
- [ ] `BodyPartBuilder` → base for all body parts
- [ ] `TorsoBuilder`, `HeadBuilder`, `ArmBuilder`, `LegBuilder`
- [ ] **Seam System** → how parts connect
- [ ] **Anthropometric Data** → realistic proportions
- [ ] **Symmetry System** → left/right mirroring
- [ ] Joint system → elbow, knee, shoulder constraints

---

## 🔧 Technical Challenges & Solutions

### Challenge 1: Part Connections (Seams)
**Problem:** How do we connect a head to a neck, leg to hip, etc.?

**Solution: Seam System**
```typescript
interface Seam {
  name: string;  // e.g., "neck_top", "hip_left"
  position: Vec3;
  normal: Vec3;  // Which way the connection faces
  edgeLoop: EdgeLoop;  // The connection boundary
  constraints?: {
    angleRange?: [number, number];
    positionTolerance?: number;
  };
}

class BodyPartArchetype extends Archetype {
  seams: Map<string, Seam>;
  
  connect(otherPart: Mesh, seamName: string, targetSeamName: string): Mesh {
    // Align edge loops, blend/stitch geometry
  }
}
```

- [ ] Implement `Seam` interface
- [ ] Implement `SeamMatcher` - finds compatible seams
- [ ] Implement `SeamStitcher` - blends meshes at seams
- [ ] Add seam visualization/debugging

### Challenge 2: Anthropometric Proportions
**Problem:** Human bodies have specific proportional relationships.

**Solution: Proportion System**
```typescript
class ProportionSystem {
  baseMeasurements: Map<string, number>;  // Height, armLength, etc.
  relationships: Map<string, (base: number) => number>;
  
  // e.g., Head height is ~1/8 total height
  // Arm length is ~0.44 * height
  // etc.
  
  calculate(baseParameter: string, value: number): Map<string, number>;
}
```

- [ ] Research and encode anthropometric data
- [ ] Implement `ProportionSystem`
- [ ] Add variation ranges (different body types)
- [ ] Support different measurement systems

### Challenge 3: Hierarchical Specifications
**Problem:** User might say "a Victorian city" (vague) or specify exact dimensions (explicit).

**Solution: Cascading Specification**
```typescript
class BuildSpecResolver {
  // Fills in missing details from defaults and style guides
  resolve(spec: BuildSpec, styleGuide: StyleGuide): BuildSpec;
  
  // Merges user spec with style defaults
  // style: "victorian" → adds period-appropriate parameters
  // parameters override style defaults
  // constraints validated at each level
}

interface StyleGuide {
  name: string;
  parameterDefaults: Partial<ParameterSet>;
  constraints: Constraint[];
  subStyles?: Map<string, StyleGuide>;
}
```

- [ ] Implement `BuildSpecResolver`
- [ ] Create `StyleGuide` system
- [ ] Add common style guides (Victorian, Modern, Gothic, etc.)
- [ ] Support style composition (Victorian + Coastal)

### Challenge 4: Layout & Placement
**Problem:** How do we place buildings in a city or furniture in a room?

**Solution: Placement System**
```typescript
interface PlacementStrategy {
  place(
    objects: SceneObject[],
    bounds: BoundingBox,
    constraints: SpatialConstraint[]
  ): PlacementResult;
}

class GridPlacementStrategy implements PlacementStrategy {
  // Places objects in a grid
}

class OrganicPlacementStrategy implements PlacementStrategy {
  // Uses noise/randomness for natural placement
}

class WallPlacementStrategy implements PlacementStrategy {
  // Places furniture against walls
}

class PathPlacementStrategy implements PlacementStrategy {
  // Places objects along a path
}
```

- [ ] Implement base `PlacementStrategy`
- [ ] Implement common strategies
- [ ] Add collision detection
- [ ] Add spacing/clearance rules
- [ ] Support placement constraints

---

## 📋 Implementation Priority

### ✅ Phase 1: Foundation (DONE)
- Core math and geometry
- Basic mesh operations
- Three.js rendering

### 🎯 Phase 2: Archetype System (NEXT - Critical Path)
**Why:** Everything else depends on this

**Tasks:**
1. [ ] Design and implement `ParameterDefinition`
2. [ ] Implement `ParameterSet` with validation
3. [ ] Refactor existing code to use `Archetype` base class
4. [ ] Create `GenerationContext`
5. [ ] Test with simple archetype (box with parameters)

**Estimated Complexity:** Medium
**Estimated Time:** 2-3 sessions
**Blockers:** None

### 🎯 Phase 3: Simple Builder Example (Validate Design)
**Why:** Prove the builder pattern works before going deep

**Tasks:**
1. [ ] Implement `Builder` base class
2. [ ] Implement `BuildSpec` interface
3. [ ] Create `FurnitureBuilder` (simple composite)
   - `ChairBuilder` (legs + seat + back)
   - `TableBuilder` (legs + top)
4. [ ] Create `RoomBuilder` that places furniture
5. [ ] Demo: Generated room with random furniture

**Estimated Complexity:** Medium
**Estimated Time:** 2 sessions
**Blockers:** Phase 2

### 🎯 Phase 4: Seam & Connection System
**Why:** Needed for characters and complex assemblies

**Tasks:**
1. [ ] Implement `Seam` interface
2. [ ] Implement `SeamStitcher` for mesh blending
3. [ ] Create simple body part example (torso + arm)
4. [ ] Test connection quality and performance

**Estimated Complexity:** High (mesh blending is tricky)
**Estimated Time:** 3-4 sessions
**Blockers:** Phase 2

### 🎯 Phase 5: Character/Rig System
**Why:** Most complex use case

**Tasks:**
1. [ ] Implement `RigBuilder` (bone hierarchy)
2. [ ] Implement `ProportionSystem`
3. [ ] Create basic body part builders
4. [ ] Assemble simple humanoid
5. [ ] Add joint constraints

**Estimated Complexity:** Very High
**Estimated Time:** 5-6 sessions
**Blockers:** Phase 4

### 🎯 Phase 6: City/Layout System
**Why:** Tests placement and large-scale composition

**Tasks:**
1. [ ] Implement placement strategies
2. [ ] Create `StreetBuilder` (grid layout)
3. [ ] Create simple building builders
4. [ ] Create `CityBuilder` that composes everything
5. [ ] Demo: Small procedural city

**Estimated Complexity:** High
**Estimated Time:** 4-5 sessions
**Blockers:** Phase 3

### 🎯 Phase 7: Style & Constraint System
**Why:** Makes system user-friendly

**Tasks:**
1. [ ] Implement constraint types
2. [ ] Implement `StyleGuide` system
3. [ ] Create common style guides
4. [ ] Implement `BuildSpecResolver`
5. [ ] Add validation and error messages

**Estimated Complexity:** Medium
**Estimated Time:** 2-3 sessions
**Blockers:** Phase 2

---

## 🧪 Validation Checkpoints

Each phase needs validation before moving forward:

### Phase 2 Validation
- [ ] Can create archetype with 5+ parameters
- [ ] Can generate 10 variants from same archetype with different seeds
- [ ] Parameters correctly constrain output
- [ ] Interpolation between two parameter sets works

### Phase 3 Validation
- [ ] Builder can create object from vague spec ("a chair")
- [ ] Builder respects explicit parameters
- [ ] Composite builder delegates correctly
- [ ] Generated room has 3+ pieces of furniture

### Phase 4 Validation
- [ ] Two parts connect seamlessly (no visible seam)
- [ ] Connection respects normal/orientation
- [ ] Works with different edge loop counts
- [ ] Performance acceptable (< 100ms for connection)

### Phase 5 Validation
- [ ] Generated humanoid has correct proportions
- [ ] All body parts connect properly
- [ ] Rig hierarchy is correct
- [ ] Can generate 10 different bodies with variation

### Phase 6 Validation
- [ ] City has 20+ buildings
- [ ] Buildings don't intersect
- [ ] Streets form coherent pattern
- [ ] Generation is fast enough (< 5s for city)

### Phase 7 Validation
- [ ] "Victorian style" produces period-appropriate results
- [ ] Constraints prevent invalid configurations
- [ ] User can override style defaults
- [ ] Error messages are helpful

---

## 🎨 Example User API (Future Goal)

```typescript
// Vague specification
const scene = new Scene();
scene.generate({
  type: 'city',
  style: 'victorian',
  seed: 42
});

// More explicit
scene.generate({
  type: 'city',
  style: 'victorian',
  parameters: {
    size: 'large',
    districts: ['residential', 'commercial']
  },
  constraints: [
    { type: 'range', param: 'buildingHeight', min: 8, max: 25 }
  ],
  seed: 42
});

// Very explicit
scene.generate({
  type: 'city',
  children: [
    {
      type: 'district',
      style: 'residential',
      count: 3,
      children: [
        { type: 'house', count: [10, 15], style: 'victorian' }
      ]
    },
    {
      type: 'district',
      style: 'commercial',
      count: 1,
      children: [
        { type: 'shop', count: [5, 8] },
        { type: 'office', count: [2, 3] }
      ]
    }
  ],
  seed: 42
});

// Interior scene
scene.generate({
  type: 'room',
  style: 'bedroom',
  parameters: { width: 4, length: 5 },
  seed: 123
});

// Character
scene.generate({
  type: 'person',
  parameters: { height: 1.75, age: 30 },
  seed: 456
});
```

---

## 🚀 Next Action

**Immediate:** Start Phase 2 - Archetype System

This is the foundation everything else builds on. Once we have a solid archetype/parameter system, all the builders can use it consistently.

**Want me to start implementing the archetype system?**

