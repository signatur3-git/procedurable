import { Archetype } from '../Archetype';
import { ParameterSet } from '../ParameterSet';
import { GenerationContext } from '../GenerationContext';
import { Mesh } from '../../geometry/Mesh';
import { EdgeLoop } from '../../geometry/EdgeLoop';
import { Vec3 } from '../../core/Vec3';
import { MeshOperations } from '../../geometry/MeshOperations';
import { Vertex } from '../../geometry/Vertex';

export class PillarArchetype extends Archetype {
  constructor() {
    super('Pillar', [
      {
        name: 'height',
        type: 'number',
        defaultValue: 3,
        min: 0.5,
        max: 20,
        description: 'Height of the pillar'
      },
      {
        name: 'baseRadius',
        type: 'number',
        defaultValue: 0.5,
        min: 0.1,
        max: 3,
        description: 'Radius at the base'
      },
      {
        name: 'topRadius',
        type: 'number',
        defaultValue: 0.4,
        min: 0.1,
        max: 3,
        description: 'Radius at the top'
      },
      {
        name: 'segments',
        type: 'number',
        defaultValue: 16,
        min: 3,
        max: 64,
        description: 'Number of segments around circumference'
      },
      {
        name: 'style',
        type: 'enum',
        defaultValue: 'smooth',
        options: ['smooth', 'fluted', 'twisted'],
        description: 'Style of the pillar'
      },
      {
        name: 'hasBase',
        type: 'boolean',
        defaultValue: true,
        description: 'Whether to include a base'
      },
      {
        name: 'hasCapital',
        type: 'boolean',
        defaultValue: true,
        description: 'Whether to include a capital (top decoration)'
      }
    ]);
  }

  generate(params: ParameterSet, _context: GenerationContext): Mesh {
    const height = params.get('height') as number;
    const baseRadius = params.get('baseRadius') as number;
    const topRadius = params.get('topRadius') as number;
    const segments = Math.floor(params.get('segments') as number);
    const style = params.get('style') as string;
    const hasBase = params.get('hasBase') as boolean;
    const hasCapital = params.get('hasCapital') as boolean;

    const mesh = new Mesh();
    let currentHeight = 0;

    if (hasBase) {
      const baseHeight = height * 0.1;
      const baseWidth = baseRadius * 1.3;
      const baseMesh = this.createBase(baseWidth, baseHeight, segments);
      mesh.merge(baseMesh);
      currentHeight += baseHeight;
    }

    const shaftHeight = height * (hasBase && hasCapital ? 0.7 : hasBase || hasCapital ? 0.85 : 1.0);
    const shaftMesh = this.createShaft(
      baseRadius,
      topRadius,
      shaftHeight,
      currentHeight,
      segments,
      style
    );
    mesh.merge(shaftMesh);
    currentHeight += shaftHeight;

    if (hasCapital) {
      const capitalHeight = height * 0.2;
      const capitalWidth = topRadius * 1.4;
      const capitalMesh = this.createCapital(topRadius, capitalWidth, capitalHeight, currentHeight, segments);
      mesh.merge(capitalMesh);
    }

    mesh.calculateNormals();
    return mesh;
  }

  private createBase(radius: number, height: number, segments: number): Mesh {
    const bottomLoop = EdgeLoop.createCircle(Vec3.zero(), radius, segments);
    const midLoop = EdgeLoop.createCircle(new Vec3(0, height * 0.6, 0), radius * 0.9, segments);
    const topLoop = EdgeLoop.createCircle(new Vec3(0, height, 0), radius * 0.85, segments);
    const mesh = MeshOperations.loft([bottomLoop, midLoop, topLoop]);
    MeshOperations.cap(bottomLoop, mesh, true);
    return mesh;
  }

  private createShaft(
    baseRadius: number,
    topRadius: number,
    height: number,
    yOffset: number,
    segments: number,
    style: string
  ): Mesh {
    const sections = style === 'twisted' ? 12 : 6;
    const loops: EdgeLoop[] = [];

    for (let i = 0; i <= sections; i++) {
      const t = i / sections;
      const y = yOffset + height * t;
      const radius = baseRadius + (topRadius - baseRadius) * t;

      let loop: EdgeLoop;

      if (style === 'twisted') {
        const twistAngle = t * Math.PI * 2;
        loop = EdgeLoop.createCircle(new Vec3(0, y, 0), radius, segments);
        loop = loop.transform((v, idx) => {
          const angle = (idx / segments) * Math.PI * 2 + twistAngle;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          return new Vertex(new Vec3(x, y, z), v.attributes);
        });
      } else if (style === 'fluted') {
        const flutes = Math.floor(segments / 2);
        loop = EdgeLoop.createCircle(new Vec3(0, y, 0), radius, segments);
        loop = loop.transform((v, idx) => {
          const fluteDepth = radius * 0.05;
          const fluteAngle = (idx / segments) * flutes * Math.PI * 2;
          const depthMod = Math.sin(fluteAngle) * fluteDepth;
          const adjustedRadius = radius - Math.abs(depthMod);
          const angle = (idx / segments) * Math.PI * 2;
          const x = Math.cos(angle) * adjustedRadius;
          const z = Math.sin(angle) * adjustedRadius;
          return new Vertex(new Vec3(x, y, z), v.attributes);
        });
      } else {
        loop = EdgeLoop.createCircle(new Vec3(0, y, 0), radius, segments);
      }

      loops.push(loop);
    }

    return MeshOperations.loft(loops);
  }

  private createCapital(
    baseRadius: number,
    topRadius: number,
    height: number,
    yOffset: number,
    segments: number
  ): Mesh {
    const bottomLoop = EdgeLoop.createCircle(new Vec3(0, yOffset, 0), baseRadius, segments);
    const midLoop = EdgeLoop.createCircle(new Vec3(0, yOffset + height * 0.5, 0), topRadius, segments);
    const topLoop = EdgeLoop.createCircle(new Vec3(0, yOffset + height, 0), topRadius * 0.95, segments);
    const mesh = MeshOperations.loft([bottomLoop, midLoop, topLoop]);
    MeshOperations.cap(topLoop, mesh, false);
    return mesh;
  }
}

