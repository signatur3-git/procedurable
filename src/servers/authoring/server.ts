/**
 * Authoring Server
 *
 * Express server that:
 * - Executes DSL commands via POST /api/execute
 * - Broadcasts events via WebSocket
 * - Provides help via GET /api/help
 *
 * Run with: npx tsx watch src/authoring/server.ts
 */

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { parse as parseYaml } from 'yaml';

import { parseCommand } from './command-parser';
import { registry, CommandContext } from './command-registry';
import { builderNamespace } from './commands/builder';
import { measurementNamespace } from './commands/measurement';
import { decisionNamespace } from './commands/decision';
import { storageNamespace, storage } from './commands/storage';
import { systemNamespace } from './commands/system';
import { mathNamespace } from './commands/math';
import { materialCommands } from './commands/material';
import { worldNamespace } from './commands/world';
import { sceneNamespace } from './commands/scene';
import { geometryNamespace } from './commands/geometry';
import { textNamespace } from './commands/text';
import { parseAndExecuteBuilder, parseYamlWithLibrary } from '../../generation/builder/YamlBuilderParser';
import { TracedOutput } from '../../generation/builder/TracedBuilder';
import { proceduralFontRegistry } from '../../generation/text/ProceduralFont';

// Import only builders that can't be YAML yet
// Person requires advanced geometry (subdivision, lathe) - Phase 2
import { buildPerson } from '../../demos/PersonBuilder';
// buildLeg is used for composition in YAML builders (synchronous requirement)
import { buildLeg } from '../../demos/TableBuilder';

const PORT = 4200;

// Register command namespaces
registry.registerNamespace(builderNamespace);
registry.registerNamespace(measurementNamespace);
registry.registerNamespace(decisionNamespace);
registry.registerNamespace(storageNamespace);
registry.registerNamespace(systemNamespace);
registry.registerNamespace(mathNamespace);
registry.registerNamespace(materialCommands);
registry.registerNamespace(worldNamespace);
registry.registerNamespace(sceneNamespace);
registry.registerNamespace(geometryNamespace);
registry.registerNamespace(textNamespace);

// Global state
let activeBuilder: string | null = null;
let activeBuilderSource: 'yaml' | 'typescript' | null = null;
let lastRun: any = null;
const runHistory: any[] = [];
const measurementOverrides: Map<string, number> = new Map();
const decisionOverrides: Map<string, any> = new Map();

// WebSocket clients
const wsClients = new Set<WebSocket>();

// Registered webhook endpoints (MCP servers register here to get reload notifications)
interface WebhookRegistration {
  url: string;
  registeredAt: Date;
  name?: string;
}
const webhooks = new Map<string, WebhookRegistration>();

/**
 * Notify registered webhooks of an event
 */
async function notifyWebhooks(event: any): Promise<void> {
  const payload = JSON.stringify(event);
  const promises: Promise<void>[] = [];

  for (const [id, webhook] of webhooks) {
    promises.push(
      fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      })
        .then(() => {
          console.log(`  ✓ Notified webhook: ${webhook.name || id}`);
        })
        .catch((err) => {
          console.error(`  ✗ Failed to notify webhook ${webhook.name || id}: ${err.message}`);
        })
    );
  }

  await Promise.all(promises);
}

/**
 * Broadcast an event to all connected WebSocket clients and webhooks
 */
async function broadcast(event: any): Promise<void> {
  const message = JSON.stringify(event);

  // Send to WebSocket clients
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }

  // Send to webhooks
  if (webhooks.size > 0) {
    await notifyWebhooks(event);
  }
}

/**
 * Get a builder by name
 */
function getBuilder(name: string): any {
  if (name === 'DiningChair') {
    return { name: 'DiningChair' };
  }
  return null;
}

/**
 * Run a builder
 * Run a builder with both persistent and per-run overrides
 * @param source - Force 'yaml' or 'typescript' source (if not specified, uses old priority logic)
 */
async function runBuilder(name: string, seed: number, perRunOverrides?: Record<string, any>, source?: 'yaml' | 'typescript'): Promise<any> {
  // Merge persistent overrides with per-run overrides (per-run takes precedence)
  const allOverrides: Record<string, any> = {};

  // Add persistent measurement overrides
  for (const [key, value] of measurementOverrides) {
    allOverrides[key] = value;
  }

  // Add persistent decision overrides
  for (const [key, value] of decisionOverrides) {
    allOverrides[key] = value;
  }

  // Add per-run overrides (these take precedence)
  if (perRunOverrides) {
    Object.assign(allOverrides, perRunOverrides);
  }

  console.log(`🔧 runBuilder: ${name}, seed=${seed}, overrides=`, JSON.stringify(allOverrides));

  // If source is explicitly 'yaml', use YAML builder
  if (source === 'yaml') {
    return await runYamlBuilder(name, seed, allOverrides);
  }

  // Person still requires TypeScript (advanced geometry - Phase 2)
  if (name === 'Person') {
    return buildPerson(seed, allOverrides);
  }

  // All other builders: try YAML first (this is the migration target)
  try {
    const exists = await storage.exists(name);
    if (exists) {
      return await runYamlBuilder(name, seed, allOverrides);
    }
  } catch (e: any) {
    if (e && e.message && !e.message.includes('not found')) {
      throw e;
    }
  }

  throw new Error(`Unknown builder: ${name}. Use 'builder.list' to see available builders or check storage with 'storage.list'.`);
}

