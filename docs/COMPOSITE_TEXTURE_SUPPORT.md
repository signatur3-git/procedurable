# Composite Builder Texture Support

**Date:** 2026-02-07  
**Status:** Analysis Complete - Implementation Needed

## Executive Summary

Composite builders (like DiningScene) consist of multiple sub-builders (Table, DiningChair) that each have their own meshes and materials. Adding texture support requires:

1. **Per-subbuilder texture baking** - Bake textures for each composed builder separately
2. **Scene export with multiple textured objects** - Export GLB with each object having its own textured material
3. **Dashboard integration** - Preview composite scenes with textures

**Complexity: MEDIUM** - The building blocks exist, but need orchestration for composite flows.

---

## Current Architecture

### Single Builder Flow (Working)
```
builder.open DiningChair
builder.run
builder.unwrap        → Unwrap mesh UVs
builder.bake_textures → Bake textures to output/textures/
export_gltf           → Export textured GLB
```

### Composite Builder Flow (Current - No Textures)
```
builder.open scenes/DiningScene
builder.run              → Creates TracedOutput with:
                           - Main mesh (welded from all components)
                           - Composed children (table, chairs)
                           - Instances via PSD serialization
export_scene_gltf        → Exports scene GLB with PBR colors only
```

**Gap:** No UV unwrapping or texture baking for composite builders.

---

## Architecture Analysis

### TracedBuilder.compose()
When a scene composes sub-builders, it:
1. Runs each sub-builder with transform offsets
2. Either welds the mesh directly (non-instanced)
3. Or stores as a PSD Instance prim (instanced)

**Key insight:** Each sub-builder returns a full `TracedOutput` with its own mesh and material slots.

### PSD Scene Structure
```typescript
interface PSDScene {
  prims: Record<string, PSDPrim>;  // /table, /chair_0, /chair_1, etc.
  materials: PSDMaterial[];        // Merged materials from all prims
}
```

Each prim has its own geometry but references shared materials by index.

### exportSceneGLB() Current Implementation
- Creates GLTF materials from `scene.materials[]`
- Uses `pbrMetallicRoughness.baseColorFactor` (color only)
- Does NOT support textures

---

## Implementation Plan

### Phase 1: Per-Subbuilder Texture Baking (Foundation)

**New command: `builder.bake_scene_textures`**

```typescript
// Pseudo-implementation
async function bakeSceneTextures(ctx: CommandContext): Promise<PerBuilderTextureSet[]> {
  const scene = ctx.lastRun.scene;  // PSDScene
  const results: PerBuilderTextureSet[] = [];
  
  for (const [path, prim] of Object.entries(scene.prims)) {
    if (prim.type !== 'Mesh') continue;
    if (path.includes('__prototypes__')) continue; // Skip prototype refs
    
    // Reconstruct mesh from PSD geometry
    const mesh = deserializeMeshFromPSD(prim);
    
    // Unwrap UVs if needed
    if (!hasUVs(mesh)) {
      mesh = unwrapUVs(mesh);
    }
    
    // Bake textures for this sub-mesh
    const textures = await bakeTexturesPerMaterial(mesh, ...);
    
    results.push({
      primPath: path,
      textures,
      materialIndices: prim.materialIndices
    });
  }
  
  return results;
}
```

**Challenges:**
1. Need to track which materials belong to which prims
2. Need to store textures with prim-path prefixes to avoid collisions
3. Instanced prims share prototype geometry - only bake prototype once

### Phase 2: Scene Export with Textures

**New function: `exportTexturedSceneGLB(scene, textureMap)`**

```typescript
function exportTexturedSceneGLB(
  scene: PSDScene,
  textureMap: Map<string, BakedTextureSet>  // primPath → textures
): GLTFSceneExportResult {
  // Build materials with texture references
  const gltfMaterials = scene.materials.map((mat, idx) => {
    const texSet = textureMap.get(materialToPrimPath[idx]);
    if (texSet) {
      return {
        name: mat.name,
        pbrMetallicRoughness: {
          baseColorTexture: { index: addTexture(texSet.albedo) },
          metallicRoughnessTexture: { index: addTexture(texSet.roughness) }
        },
        normalTexture: texSet.normal ? { index: addTexture(texSet.normal) } : undefined
      };
    }
    // Fallback to color-only
    return {
      name: mat.name,
      pbrMetallicRoughness: {
        baseColorFactor: [mat.color[0], mat.color[1], mat.color[2], 1.0]
      }
    };
  });
  
  // ... rest of GLB export
}
```

**Key changes to GLTFExporter:**
1. Add `images` array for texture data
2. Add `textures` array referencing images
3. Add `samplers` array for texture sampling config
4. Update material references to use texture indices

