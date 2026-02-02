# Procedurable Scene Description (PSD) v0.1

> **Status:** v0.1 — schema definition and type interfaces
> **Story:** B2-001
> **Source:** `src/generation/builder/PSD.ts`

---

## Purpose

PSD is the intermediate representation between builders (authoring) and consumers (renderers, exporters, agents). It captures:

- **Scene hierarchy** — what parts exist and how they're organized
- **Geometry** — mesh data for each part
- **Transforms** — where each part is in space
- **Materials** — PBR material definitions
- **Tags** — semantic annotations for queries
- **Instances** — shared geometry with different transforms

### Relationship to USD

PSD is inspired by Pixar's USD but drastically simplified:

| USD Concept | PSD Equivalent | Notes |
|-------------|---------------|-------|
| Stage | `PSDScene` | Single scene container |
| Prim | `PSDPrim` | Three types: Mesh, Instance, Xform |
| SdfPath | `path: string` | `/Root/child/grandchild` convention |
| Xform | `PSDTransform` | Position + Euler rotation + scale |
| GeomMesh | `PSDMeshPrim` | Flat arrays for vertices/normals/indices |
| PointInstancer | `PSDInstancePrim` | Reference to prototype + transform |
| MaterialBinding | `materialSlots` | Per-face material index |
| Skeleton | Stubbed (`null`) | Ready for Phase 3 |

---

## Schema Overview

### Scene

```yaml
version: "0.1"
name: "DiningScene"
generator: "DiningScene seed=42"
materials:
  - name: oak_wood
    color: [0.6, 0.4, 0.2]
    roughness: 0.7
    metalness: 0.0
prims:
  /DiningScene: { ... }
  /DiningScene/table: { ... }
  /DiningScene/chair_0: { ... }
metadata:
  buildTime: 0.045
  qualityTier: 1
```

### Prim Types

#### Mesh Prim

Contains actual geometry data.

```yaml
/DiningScene/table:
  type: Mesh
  parent: /DiningScene
  children: []
  transform:
    position: [0, 0, 0]
    rotation: [0, 0, 0]
    scale: [1, 1, 1]
  tags: [furniture, table, surface]
  bounds:
    min: [-0.5, 0, -0.3]
    max: [0.5, 0.75, 0.3]
  builderName: Table
  geometry:
    vertices: [...]      # flat [x,y,z, x,y,z, ...]
    normals: [...]        # flat [nx,ny,nz, ...]
    indices: [...]        # triangle indices
  materialSlots: [0, 0, 0, ...]  # per-triangle material index
  skeleton: null          # Phase 3 stub
  jointWeights: []        # Phase 3 stub
```

#### Instance Prim

References a prototype prim — no duplicated geometry.

```yaml
/DiningScene/chair_1:
  type: Instance
  parent: /DiningScene
  children: []
  transform:
    position: [0.8, 0, 0]
    rotation: [0, 1.57, 0]
    scale: [1, 1, 1]
  tags: [furniture, seating, chair]
  bounds:
    min: [-0.2, 0, -0.2]
    max: [0.2, 0.9, 0.2]
  prototype: /DiningScene/__prototypes__/DiningChair
  seed: 43
```

#### Xform Prim

Pure grouping node — organizes children without geometry.

```yaml
/DiningScene:
  type: Xform
  parent: null
  children: [/DiningScene/table, /DiningScene/chair_0, /DiningScene/chair_1]
  transform:
    position: [0, 0, 0]
    rotation: [0, 0, 0]
    scale: [1, 1, 1]
  tags: [scene, dining]
  bounds:
    min: [-1.5, 0, -1.0]
    max: [1.5, 0.9, 1.0]
  builderName: DiningScene
```

---

## Path Conventions

Paths follow USD conventions:

- Must start with `/`
- Must not end with `/`
- Segments separated by `/`
- Root prim typically matches scene name: `/DiningScene`
- Children nested: `/DiningScene/table`, `/DiningScene/chair_0`
- Prototypes stored under `/__prototypes__/`: `/DiningScene/__prototypes__/DiningChair`

### Helper Functions

```typescript
import { isValidPSDPath, getParentPath, getPrimName } from './PSD';

isValidPSDPath('/Root/table');     // true
isValidPSDPath('Root/table');      // false (no leading /)
getParentPath('/Root/table/leg');  // '/Root/table'
getPrimName('/Root/table/leg');    // 'leg'
```

---

## Materials

Materials use a simplified PBR model:

```yaml
materials:
  - name: oak_wood
    color: [0.6, 0.4, 0.2]
    roughness: 0.7
    metalness: 0.0
  - name: steel
    color: [0.5, 0.52, 0.55]
    roughness: 0.3
    metalness: 0.8
```

Each face in a mesh prim references a material by index via `materialSlots`. When no material slots are defined, all faces use material index 0.

Material slots are a bridge to the full C3 Material Slots system. The current PBR fields (color, roughness, metalness) will be extended with textures and advanced properties in C3.

---

## Phase 3 Stubs

Mesh prims include skeleton and joint weight stubs for future rigging support:

```typescript
skeleton: null;       // Will reference a Skeleton prim in Phase 3
jointWeights: [];     // Will contain per-vertex [jointIndex, weight] pairs
```

These fields are present now so the format doesn't need a breaking change when rigging is added.

---

## Validation

Use `validatePSDScene()` to check a scene for consistency:

```typescript
import { validatePSDScene } from './PSD';

const errors = validatePSDScene(scene);
if (errors.length > 0) {
  console.error('PSD validation failed:', errors);
}
```

Checks performed:
- Path format (must start with `/`)
- Path-key consistency (prim.path matches its key in the map)
- Parent-child bidirectional consistency
- Material index bounds (per-face indices within materials array)
- Instance prototype existence
- Skeleton stub is null (Phase 3)