/**
 * Run a YAML builder from storage
 */
async function runYamlBuilder(name: string, seed: number, overrides?: Record<string, any>): Promise<any> {
  const stored = await storage.get(name);
  const definition = await parseYamlWithLibrary(stored.content);

  return await parseAndExecuteBuilder(definition, {
    seed,
    overrides,
    builderResolver: (subName) => {
      // Leg uses TypeScript (synchronous, simple geometry)
      if (subName === 'Leg') {
        // Wrap sync builder in async
        return async (subSeed: number, subOverrides?: Record<string, any>) => {
          return buildLeg(subSeed, subOverrides);
        };
      }

      // Check if this builder is in the YAML cache
      const cachedBuilder = yamlBuilderCache.get(subName);
      if (cachedBuilder) {
        // Create an async wrapper that runs the cached YAML builder
        return async (subSeed: number, subOverrides?: Record<string, any>) => {
          return await parseAndExecuteBuilder(cachedBuilder, {
            seed: subSeed,
            overrides: subOverrides,
            // Recursive resolver for nested compositions
            builderResolver: createBuilderResolver()
          });
        };
      }

      return null;
    }
  });
}

/**
 * Create a builder resolver function for nested compositions
 */
function createBuilderResolver(): (name: string) => ((seed: number, overrides?: Record<string, any>) => Promise<TracedOutput>) | null {
  return (subName: string) => {
    if (subName === 'Leg') {
      // Wrap sync builder in async
      return async (subSeed: number, subOverrides?: Record<string, any>) => {
        return buildLeg(subSeed, subOverrides);
      };
    }

    const cachedBuilder = yamlBuilderCache.get(subName);
    if (cachedBuilder) {
      return async (subSeed: number, subOverrides?: Record<string, any>) => {
        return await parseAndExecuteBuilder(cachedBuilder, {
          seed: subSeed,
          overrides: subOverrides,
          builderResolver: createBuilderResolver()
        });
      };
    }

    return null;
  };
}

// Cache for pre-loaded YAML builder definitions
const yamlBuilderCache = new Map<string, any>();

/**
 * Invalidate a cached builder definition
 * Called when a YAML file changes on disk
 */
async function invalidateBuilderCache(name: string, event: 'created' | 'modified' | 'deleted'): Promise<void> {
  if (event === 'deleted') {
    if (yamlBuilderCache.has(name)) {
      yamlBuilderCache.delete(name);
      console.log(`  Cache invalidated (deleted): ${name}`);
    }
  } else {
    // For created or modified, reload the builder
    try {
      const stored = await storage.get(name);
      const definition = await parseYamlWithLibrary(stored.content);
      yamlBuilderCache.set(name, definition);
      console.log(`  Cache ${event === 'created' ? 'added' : 'reloaded'}: ${name}`);
    } catch (e: any) {
      console.warn(`  Failed to reload ${name}: ${e.message}`);
      // Remove from cache if we can't load it
      yamlBuilderCache.delete(name);
    }
  }

  // Notify webhooks of hot reload
  await broadcast({
    type: 'hot_reload',
    builder: name,
    event,
    timestamp: new Date().toISOString()
  });
}

/**
 * Set up file watcher to invalidate cache on changes
 */
function setupCacheInvalidation(): void {
  storage.watch((name, event) => {
    console.log(`  File change detected: ${name} (${event})`);
    invalidateBuilderCache(name, event).catch(err => {
      console.error(`  Error handling file change for ${name}:`, err);
    });
  });
  console.log('  File watcher connected for hot reload');
}

/**
 * Pre-load YAML builder definitions for composition support
 * Now dynamically loads all available YAML builders
 */
async function preloadYamlBuilders(): Promise<void> {
  // Get all available builders from storage
  const listResult = await storage.list();

  for (const builderInfo of listResult.builders) {
    try {
      const stored = await storage.get(builderInfo.name);
      const definition = await parseYamlWithLibrary(stored.content);
      yamlBuilderCache.set(builderInfo.name, definition);
      console.log(`  Pre-loaded YAML builder: ${builderInfo.name}`);
    } catch (e: any) {
      console.warn(`  Failed to pre-load ${builderInfo.name}: ${e.message}`);
    }
  }
}

/**
 * Create command context
 */
function createContext(): CommandContext {
  return {
    activeBuilder,
    activeBuilderSource,
    lastRun,
    runHistory,
    measurementOverrides,
    decisionOverrides,
    getBuilder,
    runBuilder,
    broadcast
  };
}

/**
 * Execute a batch of commands
 */
