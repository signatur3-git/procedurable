/**
 * Scene query commands for semantic scene graph
 * P2-M2d-005 Phase 3 + B1-003 Goal-seeking placement primitives
 */

import { CommandNamespace, CommandHandler, CommandResult } from '../command-registry';
import { ParsedCommand, getArg, getNumberOption } from '../command-parser';
import { Vec3 } from '../../../platform/math/Vec3';
import { AABB } from '../../../platform/math/AABB';
import { placeAroundRectangle, placeAroundCircle } from '../../../platform/scene/Placement';
import { poissonDiskSample } from '../../../platform/spatial/Scatter';

const handlers: CommandHandler[] = [
  {
    action: 'query_by_tag',
    description: 'Find scene nodes by tag',
    usage: 'scene.query_by_tag <tag>',
    execute: async (cmd: ParsedCommand, context: any): Promise<CommandResult> => {
      const tag = getArg(cmd, 0);
      if (!tag) {
        return { success: false, error: 'Usage: scene.query_by_tag <tag>' };
      }

      if (!context.lastRun?.output?.sceneGraph) {
        return { success: false, error: 'No scene graph available. Run a builder first.' };
      }

      const nodes = context.lastRun.output.sceneGraph.getNodesByTag(tag);

      return {
        success: true,
        data: {
          tag,
          count: nodes.length,
          nodes: nodes.map((node: any) => ({
            id: node.id,
            name: node.name,
            tags: node.tags,
            bounds: {
              min: { x: node.bounds.min.x, y: node.bounds.min.y, z: node.bounds.min.z },
              max: { x: node.bounds.max.x, y: node.bounds.max.y, z: node.bounds.max.z }
            },
            transform: node.transform,
            builderName: node.builderName
          }))
        }
      };
    }
  },

  {
    action: 'query_by_name',
    description: 'Find scene nodes by name pattern',
    usage: 'scene.query_by_name <pattern>',
    execute: async (cmd: ParsedCommand, context: any): Promise<CommandResult> => {
      const namePattern = getArg(cmd, 0);
      if (!namePattern) {
        return { success: false, error: 'Usage: scene.query_by_name <pattern>' };
      }

      if (!context.lastRun?.output?.sceneGraph) {
        return { success: false, error: 'No scene graph available. Run a builder first.' };
      }

      const nodes = context.lastRun.output.sceneGraph.findNodesByName(namePattern);

      return {
        success: true,
        data: {
          pattern: namePattern,
          count: nodes.length,
          nodes: nodes.map((node: any) => ({
            id: node.id,
            name: node.name,
            tags: node.tags,
            bounds: {
              min: { x: node.bounds.min.x, y: node.bounds.min.y, z: node.bounds.min.z },
              max: { x: node.bounds.max.x, y: node.bounds.max.y, z: node.bounds.max.z }
            },
            transform: node.transform
          }))
        }
      };
    }
  },

  {
    action: 'query_by_tags',
    description: 'Find scene nodes by multiple tags (AND)',
    usage: 'scene.query_by_tags <tag1,tag2,...>',
    execute: async (cmd: ParsedCommand, context: any): Promise<CommandResult> => {
      const tagsArg = getArg(cmd, 0);
      if (!tagsArg) {
        return { success: false, error: 'Usage: scene.query_by_tags <tag1,tag2,...>' };
      }

      const tags = tagsArg.split(',').map((t: string) => t.trim());

      if (!context.lastRun?.output?.sceneGraph) {
        return { success: false, error: 'No scene graph available. Run a builder first.' };
      }

      const nodes = context.lastRun.output.sceneGraph.getNodesByTags(tags);

      return {
        success: true,
        data: {
          tags,
          count: nodes.length,
          nodes: nodes.map((node: any) => ({
            id: node.id,
            name: node.name,
            tags: node.tags,
            transform: node.transform
          }))
        }
      };
    }
  },

  {
    action: 'query_nearby',
    description: 'Find scene nodes near a point',
    usage: 'scene.query_nearby <x,y,z> radius=<r>',
    execute: async (cmd: ParsedCommand, context: any): Promise<CommandResult> => {
      const posArg = getArg(cmd, 0);
      if (!posArg) {
        return { success: false, error: 'Usage: scene.query_nearby <x,y,z> radius=<r>' };
      }

      const [x, y, z] = posArg.split(',').map(Number);
      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        return { success: false, error: 'Invalid position format. Use: x,y,z' };
      }

      const radius = getNumberOption(cmd, 'radius') ?? 1.0;

      if (!context.lastRun?.output?.sceneGraph) {
        return { success: false, error: 'No scene graph available. Run a builder first.' };
      }

      const center = new Vec3(x, y, z);
      const nodes = context.lastRun.output.sceneGraph.findNodesNearby(center, radius);

      return {
        success: true,
        data: {
          center: { x, y, z },
          radius,
          count: nodes.length,
          nodes: nodes.map((node: any) => ({
            id: node.id,
            name: node.name,
            tags: node.tags,
            transform: node.transform,
            distance: center.distance(node.transform.position)
          }))
        }
      };
    }
  },

  {
    action: 'query_facing',
    description: 'Find scene nodes facing a direction',
    usage: 'scene.query_facing <x,y,z> angle=<degrees>',
    execute: async (cmd: ParsedCommand, context: any): Promise<CommandResult> => {
      const dirArg = getArg(cmd, 0);
      if (!dirArg) {
        return { success: false, error: 'Usage: scene.query_facing <x,y,z> angle=<degrees>' };
      }

      const [x, y, z] = dirArg.split(',').map(Number);
      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        return { success: false, error: 'Invalid direction format. Use: x,y,z' };
      }

      const angleDeg = getNumberOption(cmd, 'angle') ?? 45;
      const angleRad = (angleDeg * Math.PI) / 180;

      if (!context.lastRun?.output?.sceneGraph) {
        return { success: false, error: 'No scene graph available. Run a builder first.' };
      }

      const direction = new Vec3(x, y, z);
      const nodes = context.lastRun.output.sceneGraph.findNodesFacing(direction, angleRad);

      return {
        success: true,
        data: {
          direction: { x, y, z },
          angleTolerance: angleDeg,
          count: nodes.length,
          nodes: nodes.map((node: any) => ({
            id: node.id,
            name: node.name,
            tags: node.tags,
            transform: node.transform
          }))
        }
      };
    }
  },

  {
    action: 'tags',
    description: 'List all available tags in the scene',
    usage: 'scene.tags',
    execute: async (_cmd: ParsedCommand, context: any): Promise<CommandResult> => {
      if (!context.lastRun?.output?.sceneGraph) {
        return { success: false, error: 'No scene graph available. Run a builder first.' };
      }

      const tags = context.lastRun.output.sceneGraph.getAllTags();

      return {
        success: true,
        data: {
          count: tags.length,
          tags: tags.sort()
        }
      };
    }
  },

  {
    action: 'info',
    description: 'Get scene graph statistics',
    usage: 'scene.info',
    execute: async (_cmd: ParsedCommand, context: any): Promise<CommandResult> => {
      if (!context.lastRun?.output?.sceneGraph) {
        return { success: false, error: 'No scene graph available. Run a builder first.' };
      }

      const graph = context.lastRun.output.sceneGraph;
      const rootNodes = graph.getRootNodes();

      return {
        success: true,
        data: {
          nodeCount: graph.size(),
          tagCount: graph.getAllTags().length,
          rootNodeCount: rootNodes.length,
          tags: graph.getAllTags().sort()
        }
      };
    }
  },

  // ========================================================================
  // GOAL-SEEKING PLACEMENT PRIMITIVES (B1-003)
  // ========================================================================

  {
    action: 'place_around',
    description: 'Place N objects in a ring around a center point',
    usage: 'scene.place_around count=<n> center=<x,y,z> radius=<r> [shape=rect|circle] [width=<w>] [depth=<d>] size=<sx,sy,sz> [minDist=<d>] [seed=<n>]',
    execute: async (cmd: ParsedCommand, _context: any): Promise<CommandResult> => {
      const count = getNumberOption(cmd, 'count');
      const centerArg = cmd.options['center'];
      const radius = getNumberOption(cmd, 'radius');
      const sizeArg = cmd.options['size'];
      const shape = cmd.options['shape'] || 'circle';

      // Validate required parameters
      if (!count || !centerArg || !radius || !sizeArg) {
        return {
          success: false,
          error: 'Usage: scene.place_around count=<n> center=<x,y,z> radius=<r> size=<sx,sy,sz> [shape=rect|circle] [width=<w>] [depth=<d>] [minDist=<d>] [seed=<n>]'
        };
      }

      // Parse center position
      const centerParts = centerArg.split(',').map(Number);
      if (centerParts.length !== 3 || centerParts.some(isNaN)) {
        return { success: false, error: 'Invalid center format. Use: x,y,z' };
      }
      const center = new Vec3(centerParts[0], centerParts[1], centerParts[2]);

      // Parse object size (bounding box)
      const sizeParts = sizeArg.split(',').map(Number);
      if (sizeParts.length !== 3 || sizeParts.some(isNaN)) {
        return { success: false, error: 'Invalid size format. Use: sx,sy,sz' };
      }
      const objectAABB = new AABB(
        new Vec3(-sizeParts[0]/2, -sizeParts[1]/2, -sizeParts[2]/2),
        new Vec3(sizeParts[0]/2, sizeParts[1]/2, sizeParts[2]/2)
      );

      // Optional parameters
      const minDistance = getNumberOption(cmd, 'minDist') ?? 0.1;
      const seed = getNumberOption(cmd, 'seed') ?? Date.now();

      // Placement config
      const config = {
        minDistance,
        maxAttempts: 100,
        allowReducedCount: true,
        seed
      };

      let result;
      if (shape === 'rect' || shape === 'rectangle') {
        // Rectangular placement
        const width = getNumberOption(cmd, 'width') ?? radius * 2;
        const depth = getNumberOption(cmd, 'depth') ?? radius * 2;
        result = placeAroundRectangle(center, width, depth, objectAABB, count, config);
      } else {
        // Circular placement (default)
        result = placeAroundCircle(center, radius, objectAABB, count, config);
      }

      return {
        success: result.success,
        data: {
          count: result.placements.length,
          requested: count,
          rejected: result.rejected,
          placements: result.placements.map(p => ({
            position: { x: p.position.x, y: p.position.y, z: p.position.z },
            rotation: p.rotation,
            rotationDeg: (p.rotation * 180 / Math.PI).toFixed(1)
          })),
          reason: result.reason
        }
      };
    }
  },

  {
    action: 'place_along',
    description: 'Place objects along a line or path with spacing',
    usage: 'scene.place_along count=<n> start=<x,y,z> end=<x,y,z> size=<sx,sy,sz> [spacing=<s>] [facing=forward|start|end] [seed=<n>]',
    execute: async (cmd: ParsedCommand, _context: any): Promise<CommandResult> => {
      const count = getNumberOption(cmd, 'count');
      const startArg = cmd.options['start'];
      const endArg = cmd.options['end'];
      const sizeArg = cmd.options['size'];

      if (!count || !startArg || !endArg || !sizeArg) {
        return {
          success: false,
          error: 'Usage: scene.place_along count=<n> start=<x,y,z> end=<x,y,z> size=<sx,sy,sz> [spacing=<s>] [facing=forward|start|end]'
        };
      }

      // Parse start position
      const startParts = startArg.split(',').map(Number);
      if (startParts.length !== 3 || startParts.some(isNaN)) {
        return { success: false, error: 'Invalid start format. Use: x,y,z' };
      }
      const start = new Vec3(startParts[0], startParts[1], startParts[2]);

      // Parse end position
      const endParts = endArg.split(',').map(Number);
      if (endParts.length !== 3 || endParts.some(isNaN)) {
        return { success: false, error: 'Invalid end format. Use: x,y,z' };
      }
      const end = new Vec3(endParts[0], endParts[1], endParts[2]);

      // Parse object size
      const sizeParts = sizeArg.split(',').map(Number);
      if (sizeParts.length !== 3 || sizeParts.some(isNaN)) {
        return { success: false, error: 'Invalid size format. Use: sx,sy,sz' };
      }

      const spacing = getNumberOption(cmd, 'spacing');
      const facing = cmd.options['facing'] || 'forward';

      // Calculate positions along the line
      const direction = end.sub(start);
      const lineLength = direction.length();
      const normalizedDir = direction.div(lineLength);

      // Determine spacing strategy
      let actualSpacing: number;
      let actualCount: number;

      if (spacing !== undefined) {
        // Fixed spacing - calculate how many fit
        actualSpacing = spacing;
        actualCount = Math.floor(lineLength / spacing) + 1;
        actualCount = Math.min(actualCount, count);
      } else {
        // Distribute evenly along the line
        actualCount = count;
        actualSpacing = count > 1 ? lineLength / (count - 1) : 0;
      }

      // Calculate rotation based on facing mode
      let rotation: number;
      if (facing === 'start') {
        // Face back toward start
        rotation = Math.atan2(-normalizedDir.x, -normalizedDir.z);
      } else if (facing === 'end') {
        // Face forward toward end
        rotation = Math.atan2(normalizedDir.x, normalizedDir.z);
      } else {
        // 'forward' or default - no rotation
        rotation = 0;
      }

      const placements = [];
      for (let i = 0; i < actualCount; i++) {
        const t = actualCount > 1 ? i / (actualCount - 1) : 0.5;
        const position = start.add(direction.mul(t));
        placements.push({
          position: { x: position.x, y: position.y, z: position.z },
          rotation,
          rotationDeg: (rotation * 180 / Math.PI).toFixed(1),
          t
        });
      }

      return {
        success: true,
        data: {
          count: placements.length,
          requested: count,
          lineLength: lineLength.toFixed(3),
          spacing: actualSpacing.toFixed(3),
          placements
        }
      };
    }
  },

  {
    action: 'fill_area',
    description: 'Scatter-fill an area with objects at a given density',
    usage: 'scene.fill_area bounds=<xMin,zMin,xMax,zMax> density=<d> size=<sx,sy,sz> [minDist=<d>] [seed=<n>]',
    execute: async (cmd: ParsedCommand, _context: any): Promise<CommandResult> => {
      const boundsArg = cmd.options['bounds'];
      const density = getNumberOption(cmd, 'density');
      const sizeArg = cmd.options['size'];

      if (!boundsArg || !density || !sizeArg) {
        return {
          success: false,
          error: 'Usage: scene.fill_area bounds=<xMin,zMin,xMax,zMax> density=<d> size=<sx,sy,sz> [minDist=<d>] [seed=<n>]'
        };
      }

      // Parse bounds
      const boundsParts = boundsArg.split(',').map(Number);
      if (boundsParts.length !== 4 || boundsParts.some(isNaN)) {
        return { success: false, error: 'Invalid bounds format. Use: xMin,zMin,xMax,zMax' };
      }
      const [minX, minZ, maxX, maxZ] = boundsParts;

      // Parse object size
      const sizeParts = sizeArg.split(',').map(Number);
      if (sizeParts.length !== 3 || sizeParts.some(isNaN)) {
        return { success: false, error: 'Invalid size format. Use: sx,sy,sz' };
      }
      const [sizeX, , sizeZ] = sizeParts;

      // Optional parameters
      const minDistance = getNumberOption(cmd, 'minDist') ?? Math.max(sizeX, sizeZ);
      const seed = getNumberOption(cmd, 'seed') ?? Date.now();

      // Use Poisson disk sampling for natural distribution
      const scatterBounds = {
        minX,
        maxX,
        minZ,
        maxZ
      };

      const points = poissonDiskSample(scatterBounds, {
        minDistance,
        seed,
        densityMask: () => density  // Uniform density
      });

      // Convert to 3D positions (Y = 0 by default)
      const placements = points.map(p => ({
        position: { x: p.x, y: 0, z: p.z },
        rotation: 0,  // No rotation for scatter
        rotationDeg: '0.0'
      }));

      return {
        success: true,
        data: {
          count: placements.length,
          density,
          area: ((maxX - minX) * (maxZ - minZ)).toFixed(2),
          minDistance: minDistance.toFixed(3),
          placements
        }
      };
    }
  },

  // B5-001: Query ports (attachment points)
  {
    action: 'get_ports',
    description: 'Get attachment ports from the last builder run (B5-001)',
    usage: 'scene.get_ports [prim_path]',
    execute: async (_cmd: ParsedCommand, context: any): Promise<CommandResult> => {
      if (!context.lastRun) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      const output = context.lastRun;
      const ports: any[] = [];

      // Get ports from TracedOutput
      if (output.ports) {
        for (const [name, port] of output.ports) {
          ports.push({
            name,
            position: { x: port.position.x, y: port.position.y, z: port.position.z },
            normal: { x: port.normal.x, y: port.normal.y, z: port.normal.z },
            up: port.up ? { x: port.up.x, y: port.up.y, z: port.up.z } : undefined,
            loop: port.loop,
            metadata: port.metadata
          });
        }
      }

      return {
        success: true,
        data: {
          builderName: output.builderName,
          count: ports.length,
          ports
        }
      };
    }
  },

  // G2-001: Generate scene at specific LOD tier
  {
    action: 'generate_at_lod',
    description: 'Re-generate the current scene at a specific LOD tier (G2-001)',
    usage: 'scene.generate_at_lod <tier> [seed=<n>]',
    execute: async (cmd: ParsedCommand, context: any): Promise<CommandResult> => {
      if (!context.activeBuilder) {
        return { success: false, error: 'No builder is open. Use builder.open <name> first.' };
      }

      const tierArg = getArg(cmd, 0);
      if (!tierArg) {
        return { success: false, error: 'Usage: scene.generate_at_lod <tier> [seed=<n>]. Tier is 0-4.' };
      }

      const tier = parseInt(tierArg, 10);
      if (isNaN(tier) || tier < 0 || tier > 4) {
        return { success: false, error: 'Tier must be a number from 0 to 4.' };
      }

      // Get seed from options or use last run seed or current time
      let seed = getNumberOption(cmd, 'seed');
      if (seed === undefined) {
        seed = context.lastRun?.seed ?? Date.now();
      }

      try {
        // Run builder with LOD budget override
        const overrides: Record<string, any> = {
          __lod_budget__: tier
        };

        const result = await context.runBuilder(
          context.activeBuilder,
          seed,
          overrides,
          context.activeBuilderSource || undefined
        );

        context.lastRun = result;
        context.runHistory.push(result);

        // Keep history limited
        if (context.runHistory.length > 20) {
          context.runHistory.shift();
        }

        // Broadcast update
        context.broadcast({
          type: 'builder_run',
          builder: context.activeBuilder,
          seed,
          lodBudget: tier,
          summary: {
            vertices: result.validation.vertexCount,
            faces: result.validation.faceCount,
            issues: result.validation.issues.length
          }
        });

        // Count skipped compositions
        let skippedCount = 0;
        for (const [key] of result.measurements) {
          if (key.startsWith('__lod_skipped__')) {
            skippedCount++;
          }
        }

        return {
          success: true,
          data: {
            builder: context.activeBuilder,
            seed,
            lodBudget: tier,
            vertices: result.validation.vertexCount,
            faces: result.validation.faceCount,
            bounds: {
              width: result.validation.bounds.size.x.toFixed(3) + 'm',
              height: result.validation.bounds.size.y.toFixed(3) + 'm',
              depth: result.validation.bounds.size.z.toFixed(3) + 'm'
            },
            skippedCompositions: skippedCount,
            message: skippedCount > 0
              ? `Generated at LOD ${tier}. ${skippedCount} composition(s) skipped due to lod_min constraint.`
              : `Generated at LOD ${tier}.`
          }
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Generation failed: ${err.message}`
        };
      }
    }
  }
];

export const sceneNamespace: CommandNamespace = {
  name: 'scene',
  description: 'Query semantic scene graph and goal-seeking placement',
  handlers
};
