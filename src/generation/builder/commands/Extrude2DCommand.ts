/**
 * Extrude2DCommand - Extrude 2D shapes into 3D geometry
 *
 * Handles: rect, circle, ellipse, polygon, path, text, and boolean shapes.
 * This is the most complex geometry command, supporting:
 * - Multiple shape types
 * - Text rendering with font loading
 * - Boolean operations (union, subtract, intersect)
 * - Bevel options
 * - Hole-aware extrusion
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand, YamlColor, YamlShape, YamlPathSegment } from '../YamlBuilderTypes';
import { resolveGeometryColor } from '../MaterialResolver';
import { TracedBuilder } from '../TracedBuilder';
import { Shape2D } from '../../../platform/geometry/Shape2D';
import { extrude2D } from '../../../platform/geometry/Extrude';
import {
  union as polygonUnion,
  subtract as polygonSubtract,
  intersect as polygonIntersect,
  PolygonWithHoles,
  BooleanResult
} from '../../../platform/geometry/PolygonBoolean';
import { Mesh } from '../../../platform/geometry/Mesh';
import { Vertex } from '../../../platform/geometry/Vertex';
import { Face } from '../../../platform/geometry/Face';
import type { PathSegment } from '../../../platform/geometry/Path2D';
import type { RGBColor } from '../../../platform/materials/MaterialLibrary';

interface Extrude2DCommandDef {
  extrude2d: string;
  shape: string;
  depth: number | string;
  caps?: 'none' | 'front' | 'back' | 'both';
  offset?: number | string;
  bevel?: { size: number | string; segments: number | string };
  color?: YamlColor | string;
}

export class Extrude2DCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'extrude2d';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const extCmd = cmd as Extrude2DCommandDef;
    const { builder, materials, evaluateExpression } = context;

    const extrudeName = extCmd.extrude2d;
    const shapeDef = (builder as any)._yamlShapes?.get(extCmd.shape) as YamlShape | undefined;

    if (!shapeDef) {
      throw new Error(`Shape '${extCmd.shape}' not found. Define it in shapes: section.`);
    }

    // Evaluate depth and offset
    const depth = evaluateExpression(extCmd.depth);
    const offset = extCmd.offset !== undefined ? evaluateExpression(extCmd.offset) : 0;

    // Create Shape2D from definition
    let shape: Shape2D | null = null;
    const centerX = shapeDef.center?.x !== undefined ? evaluateExpression(shapeDef.center.x) : 0;
    const centerZ = shapeDef.center?.z !== undefined ? evaluateExpression(shapeDef.center.z) : 0;

    // Handle different shape types
    switch (shapeDef.type) {
      case 'rect':
        shape = this.createRect(shapeDef, centerX, centerZ, evaluateExpression);
        break;
      case 'circle':
        shape = this.createCircle(shapeDef, centerX, centerZ, evaluateExpression);
        break;
      case 'ellipse':
        shape = this.createEllipse(shapeDef, centerX, centerZ, evaluateExpression);
        break;
      case 'polygon':
        shape = this.createPolygon(shapeDef, evaluateExpression);
        break;
      case 'path':
        shape = this.createPath(shapeDef, centerX, centerZ, evaluateExpression);
        break;
      case 'text':
        // Text shapes are handled specially with hole-aware extrusion
        await this.handleTextShape(extCmd, shapeDef, builder, materials, evaluateExpression, depth, offset, centerX, centerZ);
        return; // Early return - text handling does its own extrusion
      case 'boolean':
        // Boolean shapes may produce holes
        const boolResult = await this.handleBooleanShape(extCmd, shapeDef, builder, materials, evaluateExpression, depth, offset);
        if (boolResult.hasHoles) {
          return; // Early return - boolean with holes does its own extrusion
        }
        shape = boolResult.shape;
        break;
      default:
        throw new Error(`Unknown shape type: ${(shapeDef as any).type}`);
    }

    if (!shape) {
      throw new Error(`Failed to create shape for '${extCmd.shape}'`);
    }

    // Build extrude params
    const extrudeParams: any = {
      depth,
      caps: extCmd.caps || 'both',
      offset
    };

    // Add bevel if specified
    if (extCmd.bevel) {
      extrudeParams.bevel = {
        size: evaluateExpression(extCmd.bevel.size),
        segments: Math.round(evaluateExpression(extCmd.bevel.segments))
      };
    }

    // Extrude the shape
    const extruded = extrude2D(shape, extrudeParams);

    // Get color for faces
    const color = resolveGeometryColor(extCmd.color, materials);

    // Convert to Mesh format
    const meshVertices = extruded.vertices.map((v: any, i: number) => {
      const normal = extruded.normals?.[i];
      return new Vertex(v, { normal });
    });

    const meshFaces = extruded.faces.map((face: number[]) => new Face(face, color));
    const extrudedMesh = new Mesh(meshVertices, meshFaces);

    builder.mergeMesh(extrudeName, extrudedMesh, color);
  }

  private createRect(
    shapeDef: YamlShape,
    centerX: number,
    centerZ: number,
    evaluateExpression: (v: string | number) => number
  ): Shape2D {
    const width = evaluateExpression(shapeDef.width!);
    const height = evaluateExpression(shapeDef.height!);
    return Shape2D.rect(width, height, { x: centerX, z: centerZ });
  }

  private createCircle(
    shapeDef: YamlShape,
    centerX: number,
    centerZ: number,
    evaluateExpression: (v: string | number) => number
  ): Shape2D {
    const radius = evaluateExpression(shapeDef.radius!);
    const segments = typeof shapeDef.segments === 'number'
      ? shapeDef.segments
      : (shapeDef.segments ? Math.round(evaluateExpression(shapeDef.segments as string)) : 32);
    return Shape2D.circle(radius, segments, { x: centerX, z: centerZ });
  }

  private createEllipse(
    shapeDef: YamlShape,
    centerX: number,
    centerZ: number,
    evaluateExpression: (v: string | number) => number
  ): Shape2D {
    const radiusX = evaluateExpression(shapeDef.radiusX!);
    const radiusZ = evaluateExpression(shapeDef.radiusZ!);
    const segments = typeof shapeDef.segments === 'number'
      ? shapeDef.segments
      : (shapeDef.segments ? Math.round(evaluateExpression(shapeDef.segments as string)) : 32);
    return Shape2D.ellipse(radiusX, radiusZ, segments, { x: centerX, z: centerZ });
  }

  private createPolygon(
    shapeDef: YamlShape,
    evaluateExpression: (v: string | number) => number
  ): Shape2D {
    if (!shapeDef.points || shapeDef.points.length < 3) {
      throw new Error(`Polygon shape must have at least 3 points`);
    }
    const points = shapeDef.points.map((pt: any) => ({
      x: evaluateExpression(pt.x),
      z: evaluateExpression(pt.z)
    }));
    return Shape2D.polygon(points);
  }

  private createPath(
    shapeDef: YamlShape,
    centerX: number,
    centerZ: number,
    evaluateExpression: (v: string | number) => number
  ): Shape2D {
    if (!Array.isArray(shapeDef.segments) || shapeDef.segments.length === 0) {
      throw new Error(`Path shape must define segments`);
    }

    const resolvePathPoint = (point: { x: string | number; z: string | number }) => ({
      x: evaluateExpression(point.x) + centerX,
      z: evaluateExpression(point.z) + centerZ
    });

    const pathSegments: PathSegment[] = (shapeDef.segments as YamlPathSegment[]).map(segment => {
      switch (segment.type) {
        case 'moveTo':
          return { type: 'moveTo' as const, point: resolvePathPoint(segment.point) };
        case 'lineTo':
          return { type: 'lineTo' as const, point: resolvePathPoint(segment.point) };
        case 'quadraticCurveTo':
          return {
            type: 'quadraticCurveTo' as const,
            control: resolvePathPoint(segment.control),
            end: resolvePathPoint(segment.end)
          };
        case 'cubicCurveTo':
          return {
            type: 'cubicCurveTo' as const,
            control1: resolvePathPoint(segment.control1),
            control2: resolvePathPoint(segment.control2),
            end: resolvePathPoint(segment.end)
          };
        case 'closePath':
          return { type: 'closePath' as const };
        default:
          throw new Error(`Unknown path segment type: ${(segment as any).type}`);
      }
    });

    const curveSegments = shapeDef.curveSegments !== undefined
      ? (typeof shapeDef.curveSegments === 'number'
        ? shapeDef.curveSegments
        : Math.round(evaluateExpression(shapeDef.curveSegments as string)))
      : 8;

    const path = {
      segments: pathSegments,
      closed: shapeDef.closed ?? true
    };

    return Shape2D.fromPath(path, curveSegments);
  }

  private async handleTextShape(
    extCmd: Extrude2DCommandDef,
    shapeDef: YamlShape,
    builder: TracedBuilder,
    materials: Map<string, RGBColor>,
    evaluateExpression: (v: string | number) => number,
    depth: number,
    offset: number,
    centerX: number,
    centerZ: number
  ): Promise<void> {
    if (!shapeDef.content) {
      throw new Error(`Text shape must have 'content' property`);
    }
    if (!shapeDef.font) {
      throw new Error(`Text shape must have 'font' property`);
    }

    // Resolve content - could be a literal string or a decision reference
    let textContent: string;
    if (typeof shapeDef.content === 'string') {
      const decision = builder.decisions.get(shapeDef.content);
      if (decision !== undefined) {
        textContent = String(decision.value);
      } else {
        textContent = shapeDef.content;
      }
    } else {
      textContent = String(shapeDef.content);
    }

    // Import text functions dynamically
    const { textToShape } = await import('../../text/TextToShape');
    const { extrude2DWithHoles } = await import('../../../platform/geometry/Extrude');

    const size = shapeDef.size !== undefined ? evaluateExpression(shapeDef.size) : 1.0;
    const spacing = shapeDef.spacing !== undefined ? evaluateExpression(shapeDef.spacing) : 0.0;

    // Generate text shape
    const textShape = textToShape(textContent, shapeDef.font, size, spacing, { x: centerX, z: centerZ });

    // Group contours by letter
    const letterGroups: { outer: typeof textShape.contours[0]; holes: typeof textShape.contours }[] = [];
    for (const contour of textShape.contours) {
      if (!contour.isHole) {
        letterGroups.push({ outer: contour, holes: [] });
      } else if (letterGroups.length > 0) {
        letterGroups[letterGroups.length - 1].holes.push(contour);
      }
    }

    if (letterGroups.length === 0) {
      throw new Error(`Text shape has no outer contours`);
    }

    // Build extrude params
    const extrudeParams: any = {
      depth,
      caps: extCmd.caps || 'both',
      offset
    };

    if (extCmd.bevel) {
      extrudeParams.bevel = {
        size: evaluateExpression(extCmd.bevel.size),
        segments: Math.round(evaluateExpression(extCmd.bevel.segments))
      };
    }

    const textColor = resolveGeometryColor(extCmd.color, materials);

    // Extrude each letter with its holes
    for (let groupIdx = 0; groupIdx < letterGroups.length; groupIdx++) {
      const group = letterGroups[groupIdx];
      let extrudedLetter;

      if (group.holes.length > 0) {
        const holePoints = group.holes.map(h => h.points);
        extrudedLetter = extrude2DWithHoles(group.outer.points, holePoints, extrudeParams);
      } else {
        const letterShape = Shape2D.polygon(group.outer.points);
        extrudedLetter = extrude2D(letterShape, extrudeParams);
      }

      const meshVertices = extrudedLetter.vertices.map((v: any, i: number) => {
        const normal = extrudedLetter.normals[i];
        return new Vertex(v, { normal });
      });

      const meshFaces = extrudedLetter.faces.map((face: number[]) => new Face(face, textColor));
      const letterMesh = new Mesh(meshVertices, meshFaces);
      builder.mergeMesh(`${extCmd.extrude2d}_${groupIdx}`, letterMesh, textColor);
    }
  }

  private async handleBooleanShape(
    extCmd: Extrude2DCommandDef,
    shapeDef: YamlShape,
    builder: TracedBuilder,
    materials: Map<string, RGBColor>,
    evaluateExpression: (v: string | number) => number,
    depth: number,
    offset: number
  ): Promise<{ shape: Shape2D | null; hasHoles: boolean }> {
    if (!shapeDef.operation) {
      throw new Error(`Boolean shape must specify 'operation'`);
    }
    if (!shapeDef.subject) {
      throw new Error(`Boolean shape must specify 'subject'`);
    }
    if (!shapeDef.clip && !shapeDef.clips) {
      throw new Error(`Boolean shape must specify 'clip' or 'clips'`);
    }

    // Resolve shapes to polygons with holes
    const resolveShapeToPolygon = (shapeName: string): PolygonWithHoles => {
      const def = (builder as any)._yamlShapes?.get(shapeName);
      if (!def) {
        throw new Error(`Shape '${shapeName}' not found`);
      }

      // Handle nested boolean shapes recursively
      if (def.type === 'boolean') {
        const subjPoly = resolveShapeToPolygon(def.subject);
        const clipNames: string[] = def.clips || (def.clip ? [def.clip] : []);
        const clipPolygons = clipNames.map((c: string) => resolveShapeToPolygon(c));
        return this.applyBooleanOp(def.operation, subjPoly, clipPolygons);
      }

      // Resolve primitive shapes
      const cx = def.center?.x !== undefined ? evaluateExpression(def.center.x) : 0;
      const cz = def.center?.z !== undefined ? evaluateExpression(def.center.z) : 0;

      let points: { x: number; z: number }[];
      switch (def.type) {
        case 'rect': {
          const w = evaluateExpression(def.width!);
          const h = evaluateExpression(def.height!);
          points = Shape2D.rect(w, h, { x: cx, z: cz }).points;
          break;
        }
        case 'circle': {
          const r = evaluateExpression(def.radius!);
          const segs = typeof def.segments === 'number' ? def.segments : 32;
          points = Shape2D.circle(r, segs, { x: cx, z: cz }).points;
          break;
        }
        case 'polygon': {
          points = def.points!.map((pt: any) => ({
            x: evaluateExpression(pt.x),
            z: evaluateExpression(pt.z)
          }));
          break;
        }
        default:
          throw new Error(`Shape type '${def.type}' cannot be used in boolean operations`);
      }
      return { outer: points, holes: [] };
    };

    const subjPoly = resolveShapeToPolygon(shapeDef.subject);
    const clipNames: string[] = shapeDef.clips || (shapeDef.clip ? [shapeDef.clip] : []);
    const clipPolygons = clipNames.map(c => resolveShapeToPolygon(c));

    const boolResult = this.applyBooleanOp(shapeDef.operation!, subjPoly, clipPolygons);

    // Check if result has holes
    if (boolResult.holes && boolResult.holes.length > 0) {
      // Use hole-aware extrusion
      const { extrude2DWithHoles } = await import('../../../platform/geometry/Extrude');

      const extrudeParams: any = {
        depth,
        caps: extCmd.caps || 'both',
        offset
      };

      const extruded = extrude2DWithHoles(boolResult.outer, boolResult.holes, extrudeParams);
      const boolColor = resolveGeometryColor(extCmd.color, materials);

      const meshVertices = extruded.vertices.map((v: any, i: number) => {
        const normal = extruded.normals[i];
        return new Vertex(v, { normal });
      });

      const meshFaces = extruded.faces.map((face: number[]) => new Face(face, boolColor));
      const extrudedMesh = new Mesh(meshVertices, meshFaces);
      builder.mergeMesh(extCmd.extrude2d, extrudedMesh, boolColor);

      return { shape: null, hasHoles: true };
    }

    // No holes - return simple polygon
    return { shape: Shape2D.polygon(boolResult.outer), hasHoles: false };
  }

  private applyBooleanOp(
    operation: string,
    subject: PolygonWithHoles,
    clips: PolygonWithHoles[]
  ): PolygonWithHoles {
    if (operation === 'subtract') {
      let currentOuter = subject.outer;
      let allHoles = [...subject.holes];

      for (const clip of clips) {
        const result = polygonSubtract(currentOuter, clip.outer);
        if (result.length === 0) {
          throw new Error(`Boolean subtract produced empty result`);
        }
        currentOuter = result[0].outer;
        allHoles.push(...result[0].holes);
        allHoles.push(...clip.holes);
      }

      return { outer: currentOuter, holes: allHoles };
    }

    let currentOuter = subject.outer;
    for (const clip of clips) {
      let result: BooleanResult;
      switch (operation) {
        case 'union':
          result = polygonUnion(currentOuter, clip.outer);
          break;
        case 'intersect':
          result = polygonIntersect(currentOuter, clip.outer);
          break;
        default:
          throw new Error(`Unknown boolean operation: ${operation}`);
      }

      if (result.length === 0) {
        throw new Error(`Boolean ${operation} produced empty result`);
      }
      currentOuter = result[0].outer;
    }

    return { outer: currentOuter, holes: subject.holes };
  }
}
