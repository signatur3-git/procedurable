# Export

Getting geometry out of Procedurable into standard formats.

## Current State

| Format | Status | How |
|--------|--------|-----|
| OBJ | [exists] | `builder.export_obj` — basic vertex + face export |
| glTF/GLB | [planned — C6] | Target standard for interchange |
| Three.js JSON | [exists] | Dashboard internal format (WebSocket) |

## OBJ Export [exists]

Basic Wavefront OBJ. Exports vertices and faces. No materials, no UVs, no normals in the file.

```
builder.export_obj DiningChair seed=42
→ .obj file content
```

## glTF Export [planned — C6]

The target interchange format. glTF is the "JPEG of 3D" — universally supported.

### Requirements

| Feature | Depends On |
|---------|------------|
| Mesh geometry | [exists] |
| Normals | [exists] (computed) |
| Material definitions | Material Slots [C3] |
| Texture coordinates | UV Generation [C4] |
| Scene hierarchy | Scene Description [B2] |
| Multiple meshes | Composition [exists] |

### Export Pipeline (Target)

```
TracedOutput (or Scene)
  │
  ├── Mesh → glTF mesh primitives
  │   ├── positions (Float32Array)
  │   ├── normals (Float32Array)
  │   └── texcoords (Float32Array) [needs C4]
  │
  ├── Materials → glTF materials
  │   ├── Material slot → PBR metallic-roughness
  │   └── Default colors as fallback
  │
  ├── Scene hierarchy → glTF nodes
  │   ├── Transforms per composed builder
  │   └── Names from SceneGraph
  │
  └── Output: .glb (binary) or .gltf + .bin
```

### LOD Export (Future)

Different quality tiers map to LOD levels:

```
Tier 3 mesh → LOD 0 (full detail)
Tier 2 mesh → LOD 1 (medium, skip deformers)
Tier 1 mesh → LOD 2 (low, skip subdivision + bevel)
Tier 0 mesh → LOD 3 (bounding box proxy)
```

This falls out naturally from the modifier stack — each LOD applies fewer modifiers.
