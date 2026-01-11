# CAD Furniture System - Debug Guide & Architecture Review

## 🎨 What You Should See

The demo at **http://localhost:3006/** now shows:

### Row 1 (Back, z=-3): Chair Styles
1. **Windsor Chair** - Spindle back, turned legs, stretchers
2. **Modern Dining** - Clean lines, tapered legs, curved back
3. **Ladderback** - Horizontal slat back, straight legs
4. **Queen Anne** - Cabriole legs, solid back
5. **Bar Stool** - Tall, no back, splayed legs
6. **Lounge** - Wide, low, with arms

### Row 2 (Middle, z=2): Table Styles
1. **Dining Table** - Large rectangular
2. **Coffee Table** - Low, wide
3. **Round Dining** - Circular top
4. **Side Table** - Small, 3 legs

### Row 3 (Front, z=6): Random Variations
- 5 Windsor chair variations with slight dimensional differences

### Far Back (z=-7): Dining Set
- Complete dining table with 6 chairs arranged around it

## 🐛 Known Positioning Issues

### Symptom: Parts in Wrong Positions

The current system has several positioning problems:

1. **No Scene Graph**: We're directly modifying vertex positions instead of using transforms
2. **Rotation Issues**: Stretchers are rotated by swapping Y with X/Z coordinates - this is hacky
3. **Order-Dependent Translations**: Translations stack up unpredictably
4. **No Local vs World Distinction**: Everything is in world space

### Example of the Problem

```typescript
// Current approach - modifying vertices directly
leg.vertices.forEach((v: Vertex) => {
  v.position.x += legPos.top.x;  // Add to world X
  v.position.z += legPos.top.z;  // Add to world Z
});

// This becomes problematic when:
// 1. The part was already rotated
// 2. Multiple translations are applied
// 3. We want to move the whole assembly later
```

## ✅ The Solution: Transform System

### Proposed Architecture

```typescript
// A simple Transform that encapsulates position, rotation, scale
interface Transform {
  position: Vec3;
  rotation: Quat;   // Or Euler angles
  scale: Vec3;
  
  // Compute the 4x4 transformation matrix
  getMatrix(): Mat4;
  
  // Apply to a mesh (transforms vertices)
  applyTo(mesh: Mesh): Mesh;
}

// A SceneNode that creates a hierarchy
interface SceneNode {
  name: string;
  transform: Transform;
  mesh?: Mesh;              // Optional geometry
  children: SceneNode[];
  parent?: SceneNode;
  
  // Get the world transform (parent * local)
  getWorldTransform(): Transform;
  
  // Flatten to a single mesh in world coordinates
  toMesh(): Mesh;
}
```

### How Assembly Would Work

```typescript
function assembleChair(spec: ChairSpec): SceneNode {
  const root = new SceneNode('chair');
  
  // Seat - positioned at leg height
  const seatNode = new SceneNode('seat');
  seatNode.mesh = createSeat(...);
  seatNode.transform.position.y = spec.legs.height;
  root.addChild(seatNode);
  
  // Legs - each with its own local transform
  for (const legPos of legPositions) {
    const legNode = new SceneNode('leg');
    legNode.mesh = createLeg(...);
    legNode.transform.position = legPos.top;
    legNode.transform.rotation = calculateLegRotation(legPos.splayDir);
    root.addChild(legNode);
  }
  
  // Back - rotated for recline, positioned at seat back
  const backNode = new SceneNode('back');
  backNode.mesh = createBack(...);
  backNode.transform.position = new Vec3(0, spec.legs.height + seatThickness, -depth/2);
  backNode.transform.rotation = Quat.fromAxisAngle(Vec3.right(), spec.back.angle);
  root.addChild(backNode);
  
  return root;
}
```

### Benefits

1. **Clear Separation**: Local transforms vs world positions
2. **Composable**: Can move whole chair by changing root transform
3. **Debuggable**: Can visualize transform hierarchy
4. **Extensible**: Add animation, physics, etc.
5. **Matches Three.js**: Easy to convert to Three.js scene graph

## 🔧 Quick Fixes Without Full Refactor

If you want to fix positioning without a full scene graph refactor:

### 1. Create Mesh Transform Helpers

```typescript
// Add to Mesh class or as utility
function translateMesh(mesh: Mesh, offset: Vec3): void {
  mesh.vertices.forEach(v => {
    v.position = v.position.add(offset);
  });
}

function rotateMeshY(mesh: Mesh, angle: number, pivot: Vec3 = Vec3.zero()): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  mesh.vertices.forEach(v => {
    const x = v.position.x - pivot.x;
    const z = v.position.z - pivot.z;
    v.position.x = x * cos - z * sin + pivot.x;
    v.position.z = x * sin + z * cos + pivot.z;
  });
}
```

### 2. Fix Stretcher Rotation

The stretcher rotation is broken because we're swapping coordinates. Instead:

```typescript
// Create stretcher along X axis
const stretcher = createStretcher(length, thickness);

// Rotate to desired direction (e.g., along Z for side stretchers)
rotateMeshY(stretcher, Math.PI / 2);

// Then translate to position
translateMesh(stretcher, new Vec3(x, height, z));
```

### 3. Use Consistent Coordinate System

Define a convention:
- **Origin**: All parts created at origin
- **Up**: Y-axis is up
- **Front**: Positive Z is front
- **Right**: Positive X is right

Then apply transforms in consistent order: Scale → Rotate → Translate

## 🚀 Recommended Next Steps

1. **Create Mat4 class** (4x4 transformation matrix)
2. **Create Transform class** (position, rotation, scale → matrix)
3. **Create SceneNode class** (transform + mesh + children)
4. **Refactor assembleChair/Table** to use SceneNodes
5. **Convert to Three.js** at render time

## 📊 Debug Visualization Ideas

Since you can't post screenshots, consider adding debug output:

```typescript
// Log bounding boxes
function logBounds(mesh: Mesh, name: string) {
  let min = new Vec3(Infinity, Infinity, Infinity);
  let max = new Vec3(-Infinity, -Infinity, -Infinity);
  mesh.vertices.forEach(v => {
    min = min.min(v.position);
    max = max.max(v.position);
  });
  console.log(`${name}: min=(${min.x.toFixed(2)}, ${min.y.toFixed(2)}, ${min.z.toFixed(2)}) max=(${max.x.toFixed(2)}, ${max.y.toFixed(2)}, ${max.z.toFixed(2)})`);
}

// Add to assembleChair:
logBounds(seat, 'seat');
logBounds(leg, `leg ${i}`);
logBounds(back, 'back');
```

This will help identify which parts are positioned incorrectly.

## 💡 Summary

The CAD furniture system demonstrates sophisticated procedural generation with:
- Multiple chair styles (6 types)
- Multiple table styles (4 types)
- Parametric variations
- Proper part composition

The positioning issues stem from the lack of a proper transform/scene graph system. The fix is either:
1. **Quick**: Add mesh transform helpers and fix coordinate handling
2. **Proper**: Implement a full Transform/SceneNode system

The architecture is sound - it just needs the transform layer to be complete.

---

**View the demo at**: http://localhost:3006/  
**Build command**: `npm run build`  
**Dev server**: `npm run dev`

