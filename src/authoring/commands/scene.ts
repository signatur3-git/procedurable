/**
 * Scene query commands for semantic scene graph
 * P2-M2d-005 Phase 3
 */

import { CommandNamespace, CommandHandler, CommandResult } from '../command-registry';
import { ParsedCommand, getArg, getNumberOption } from '../command-parser';
import { Vec3 } from '../../core/Vec3';

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
  }
];

export const sceneNamespace: CommandNamespace = {
  name: 'scene',
  description: 'Query semantic scene graph',
  handlers
};
