# Procedurable - Procedural 3D Generation System
🎨 A mathematical, edge-loop based procedural 3D content generation system with Three.js visualization.
## 🎮 Live Demo
\\\ash
npm install
npm run dev
\\\
Open http://localhost:3000 to see 10 procedurally generated objects with deterministic variation!
## ✨ What's Working
### Core Systems ✅
- **Seeded Random** - Mulberry32 PRNG (deterministic)
- **3D Vector Math** - Complete Vec3 implementation
- **Edge Loops** - Closed vertex contours (circles, rectangles)
- **Mesh Operations** - Extrude, loft, cap, primitives
- **Three.js Rendering** - Full PBR materials, shadows, interactive camera
### Current Demo
- 5 unique cylinders (varying height, radius, segments)
- 4 unique spheres (varying size, detail, materials)
- 1 animated center piece
- All generated from seed values
- Real-time animation and lighting
## 🏗️ Architecture
\\\
src/
├── core/
│   ├── Random.ts          # Seeded PRNG
│   └── Vec3.ts            # 3D vectors
├── geometry/
│   ├── Vertex.ts          # Vertices + attributes
│   ├── Face.ts            # Polygons
│   ├── EdgeLoop.ts        # Closed contours
│   ├── Mesh.ts            # Geometry container
│   └── MeshOperations.ts  # Extrude, loft, primitives
└── renderer/
    └── MeshConverter.ts   # Three.js integration
\\\
## 💻 Example Usage
\\\	ypescript
import { Random } from './core/Random';
import { Vec3 } from './core/Vec3';
import { EdgeLoop } from './geometry/EdgeLoop';
import { MeshOperations } from './geometry/MeshOperations';
// Create with seed for determinism
const random = new Random(42);
// Build edge loops
const bottom = EdgeLoop.createCircle(Vec3.zero(), 1, 16);
const top = EdgeLoop.createCircle(new Vec3(0, 3, 0), 0.7, 16);
// Loft between loops
const mesh = MeshOperations.loft([bottom, top]);
MeshOperations.cap(bottom, mesh, true);
mesh.calculateNormals();
// Convert to Three.js and render
const threeMesh = MeshConverter.toThreeMesh(mesh);
scene.add(threeMesh);
\\\
## 🎯 Key Features
1. **Deterministic** - Same seed = same result
2. **Edge-Loop Based** - Flexible, CAD-style modeling
3. **Composable** - Build complex from simple operations
4. **Mathematical** - All geometry defined parametrically
5. **Real-time** - Three.js for instant visualization
## 🚀 Next Steps
Ready to extend:
- Add archetype system for templates
- Implement LOD generation
- Add more primitives and operations
- Export to standard formats
- Create organic generators (trees, terrain)
## 📝 License
MIT
