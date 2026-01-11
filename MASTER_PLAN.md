# Procedurable - Master Plan (Updated)

## 🎯 Original Vision (Unchanged)
A hierarchical, composable procedural generation system for 3D scenes:
- Create scenes from vague ("a city") to explicit ("a Victorian house, 12m tall")
- CAD/mathematical definitions with archetype interpolation
- Edge loop based geometry with adjustable LOD
- Works for organic (people, trees) and technical (buildings, furniture) objects

---

## ✅ Foundation Work Completed

### What We Fixed
| Issue | Root Cause | Solution |
|-------|------------|----------|
| Floating/misplaced parts | Mixed vertex manipulation + scene graph | Use ONLY SceneNode for positioning |
| Inverted normals | Wrong face winding order | Fixed loft/extrude/createBox winding |
| Smooth shading on hard edges | Shared vertices averaging normals | Flat shading in MeshConverter |
| Beveled panel issues | Clockwise loop winding | Counter-clockwise vertex order |

### What We Built
- **`SafePrimitives.ts`** - Foolproof geometry creation
- **`MeshValidation.ts`** - Bounds validation at creation time
- **`primitiveTests.ts`** - Automated validation tests
- **Fixed `MeshOperations`** - Correct winding throughout

### The Golden Pattern
```typescript
// 1. Create geometry at origin using SafePrimitives
const mesh = createRod(radius, height);

// 2. Position ONLY via SceneNode
const node = SceneNode.fromMesh('part', mesh);
node.setPosition(x, y, z);
parent.addChild(node);

// 3. Flatten to mesh only at render time
const finalMesh = rootNode.toMesh();
```

---

## 📋 Updated Implementation Phases

### Phase 1: Core Data Structures ✅ COMPLETE
- [x] Vec3, Random, Vertex, Face, EdgeLoop, Mesh
- [x] MeshOperations (loft, extrude, cap)
- [x] Transform, Mat4, SceneNode
- [x] SafePrimitives with validation
- [x] **MeshModeler** - Blender-like mesh building ✅ NEW
  - extrudeFace(), extrudeLoop()
  - insetFace(), cutHoleInFace()
  - extrudeAlongPath() - for branches, curved shapes
  - bridgeLoops() - connect edge loops
  - defineSeam() - mark connection points
  - addBone(), autoWeightToBone() - rigging
  - stitchMeshesAtSeams() - join meshes at seams

### Phase 2: Clean Builder Pattern (CURRENT PRIORITY)

**Goal:** Create one clean builder (ChairBuilder) using only safe patterns.

- [x] **2.1 Refactor ChairBuilder** using SafePrimitives + SceneNode ✅
  - Created `src/builders/furniture/ChairBuilder.ts`
  - Three chair styles: simple, dining, stool
  - Uses createRod, createPanel, createBox, createHorizontalRod
  - All positioning via SceneNode.setPosition()

- [ ] **2.2 Create TableBuilder** following same pattern
- [ ] **2.3 Create FurnitureBuilder** composite that delegates
- [ ] **2.4 Validate:** Run tests, visual inspection, all parts positioned correctly

### Phase 3: Specification & Style System

**Goal:** Let users describe what they want at any detail level.

- [ ] **3.1 BuildSpec interface**
  ```typescript
  interface BuildSpec {
    type: string;           // 'chair', 'table', 'room'
    style?: string;         // 'modern', 'victorian', 'rustic'
    parameters?: Record<string, number | string>;
    seed?: number;
    children?: BuildSpec[];
  }
  ```

- [ ] **3.2 StyleGuide system**
  ```typescript
  const victorianStyle: StyleGuide = {
    name: 'victorian',
    defaults: {
      'chair.backStyle': 'ornate',
      'chair.legStyle': 'turned',
      'table.legStyle': 'cabriole'
    }
  };
  ```

- [ ] **3.3 BuildSpecResolver** - fills in missing details from style

### Phase 4: Room & Placement System

**Goal:** Generate furnished rooms with proper placement.

- [ ] **4.1 RoomBuilder** - walls, floor, ceiling
- [ ] **4.2 PlacementStrategy** - where furniture can go
  - `WallPlacement` - against walls (beds, dressers)
  - `CenterPlacement` - middle of room (tables)
  - `CornerPlacement` - in corners (lamps, plants)
