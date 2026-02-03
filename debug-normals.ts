import { YamlBuilderExecutor } from './src/generation/builder/YamlBuilderExecutor';
import { unwrapMesh } from './src/platform/geometry/UVUnwrapper';
import { Vec3 } from './src/platform/math/Vec3';
import { Mesh } from './src/platform/geometry/Mesh';

function computeVertexNormals(mesh: Mesh): Vec3[] {
  const normals: Vec3[] = new Array(mesh.vertices.length);
  for (let i = 0; i < mesh.vertices.length; i++) {
    normals[i] = new Vec3(0, 0, 0);
  }

  for (const face of mesh.faces) {
    if (face.indices.length < 3) continue;
    const p0 = mesh.vertices[face.indices[0]].position;
    const p1 = mesh.vertices[face.indices[1]].position;
    const p2 = mesh.vertices[face.indices[2]].position;
    const v1 = p1.sub(p0);
    const v2 = p2.sub(p0);
    const fn = v1.cross(v2);
    const len = fn.length();
    if (len > 0.0001) {
      const normalized = fn.mul(1/len);
      for (const idx of face.indices) {
        normals[idx] = normals[idx].add(normalized);
      }
    }
  }

  for (let i = 0; i < normals.length; i++) {
    const len = normals[i].length();
    if (len > 0.0001) {
      normals[i] = normals[i].mul(1/len);
    }
  }

  return normals;
}

async function test() {
  console.log('Starting test...');

  const executor = new YamlBuilderExecutor();
  const result = await executor.executeFile('builders/catalog/components/ChessPiece.yaml', 1);
  const mesh = result.mesh;

  console.log('Original mesh vertices:', mesh.vertices.length);
  console.log('Original mesh faces:', mesh.faces.length);

  const unwrapped = unwrapMesh(mesh, { angleThreshold: 45, margin: 0.02 });
  console.log('Unwrapped mesh vertices:', unwrapped.mesh.vertices.length);
  console.log('Unwrapped mesh faces:', unwrapped.mesh.faces.length);

  const normals = computeVertexNormals(unwrapped.mesh);

  console.log('\nSample normals (first 10):');
  for (let i = 0; i < Math.min(10, normals.length); i++) {
    const n = normals[i];
    console.log(`  v${i}: (${n.x.toFixed(3)}, ${n.y.toFixed(3)}, ${n.z.toFixed(3)})`);
  }

  const uniqueNormals = new Set<string>();
  for (const n of normals) {
    uniqueNormals.add(`${n.x.toFixed(2)},${n.y.toFixed(2)},${n.z.toFixed(2)}`);
  }
  console.log('\nUnique normals:', uniqueNormals.size);

  // Convert to normal map colors
  console.log('\nSample normal map colors (RGB 0-255):');
  for (let i = 0; i < Math.min(10, normals.length); i++) {
    const n = normals[i];
    const r = Math.round((n.x * 0.5 + 0.5) * 255);
    const g = Math.round((n.y * 0.5 + 0.5) * 255);
    const b = Math.round((n.z * 0.5 + 0.5) * 255);
    console.log(`  v${i}: RGB(${r}, ${g}, ${b})`);
  }
}

test().catch(console.error);