async function executeCommands(commands: string[]): Promise<{ command: string; status: string; data?: any; error?: string }[]> {
  const results: any[] = [];
  const ctx = createContext();

  for (const cmdStr of commands) {
    const parseResult = parseCommand(cmdStr);

    if (!parseResult.success) {
      results.push({
        command: cmdStr,
        status: 'error',
        error: parseResult.error.message
      });
      continue;
    }

    const execResult = await registry.execute(parseResult.command, ctx);

    // Update global state from context
    activeBuilder = ctx.activeBuilder;
    activeBuilderSource = ctx.activeBuilderSource;
    lastRun = ctx.lastRun;

    results.push({
      command: cmdStr,
      status: execResult.success ? 'ok' : 'error',
      data: execResult.data,
      error: execResult.error
    });
  }

  return results;
}

// Create Express app
const app = express();
// Increase body size limit to 50MB to handle large mesh data and builder outputs
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ type: 'application/x-yaml', limit: '50mb' }));

// CORS for local development
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

/**
 * POST /api/execute
 */
app.post('/api/execute', async (req, res): Promise<void> => {
  let commands: string[];

  if (typeof req.body === 'string') {
    try {
      const parsed = parseYaml(req.body);
      commands = parsed.commands || [];
    } catch (err: any) {
      res.status(400).json({ error: `YAML parse error: ${err.message}` });
      return;
    }
  } else if (req.body.commands) {
    commands = req.body.commands;
  } else if (Array.isArray(req.body)) {
    commands = req.body;
  } else {
    res.status(400).json({ error: 'Expected { commands: [...] } or YAML' });
    return;
  }

  if (!Array.isArray(commands)) {
    res.status(400).json({ error: 'commands must be an array' });
    return;
  }

  console.log(`Executing ${commands.length} commands:`, commands);
  const results = await executeCommands(commands);

  // Broadcast commands to connected dashboards
  broadcast({
    type: 'commands_executed',
    commands: results
  });

  res.json({ results });
});

/**
 * GET /api/help
 */
app.get('/api/help', (_req, res) => {
  res.json(registry.getHelp());
});

/**
 * GET /api/state
 */
app.get('/api/state', (_req, res) => {
  res.json({
    activeBuilder,
    hasLastRun: lastRun !== null,
    historyCount: runHistory.length,
    lastRunSeed: lastRun?.seed,
    connectedClients: wsClients.size
  });
});

/**
 * GET /health
 */
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    server: 'authoring',
    port: PORT,
    namespaces: registry.getNamespaces(),
    wsClients: wsClients.size,
    webhooks: webhooks.size
  });
});

/**
 * POST /api/webhooks/register
 * Register a webhook to receive hot reload notifications
 */
app.post('/api/webhooks/register', (req, res) => {
  const { url, name } = req.body;

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing or invalid "url" field' });
    return;
  }

  // Generate unique ID
  const id = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  webhooks.set(id, {
    url,
    name: name || 'unknown',
    registeredAt: new Date()
  });

  console.log(`✓ Webhook registered: ${name || 'unknown'} (${id})`);
  console.log(`  URL: ${url}`);

  res.json({
    success: true,
    id,
    message: 'Webhook registered successfully'
  });
});

/**
 * POST /api/webhooks/unregister
 * Unregister a webhook
 */
app.post('/api/webhooks/unregister', (req, res) => {
  const { id } = req.body;

  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'Missing or invalid "id" field' });
    return;
  }

  const existed = webhooks.delete(id);

  if (existed) {
    console.log(`✓ Webhook unregistered: ${id}`);
    res.json({ success: true, message: 'Webhook unregistered' });
  } else {
    res.status(404).json({ error: 'Webhook not found' });
  }
});

/**
 * GET /api/webhooks/list
 * List all registered webhooks
 */
app.get('/api/webhooks/list', (_req, res) => {
  res.json({
    webhooks: Array.from(webhooks.entries()).map(([id, wh]) => ({
      id,
      url: wh.url,
      name: wh.name,
      registeredAt: wh.registeredAt
    }))
  });
});

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  wsClients.add(ws);

  ws.send(JSON.stringify({
    type: 'connected',
    state: { activeBuilder, hasLastRun: lastRun !== null }
  }));

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'execute' && msg.commands) {
        const results = await executeCommands(msg.commands);
        ws.send(JSON.stringify({ type: 'execute_result', results }));
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    wsClients.delete(ws);
  });
});

// Start server
server.listen(PORT, async () => {
  console.log(`\n🔧 Authoring Server running at http://127.0.0.1:${PORT}`);
  console.log(`   POST /api/execute  - Execute DSL commands`);
  console.log(`   GET  /api/help     - List available commands`);
  console.log(`   GET  /api/state    - Current state`);
  console.log(`   WS   /ws           - WebSocket for real-time updates`);
  console.log(`\nRegistered namespaces: ${registry.getNamespaces().join(', ')}`);

  // Pre-load YAML builders for composition support
  console.log('\nPre-loading YAML builders for composition...');
  await preloadYamlBuilders();

  // Initialize procedural fonts (built-in letter shapes)
  console.log('\nInitializing procedural fonts...');
  await proceduralFontRegistry.initialize('./builders');

  // Set up hot reload - invalidate cache when files change
  console.log('\nSetting up hot reload...');
  setupCacheInvalidation();

  console.log('\nReady!\n');
});