- [ ] **4.3 FurnitureArrangement** - relationships between pieces
  - Chairs go with tables
  - Nightstands go with beds
  - etc.

### Phase 5: Human/Character System

**Goal:** Generate humanoid characters with proper anatomy.

- [ ] **5.1 RigBuilder** - skeleton hierarchy
- [ ] **5.2 Seam system** - how parts connect
- [ ] **5.3 BodyPartBuilders** - torso, head, arms, legs
- [ ] **5.4 AnthropometricData** - realistic proportions
- [ ] **5.5 SymmetrySystem** - left/right mirroring

### Phase 6: City/Exterior System

**Goal:** Generate cities with streets, buildings, people.

- [ ] **6.1 StreetBuilder** - road network
- [ ] **6.2 BuildingBuilder** - various building types
- [ ] **6.3 LayoutStrategies** - grid, organic, radial
- [ ] **6.4 PopulationSystem** - place people in scene

---

## 🛠️ Immediate Next Steps

### Step 1: Clean ChairBuilder (This Session)
Create a new `ChairBuilderV3` that:
1. Uses ONLY `SafePrimitives.ts` functions
2. Uses ONLY `SceneNode` for positioning
3. No direct vertex manipulation
4. Validates output

### Step 2: Visual Demo
Update main.ts to show the clean chair with:
- Multiple chair styles from the same builder
- Proper lighting and positioning
- Console output showing the SceneNode hierarchy

### Step 3: TableBuilder
Same pattern for tables, proving the approach scales.

### Step 4: Combine
Create a simple scene with chairs around a table.

---

## 📁 File Structure (Target)

```
src/
├── core/                    # ✅ Foundation (done)
│   ├── Vec3.ts
│   ├── Mat4.ts
│   ├── Transform.ts
│   ├── SceneNode.ts
│   └── Random.ts
│
├── geometry/                # ✅ Low-level geometry (done)
│   ├── Vertex.ts
│   ├── Face.ts
│   ├── EdgeLoop.ts
│   ├── Mesh.ts
│   └── MeshOperations.ts
│
├── cad/                     # ✅ Safe primitives (done)
│   ├── SafePrimitives.ts    # USE THIS
│   ├── primitives.ts        # (legacy, avoid)
│   └── furnitureParts.ts    # (to be refactored)
│
├── validation/              # ✅ Testing (done)
│   └── MeshValidation.ts
│
├── builders/                # 🔄 IN PROGRESS
│   ├── Builder.ts           # Base class
│   ├── furniture/
│   │   ├── ChairBuilder.ts  # Clean implementation
│   │   ├── TableBuilder.ts
│   │   └── FurnitureBuilder.ts
│   ├── room/
│   │   └── RoomBuilder.ts
│   └── person/
│       └── PersonBuilder.ts
│
├── specs/                   # TODO
│   ├── BuildSpec.ts
│   ├── StyleGuide.ts
│   └── styles/
│       ├── modern.ts
│       └── victorian.ts
│
├── placement/               # TODO
│   ├── PlacementStrategy.ts
│   └── strategies/
│
├── renderer/                # ✅ Three.js integration (done)
│   └── MeshConverter.ts
│
└── tests/                   # ✅ Validation tests (done)
    └── primitiveTests.ts
```

---

## 🎯 Success Criteria

### Phase 2 Complete When:
- [ ] ChairBuilder produces correct chairs using SafePrimitives
- [ ] TableBuilder produces correct tables
- [ ] Scene with multiple furniture pieces renders correctly
- [ ] All primitive tests pass
- [ ] No direct vertex manipulation in builders

### Phase 3 Complete When:
- [ ] Can specify `{type: 'chair', style: 'modern'}` and get appropriate chair
- [ ] Can override specific parameters
- [ ] Styles cascade properly (modern + rustic = modern with rustic elements)

### Phase 4 Complete When:
- [ ] Can generate a bedroom with bed, nightstands, dresser
- [ ] Furniture placed appropriately (not overlapping, against walls)
- [ ] Room dimensions respected

### Phase 5 Complete When:
- [ ] Can generate a humanoid character
- [ ] Body parts connect at seams properly
- [ ] Proportions match anthropometric data
- [ ] Can generate variants (tall, short, different body types)