### Phase 3: Dashboard Integration

**Update `loadBakedTextures()` in dashboard:**

```typescript
async function loadBakedTextures(): Promise<void> {
  // Current: Skip for scene builders
  // New: Handle scene builders differently
  
  if (isSceneBuilder(state.activeBuilder)) {
    // Run scene texture baking
    const result = await executeCommands([
      'builder.bake_scene_textures resolution=512'
    ]);
    
    // Preview shows all textures grouped by prim
    state.sceneTextures = result.data.perPrimTextures;
    return;
  }
  
  // ... existing single-builder logic
}
```

---

## Data Flow Diagram

```
                    COMPOSITE BUILDER RUN
                           │
                           ▼
    ┌───────────────────────────────────────────────────────┐
    │                    DiningScene                         │
    │  compose:                                              │
    │    table → Table.yaml → mesh + materials              │
    │    chair_0 → DiningChair.yaml → mesh + materials     │
    │    chair_1 → DiningChair.yaml → mesh + materials     │
    └───────────────────────────────────────────────────────┘
                           │
                           ▼
    ┌───────────────────────────────────────────────────────┐
    │                   PSD Scene                            │
    │  prims:                                                │
    │    /table → geometry, materialIndices[0,1]            │
    │    /chair_0 → geometry, materialIndices[2]            │
    │    /chair_1 → geometry, materialIndices[2]            │
    │  materials:                                            │
    │    [0] table_top_wood                                  │
    │    [1] table_leg_wood                                  │
    │    [2] chair_wood                                      │
    └───────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
    ┌─────────┐      ┌─────────┐      ┌─────────┐
    │  Bake   │      │  Bake   │      │  Bake   │
    │ /table  │      │/chair_0 │      │/chair_1 │
    │ textures│      │textures │      │(shared) │
    └─────────┘      └─────────┘      └─────────┘
         │                 │                 │
         ▼                 ▼                 ▼
    ┌───────────────────────────────────────────────────────┐
    │              Textured Scene GLB                        │
    │  images: [table_albedo.png, chair_albedo.png, ...]    │
    │  textures: [ref→images]                               │
    │  materials: [table_mat, chair_mat] with textures      │
    │  meshes: [table, chair_proto]                         │
    │  nodes: [table, chair_0, chair_1] (instances share)   │
    └───────────────────────────────────────────────────────┘
```

---

## Instancing Considerations

When a scene has instanced objects (like multiple chairs from the same builder):

1. **Prototype pattern:** Store one baked texture set per prototype
2. **Instance sharing:** All instances of the same builder share textures
3. **Seed variations:** If instances have different seeds, they might need different textures (deferred for simplicity)

For MVP, assume all instances of same builder type share textures.

---

## Implementation Tasks

### Task 1: Add `deserializeMeshFromPSD()`
- Extract mesh geometry from PSD prim
- Reconstruct Face and Vertex structures
- Preserve material slot indices

### Task 2: Track texture provenance in scene baking
- Map which textures belong to which scene prims
- Handle material index remapping

### Task 3: Extend `exportSceneGLB()` for textures
- Add embedded texture support (images array)
- Create texture-aware materials
- Handle instanced mesh texture sharing

### Task 4: Add `builder.bake_scene_textures` command
- Iterate scene prims
- Unwrap UVs per-prim if needed
- Bake and save textures with prim prefix

### Task 5: Update dashboard for scene textures
- Remove scene builder skip
- Show grouped texture preview
- Support textured scene GLB download

---

## Estimated Effort

| Task | Complexity | Effort |
|------|------------|--------|
| deserializeMeshFromPSD | Low | 2h |
| Scene texture provenance | Medium | 3h |
| exportSceneGLB with textures | Medium | 4h |
| bake_scene_textures command | Medium | 3h |
| Dashboard scene textures | Medium | 3h |
| Testing & validation | Medium | 3h |
| **Total** | | **~18h** |

---

## Alternative: Simpler MVP

If full scene texturing is too much, a simpler approach:

**Export each sub-builder separately with textures:**

```
builder.open scenes/DiningScene
builder.run
builder.export_composed_parts
  → output/DiningScene_table.glb (textured)
  → output/DiningScene_chair.glb (textured)
```

Then use external tool to assemble the scene.

**Pros:** Much simpler implementation  
**Cons:** Loses scene hierarchy, requires manual assembly

---

## Recommendation

Start with **Task 3 (extend exportSceneGLB)** as it unlocks value even without automatic baking. Users can:

1. Bake textures for each sub-builder individually
2. Export scene with references to pre-baked textures

Then add automatic scene baking as a convenience feature.
