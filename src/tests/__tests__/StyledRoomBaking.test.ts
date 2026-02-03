/**
 * StyledRoomBaking.test.ts
 *
 * Diagnostic test: traces exactly what happens when bake_textures is called
 * on StyledRoom's mesh (style: mid_century_modern).
 *
 * This test has NO assertions -- it is purely for diagnosis via console.log.
 */
import { describe, it, beforeAll } from '@jest/globals';
import { parseAndExecuteBuilder, parseYamlWithLibrary } from '../../generation/builder/YamlBuilderParser';
import type { YamlBuilderDefinition } from '../../generation/builder/YamlBuilderParser';
import { setMetadataStore, MetadataStore } from '../../storage/MetadataStore';
import { clearStyleCache } from '../../generation/builder/StyleResolver';
import { clearRoleCache, clearRegisteredRoles } from '../../generation/builder/BuilderRoleRegistry';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TracedOutput } from '../../generation/builder/TracedBuilder';
import { unwrapMesh } from '../../platform/geometry/UVUnwrapper';
import { bakeTexturesPerMaterial } from '../../platform/materials/TextureBaker';
import type { MaterialStackDefinition } from '../../platform/materials/MaterialStack';

// Import generators side-effect (ensures all generators are registered)
import '../../platform/materials/generators';

const SCENES_PATH = join(__dirname, '../../../builders/scenes/templates');
const CATALOG_PATH = join(__dirname, '../../../builders/catalog');
const METADATA_PATH = join(__dirname, '../../../metadata');

// Set up metadata store before all tests
beforeAll(() => {
  const store = new MetadataStore({ rootDir: METADATA_PATH });
  setMetadataStore(store);
});

async function loadYaml(path: string): Promise<YamlBuilderDefinition> {
  const yamlStr = readFileSync(path, 'utf-8');
  return parseYamlWithLibrary(yamlStr);
}

function createCatalogBuilderResolver(): (name: string) => ((seed: number, overrides?: Record<string, any>) => Promise<TracedOutput>) | null {
  const catalogRoot = join(__dirname, '../../../builders');

  return (name: string) => {
    const paths = [
      join(CATALOG_PATH, name + '.yaml'),
      join(CATALOG_PATH, 'components/' + name + '.yaml'),
      join(catalogRoot, name.replace('catalog/', '') + '.yaml'),
      join(catalogRoot, name + '.yaml'),
    ];

    for (const p of paths) {
      try {
        readFileSync(p);
        return async (seed: number, overrides?: Record<string, any>) => {
          const yaml = await loadYaml(p);
          return parseAndExecuteBuilder(yaml, {
            seed,
            overrides,
            builderResolver: createCatalogBuilderResolver()
          });
        };
      } catch {
        // Try next path
      }
    }
    return null;
  };
}

async function runStyledRoom(style: string, seed = 1): Promise<TracedOutput> {
  const path = join(SCENES_PATH, 'StyledRoom.yaml');
  const yaml = await loadYaml(path);
  return parseAndExecuteBuilder(yaml, {
    seed,
    overrides: { style },
    builderResolver: createCatalogBuilderResolver()
  });
}
// ============================================================================
// DIAGNOSTIC TEST
// ============================================================================

describe('StyledRoom Baking Diagnostics', () => {

  beforeAll(() => {
    clearStyleCache();
    clearRoleCache();
    clearRegisteredRoles();
  });

  it('should trace bake_textures on StyledRoom mid_century_modern mesh', async () => {
    // STEP 1: Build the StyledRoom
    console.log('\n=== STEP 1: Building StyledRoom (mid_century_modern) ===');
    const result = await runStyledRoom('mid_century_modern', 1);
    const mesh = result.mesh;
    console.log('Mesh vertices: ' + mesh.vertices.length);
    console.log('Mesh faces: ' + mesh.faces.length);

    // STEP 2: Inspect materialSlots
    console.log('\n=== STEP 2: material slots ===');
    console.log('mesh.materialSlots.length: ' + mesh.materialSlots.length);
    mesh.materialSlots.forEach((slot: any, idx: number) => {
      console.log(
        '  slot[' + idx + ']: name="' + slot.name +
        '" color=rgb(' + slot.color.r.toFixed(3) + ',' + slot.color.g.toFixed(3) + ',' + slot.color.b.toFixed(3) + ')' +
        ' roughness=' + slot.roughness + ' metalness=' + slot.metalness
      );
    });

    // STEP 3: Face materialSlotIndex distribution
    console.log('\n=== STEP 3: face materialSlotIndex distribution ===');
    let withSlot = 0;
    let withoutSlot = 0;
    let slotZero = 0;
    const slotCounts = new Map<number | undefined, number>();
    for (const face of mesh.faces) {
      const idx = face.materialSlotIndex;
      slotCounts.set(idx, (slotCounts.get(idx) ?? 0) + 1);
      if (idx !== undefined) {
        withSlot++;
        if (idx === 0) slotZero++;
      } else {
        withoutSlot++;
      }
    }
    console.log('Faces with materialSlotIndex !== undefined: ' + withSlot);
    console.log('Faces with materialSlotIndex === undefined: ' + withoutSlot);
    console.log('Faces with materialSlotIndex === 0: ' + slotZero);
    console.log('Per-slot-value face counts:');
    for (const [idx, count] of slotCounts) {
      console.log('  slot ' + idx + ': ' + count + ' faces');
    }
    // STEP 4: Check UVs before unwrap
    console.log('\n=== STEP 4: UV inspection (before unwrap) ===');
    let verticesWithUV = 0;
    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    for (const vertex of mesh.vertices) {
      const uv = vertex.attributes?.uv as [number, number] | undefined;
      if (uv !== undefined) {
        verticesWithUV++;
        const [u, v] = uv;
        if (u < uMin) uMin = u;
        if (u > uMax) uMax = u;
        if (v < vMin) vMin = v;
        if (v > vMax) vMax = v;
      }
    }
    const hasUVs = verticesWithUV > 0;
    console.log('Vertices with UV set: ' + verticesWithUV + ' / ' + mesh.vertices.length);
    console.log('Has any UVs: ' + hasUVs);
    if (hasUVs) {
      console.log('UV bounds: u=[' + uMin.toFixed(4) + ', ' + uMax.toFixed(4) + '], v=[' + vMin.toFixed(4) + ', ' + vMax.toFixed(4) + ']');
    }

    // STEP 5: UV unwrap with preserveExistingUVs: true
    console.log('\n=== STEP 5: unwrapMesh (preserveExistingUVs: true) ===');
    const unwrapResult = unwrapMesh(mesh, { preserveExistingUVs: true });
    const unwrappedMesh = unwrapResult.mesh;
    console.log('UV islands: ' + unwrapResult.islands.length);
    console.log('UV utilization: ' + (unwrapResult.utilization * 100).toFixed(1) + '%');
    console.log('Max stretch: ' + unwrapResult.maxStretch.toFixed(4));

    // Re-inspect UVs after unwrap
    let uvAfterCount = 0;
    let uMinA = Infinity, uMaxA = -Infinity, vMinA = Infinity, vMaxA = -Infinity;
    for (const vertex of unwrappedMesh.vertices) {
      const uv = vertex.attributes?.uv as [number, number] | undefined;
      if (uv !== undefined) {
        uvAfterCount++;
        const [u, v] = uv;
        if (u < uMinA) uMinA = u;
        if (u > uMaxA) uMaxA = u;
        if (v < vMinA) vMinA = v;
        if (v > vMaxA) vMaxA = v;
      }
    }
    console.log('Vertices with UV after unwrap: ' + uvAfterCount + ' / ' + unwrappedMesh.vertices.length);
    if (uvAfterCount > 0) {
      console.log('UV bounds after unwrap: u=[' + uMinA.toFixed(4) + ', ' + uMaxA.toFixed(4) + '], v=[' + vMinA.toFixed(4) + ', ' + vMaxA.toFixed(4) + ']');
    }
    // STEP 6: Build materialDefs same as builder.bake_textures auto-detect
    console.log('\n=== STEP 6: Building materialDefs (auto-detect from slot name) ===');
    const materialDefs = new Map<number, MaterialStackDefinition>();
    if (unwrappedMesh.materialSlots && unwrappedMesh.materialSlots.length > 0) {
      for (let i = 0; i < unwrappedMesh.materialSlots.length; i++) {
        const slot = unwrappedMesh.materialSlots[i];
        const nameLower = slot.name.toLowerCase();
        const color = slot.color;
        const roughness = slot.roughness ?? 0.5;
        const metalness = slot.metalness ?? 0.0;
        let generator: string;
        let params: Record<string, unknown>;
        if (nameLower.includes('wood')) {
          let species = 'oak';
          if (nameLower.includes('walnut')) species = 'walnut';
          else if (nameLower.includes('pine')) species = 'pine';
          else if (nameLower.includes('maple')) species = 'maple';
          else if (nameLower.includes('cherry')) species = 'cherry';
          else if (nameLower.includes('ebony')) species = 'walnut';
          else {
            const brightness = (color.r + color.g + color.b) / 3;
            if (brightness > 0.7) species = 'maple';
            else if (brightness > 0.55) species = 'pine';
            else if (brightness > 0.4) species = 'oak';
            else species = 'walnut';
          }
          generator = 'wood_grain';
          params = { species, scale: 10, ringFrequency: 40, ringContrast: 0.7, noiseAmount: 0.4 };
          console.log('  slot[' + i + '] "' + slot.name + '" -> wood_grain (species=' + species + ')');
        } else {
          generator = 'solid_color';
          params = { color, roughness, metalness, variation: 0.005, scale: 10 };
          console.log('  slot[' + i + '] "' + slot.name + '" -> solid_color');
        }
        materialDefs.set(i, { layers: [{ generator, params, blendMode: 'normal' as const, opacity: 1.0 }] });
      }
    } else {
      const defaultColor = unwrappedMesh.faces.length > 0 && unwrappedMesh.faces[0].color
        ? unwrappedMesh.faces[0].color
        : { r: 0.6, g: 0.4, b: 0.2 };
      materialDefs.set(0, { layers: [{ generator: 'solid_color', params: { color: defaultColor, roughness: 0.5, metalness: 0.0, variation: 0.005, scale: 10 }, blendMode: 'normal' as const, opacity: 1.0 }] });
      console.log('  (no material slots) slot[0] -> solid_color (default)');
    }
    console.log('Total materialDefs entries: ' + materialDefs.size);
    // STEP 7: Call bakeTexturesPerMaterial and inspect results
    console.log('\n=== STEP 7: bakeTexturesPerMaterial ===');
    const perMatResult = bakeTexturesPerMaterial(unwrappedMesh, materialDefs, {
      resolution: 256,
      channels: ['albedo', 'roughness', 'normal', 'ao'],
      seed: 1
    });
    console.log('Total bake time: ' + perMatResult.totalBakeTimeMs + 'ms');
    console.log(
      'Stats: materialCount=' + perMatResult.stats.materialCount +
      ', totalTriangles=' + perMatResult.stats.totalTriangles +
      ', solidColor=' + perMatResult.stats.solidColorMaterials +
      ', textured=' + perMatResult.stats.texturedMaterials
    );
    console.log('\nPer-material results:');
    for (const [slotIndex, matResult] of perMatResult.materials) {
      const coveragePct = (matResult.bakeResult.stats.coverage * 100).toFixed(2);
      console.log('  material[' + slotIndex + ']:');
      console.log('    name: "' + matResult.name + '"');
      console.log('    isSolidColor: ' + matResult.isSolidColor);
      console.log('    bakeResult.resolution: ' + matResult.bakeResult.resolution);
      console.log('    coverage: ' + coveragePct + '%');
      console.log('    triangleCount: ' + matResult.triangleCount);
    }
    console.log('\n=== DIAGNOSTIC COMPLETE ===');
  }, 120000);

});
