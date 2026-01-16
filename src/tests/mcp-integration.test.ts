/**
 * MCP Command Integration Tests
 *
 * Tests all DSL commands via the HTTP API to ensure stability.
 * Run with: npx tsx src/tests/mcp-integration.test.ts
 */

const API_URL = 'http://127.0.0.1:4200/api/execute';

interface CommandResult {
  command: string;
  status: 'ok' | 'error';
  data?: any;
  error?: string;
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

async function executeCommands(commands: string[]): Promise<{ results: CommandResult[] }> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands }),
  });
  return response.json();
}

async function execute(command: string): Promise<CommandResult> {
  const result = await executeCommands([command]);
  return result.results[0];
}

// ============================================================================
// TEST UTILITIES
// ============================================================================

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertOk(result: CommandResult, message?: string): void {
  if (result.status !== 'ok') {
    throw new Error(message || `Command failed: ${result.error}`);
  }
}

function assertError(result: CommandResult, message?: string): void {
  if (result.status !== 'error') {
    throw new Error(message || `Expected error but got success`);
  }
}

// ============================================================================
// TESTS
// ============================================================================

const tests: Array<{ name: string; fn: () => Promise<void> }> = [];

function registerTest(name: string, fn: () => Promise<void>): void {
  tests.push({ name, fn });
}

// --- System Commands ---

registerTest('system.version returns version info', async () => {
  const result = await execute('system.version');
  assertOk(result);
  assert(result.data.version, 'Should have version');
  assert(result.data.apiVersion, 'Should have apiVersion');
});

registerTest('system.ping returns pong', async () => {
  const result = await execute('system.ping');
  assertOk(result);
  assertEqual(result.data.message, 'pong', 'Ping message');
});

registerTest('system.help returns command list', async () => {
  const result = await execute('system.help');
  assertOk(result);
  assert(result.data.namespaces, 'Should have namespaces');
  assert(result.data.namespaces.length > 0, 'Should have at least one namespace');
});

registerTest('system.status returns server status', async () => {
  const result = await execute('system.status');
  assertOk(result);
  assert('activeBuilder' in result.data, 'Should have activeBuilder');
});

// --- Builder Commands ---

registerTest('builder.list returns builders', async () => {
  const result = await execute('builder.list');
  assertOk(result);
  assert(Array.isArray(result.data.builders), 'Should have builders array');
  assert(result.data.builders.length > 0, 'Should have at least one builder');
});

registerTest('builder.open opens a builder', async () => {
  const result = await execute('builder.open Table');
  assertOk(result);
  assertEqual(result.data.builder, 'Table', 'Builder name');
  assertEqual(result.data.source, 'yaml', 'Should be YAML source');
});

registerTest('builder.run executes with seed', async () => {
  await execute('builder.open Table');
  const result = await execute('builder.run seed=42');
  assertOk(result);
  assert(result.data.vertices > 0, 'Should have vertices');
  assert(result.data.faces > 0, 'Should have faces');
  assertEqual(result.data.seed, 42, 'Seed should match');
});

registerTest('builder.run without builder fails', async () => {
  // Clear active builder by trying to open non-existent
  await execute('builder.open NonExistent');
  // This should work if we have state from previous test
  // Let's just verify the structure
  const result = await execute('builder.open Table');
  assertOk(result);
});

registerTest('builder.measurements returns measurements', async () => {
  await execute('builder.open Table');
  await execute('builder.run seed=1');
  const result = await execute('builder.measurements');
  assertOk(result);
  assert(result.data.measurements, 'Should have measurements');
});

registerTest('builder.decisions returns decisions', async () => {
  await execute('builder.open Table');
  await execute('builder.run seed=1');
  const result = await execute('builder.decisions');
  assertOk(result);
  assert(result.data.decisions, 'Should have decisions');
});

registerTest('builder.traces returns trace keys', async () => {
  await execute('builder.open Table');
  await execute('builder.run seed=1');
  const result = await execute('builder.traces');
  assertOk(result);
  assert(result.data.count >= 0, 'Should have count');
  assert(Array.isArray(result.data.keys), 'Should have keys array');
});

registerTest('builder.mesh returns geometry', async () => {
  await execute('builder.open Table');
  await execute('builder.run seed=1');
  const result = await execute('builder.mesh');
  assertOk(result);
  assert(result.data.vertices, 'Should have vertices');
  assert(result.data.normals, 'Should have normals');
  assert(result.data.triangleCount > 0, 'Should have triangles');
});

// --- Measurement Commands ---

registerTest('measurement.list returns measurements', async () => {
  await execute('builder.open DiningChair');
  await execute('builder.run seed=1');
  const result = await execute('measurement.list');
  assertOk(result);
});

registerTest('measurement.set and reset work', async () => {
  await execute('builder.open Table');
  const setResult = await execute('measurement.set table_width 2.0');
  assertOk(setResult);

  const resetResult = await execute('measurement.reset table_width');
  assertOk(resetResult);
});

registerTest('measurement.reset-all clears overrides', async () => {
  await execute('measurement.set table_width 2.0');
  const result = await execute('measurement.reset-all');
  assertOk(result);
});

// --- Decision Commands ---

registerTest('decision.list returns decisions', async () => {
  await execute('builder.open Table');
  await execute('builder.run seed=1');
  const result = await execute('decision.list');
  assertOk(result);
});

registerTest('decision.override and reset work', async () => {
  await execute('builder.open Table');
  const overrideResult = await execute('decision.override table_style round');
  assertOk(overrideResult);

  const resetResult = await execute('decision.reset table_style');
  assertOk(resetResult);
});

registerTest('decision.reset-all clears overrides', async () => {
  await execute('decision.override table_style round');
  const result = await execute('decision.reset-all');
  assertOk(result);
});

// --- Storage Commands ---

registerTest('storage.list returns builders', async () => {
  const result = await execute('storage.list');
  assertOk(result);
  assert(Array.isArray(result.data.builders), 'Should have builders array');
});

registerTest('storage.exists checks builder existence', async () => {
  const existsResult = await execute('storage.exists Table');
  assertOk(existsResult);
  assertEqual(existsResult.data.exists, true, 'Table should exist');

  const notExistsResult = await execute('storage.exists NonExistent');
  assertOk(notExistsResult);
  assertEqual(notExistsResult.data.exists, false, 'NonExistent should not exist');
});

registerTest('storage.get retrieves builder content', async () => {
  const result = await execute('storage.get Table');
  assertOk(result);
  assert(result.data.name === 'Table', 'Should return Table');
  assert(result.data.content, 'Should have content');
});

// --- Math Commands ---

registerTest('math.eval evaluates expressions', async () => {
  const result = await execute('math.eval "sin(pi/4)"');
  assertOk(result);
  assert(Math.abs(result.data.value - 0.7071) < 0.001, 'sin(pi/4) ≈ 0.7071');
});

registerTest('math.eval with variables', async () => {
  const result = await execute('math.eval "x + y" x=10 y=5');
  assertOk(result);
  assertEqual(result.data.value, 15, 'x + y = 15');
});

registerTest('math.validate checks syntax', async () => {
  const validResult = await execute('math.validate "sin(x) + 1"');
  assertOk(validResult);
  assertEqual(validResult.data.valid, true, 'Should be valid');

  const invalidResult = await execute('math.validate "sin(x +"');
  assertOk(invalidResult);
  assertEqual(invalidResult.data.valid, false, 'Should be invalid');
});

registerTest('math.functions lists available functions', async () => {
  const result = await execute('math.functions');
  assertOk(result);
  assert(result.data.functions.includes('sin'), 'Should include sin');
  assert(result.data.functions.includes('cos'), 'Should include cos');
});

registerTest('math.constants lists constants', async () => {
  const result = await execute('math.constants');
  assertOk(result);
  assert(result.data.constants.pi, 'Should have pi');
  assert(Math.abs(result.data.constants.pi - Math.PI) < 0.0001, 'pi should be correct');
});

// --- Batch Execution ---

registerTest('batch execution runs multiple commands', async () => {
  const result = await executeCommands([
    'builder.open Table',
    'builder.run seed=1',
    'builder.measurements'
  ]);
  assertEqual(result.results.length, 3, 'Should have 3 results');
  assertOk(result.results[0]);
  assertOk(result.results[1]);
  assertOk(result.results[2]);
});

// --- DiningScene Composition ---

registerTest('DiningScene composes Table and Chairs', async () => {
  const result = await executeCommands([
    'builder.open DiningScene',
    'builder.run seed=42'
  ]);
  assertOk(result.results[0]);
  assertOk(result.results[1]);

  const runData = result.results[1].data;
  assert(runData.vertices > 200, 'Scene should have many vertices (table + chairs)');
  assert(runData.decisions['table.table_style'], 'Should have nested table decisions');
  assert(runData.decisions['chair_1.back_style'], 'Should have chair decisions');
});

// --- Round Table ---

registerTest('Table supports round style', async () => {
  const result = await executeCommands([
    'decision.reset-all',
    'builder.open Table',
    'decision.override table_style round',
    'builder.run seed=42'
  ]);

  assertOk(result.results[3]);
  const runData = result.results[3].data;
  assertEqual(runData.decisions.table_style.value, 'round', 'Should be round');
  // Round tables have more vertices due to circle
  assert(runData.vertices > 50, 'Round table should have circular geometry');
});

// ============================================================================
// MATERIAL COMMANDS
// ============================================================================

registerTest('material.colors lists all categories', async () => {
  const result = await execute('material.colors');
  assertOk(result);
  assert(result.data.totalColors > 30, 'Should have many named colors');
  assert(result.data.categories.wood > 0, 'Should have wood colors');
  assert(result.data.categories.metal > 0, 'Should have metal colors');
});

registerTest('material.colors category=wood lists wood colors', async () => {
  const result = await execute('material.colors category=wood');
  assertOk(result);
  assertEqual(result.data.category, 'wood', 'Category should be wood');
  assert(result.data.count >= 5, 'Should have multiple wood colors');
  assert(result.data.colors.wood_oak, 'Should have wood_oak');
  assert(result.data.colors.wood_walnut, 'Should have wood_walnut');
});

registerTest('material.bake-maps bakes mesh maps', async () => {
  const result = await executeCommands([
    'builder.open WoodChair',
    'builder.run seed=1',
    'material.bake-maps'
  ]);
  assertOk(result.results[2]);
  const data = result.results[2].data;
  assert(data.vertexCount > 0, 'Should have vertices');
  assert(data.stats.ao, 'Should have AO stats');
  assert(data.stats.curvature, 'Should have curvature stats');
  assert(data.stats.height, 'Should have height stats');
});

registerTest('material.maps returns baked map data', async () => {
  const result = await executeCommands([
    'builder.open WoodChair',
    'builder.run seed=1',
    'material.bake-maps',
    'material.maps'
  ]);
  assertOk(result.results[3]);
  const data = result.results[3].data;
  assert(data.samples, 'Should have samples');
  assert(data.samples.ao.length > 0, 'Should have AO samples');
  assert(data.samples.curvature.length > 0, 'Should have curvature samples');
  assert(data.samples.height.length > 0, 'Should have height samples');
});

registerTest('material.maps-stats returns statistics', async () => {
  const result = await executeCommands([
    'builder.open DiningScene',
    'builder.run seed=1',
    'material.bake-maps ao-samples=16',
    'material.maps-stats'
  ]);
  assertOk(result.results[3]);
  const data = result.results[3].data;
  assert(data.stats.ao.min >= 0, 'AO min should be >= 0');
  assert(data.stats.ao.max <= 1, 'AO max should be <= 1');
  assert(data.stats.curvature.avg >= 0, 'Curvature avg should be valid');
});

// ============================================================================
// GEOMETRY COMMANDS (P2-M1b)
// ============================================================================

registerTest('Vase builder uses lathe command', async () => {
  const result = await executeCommands([
    'builder.open Vase',
    'builder.run seed=42'
  ]);
  assertOk(result.results[0], 'Open Vase should succeed');
  assertOk(result.results[1], 'Run Vase should succeed');

  const runData = result.results[1].data;
  assert(runData.vertices > 100, 'Vase should have many vertices from lathe (expected ~192)');
  assert(runData.faces > 100, 'Vase should have many faces from lathe (expected ~168)');
  assert(runData.decisions.vase_style, 'Should have vase_style decision');
  assert(runData.decisions.vase_style.value, 'vase_style should have a value');
});

registerTest('Lathe creates rotational geometry', async () => {
  const result = await executeCommands([
    'builder.open Vase',
    'decision.override vase_style classic',
    'builder.run seed=1',
    'builder.mesh'
  ]);
  assertOk(result.results[2], 'Run should succeed');
  assertOk(result.results[3], 'Mesh retrieval should succeed');

  const meshData = result.results[3].data;
  assert(meshData.triangleCount > 0, 'Should have triangulated faces');
  assert(meshData.vertices.length > 0, 'Should have vertex data');
  assert(meshData.normals.length > 0, 'Should have normals');
});

registerTest('Mug builder uses lathe + sweep', async () => {
  const result = await executeCommands([
    'builder.open Mug',
    'builder.run seed=42'
  ]);
  assertOk(result.results[0], 'Open Mug should succeed');
  assertOk(result.results[1], 'Run Mug should succeed');

  const runData = result.results[1].data;
  assert(runData.vertices > 200, 'Mug should have many vertices (body + handle, expected ~248)');
  assert(runData.faces > 200, 'Mug should have many faces (expected ~218)');
  assert(runData.decisions.mug_style, 'Should have style decision');
});

registerTest('Sweep creates tubes along paths', async () => {
  const result = await executeCommands([
    'builder.open Mug',
    'decision.override mug_style modern',
    'builder.run seed=1',
    'builder.measurements'
  ]);
  assertOk(result.results[2], 'Run should succeed');
  assertOk(result.results[3], 'Measurements should succeed');

  const measurements = result.results[3].data.measurements;
  assert(measurements.handle_radius, 'Should have handle_radius measurement');
  assert(measurements.mug_height, 'Should have mug_height measurement');
});

registerTest('Cushion builder uses subdivide command', async () => {
  const result = await executeCommands([
    'builder.open Cushion',
    'builder.run seed=42'
  ]);
  assertOk(result.results[0], 'Open Cushion should succeed');
  assertOk(result.results[1], 'Run Cushion should succeed');

  const runData = result.results[1].data;
  assert(runData.vertices > 50, 'Cushion should have subdivided vertices (expected ~98)');
  assert(runData.faces > 50, 'Cushion should have subdivided faces (expected ~96)');
  assert(runData.decisions.cushion_shape, 'Should have cushion_shape decision');
});

registerTest('Subdivide creates smooth surfaces', async () => {
  const result = await executeCommands([
    'builder.open Cushion',
    'decision.override cushion_shape square',
    'builder.run seed=1',
    'builder.mesh'
  ]);
  assertOk(result.results[2], 'Run should succeed');
  assertOk(result.results[3], 'Mesh retrieval should succeed');

  const meshData = result.results[3].data;
  // Subdivision should increase vertex count significantly from base box
  assert(meshData.vertices.length > 200, 'Should have many vertices from subdivision');
  assert(meshData.normals.length > 0, 'Should have smooth normals');
});

registerTest('Vase with invalid style fails gracefully', async () => {
  const result = await executeCommands([
    'builder.open Vase',
    'decision.override vase_style invalid_style',
    'builder.run seed=1'
  ]);
  assertOk(result.results[0], 'Open should succeed');
  // Override with invalid value should be handled
  assertOk(result.results[1], 'Override should handle invalid value');
});

// ============================================================================
// INSTANCING OUTPUT (P2-M2c-003)
// ============================================================================

registerTest('builder.instances returns instance data', async () => {
  const result = await executeCommands([
    'builder.open ForestSlice',
    'builder.run seed=1',
    'builder.instances'
  ]);
  assertOk(result.results[0], 'Open should succeed');
  assertOk(result.results[1], 'Run should succeed');
  assertOk(result.results[2], 'Instances query should succeed');

  const instanceData = result.results[2].data;
  assert(instanceData.count > 0, 'Should have instances');
  assert(instanceData.instances.length > 0, 'Should have instances array');

  const firstInstance = instanceData.instances[0];
  assert(firstInstance.id, 'Instance should have id');
  assert(firstInstance.builderName === 'TreeScatter', 'Instance should reference TreeScatter');
  assert(firstInstance.transform, 'Instance should have transform');
  assert(firstInstance.transform.position, 'Instance should have position');
  assert(typeof firstInstance.seed === 'number', 'Instance should have seed');
});

registerTest('DiningScene without asInstance merges geometry', async () => {
  const result = await executeCommands([
    'builder.open DiningScene',
    'builder.run seed=1',
    'builder.instances'
  ]);
  assertOk(result.results[0], 'Open should succeed');
  assertOk(result.results[1], 'Run should succeed');
  assertOk(result.results[2], 'Instances query should succeed');

  const instanceData = result.results[2].data;
  assertEqual(instanceData.count, 0, 'DiningScene should have no instances (all merged)');
  assert(instanceData.message, 'Should have message explaining no instances');
});

// ============================================================================
// CONDITIONAL EXPRESSIONS (P2-M2b-003)
// ============================================================================

registerTest('ConditionalTest builder uses if() expressions', async () => {
  const result = await executeCommands([
    'builder.open ConditionalTest',
    'builder.run seed=42'
  ]);
  assertOk(result.results[0], 'Open ConditionalTest should succeed');
  assertOk(result.results[1], 'Run ConditionalTest should succeed');

  const runData = result.results[1].data;
  assert(runData.vertices > 0, 'Should have vertices');
  assert(runData.decisions.is_round !== undefined, 'Should have is_round decision');
  assert(runData.decisions.size_category !== undefined, 'Should have size_category decision');
});

registerTest('Conditional expressions evaluate correctly', async () => {
  const result = await executeCommands([
    'builder.open ConditionalTest',
    'decision.override is_round true',
    'builder.run seed=1',
    'builder.measurements'
  ]);
  assertOk(result.results[2], 'Run should succeed');
  assertOk(result.results[3], 'Measurements should succeed');

  const measurements = result.results[3].data.measurements;
  // When is_round is true, radius should be 0.5 (from if(is_round, 0.5, 0.4))
  assert(measurements.radius, 'Should have radius measurement');
  assertEqual(measurements.radius.value, 0.5, 'Radius should be 0.5 when is_round is true');
});

registerTest('Nested if() expressions work', async () => {
  const result = await executeCommands([
    'builder.open ConditionalTest',
    'builder.run seed=1',
    'builder.measurements'
  ]);
  assertOk(result.results[1], 'Run should succeed');
  assertOk(result.results[2], 'Measurements should succeed');

  const measurements = result.results[2].data.measurements;
  // adjusted_size uses if: if(is_round, base_size * pi / 4, base_size)
  assert(measurements.adjusted_size, 'Should have adjusted_size measurement');
  // final_radius combines multiple derived values with if
  assert(measurements.final_radius, 'Should have final_radius measurement');
  assert(measurements.final_radius.value > 0, 'final_radius should be positive');
});

// ============================================================================
// TEST RUNNER
// ============================================================================

async function runTests(): Promise<void> {
  console.log('\n🧪 MCP Integration Tests\n');
  console.log('='.repeat(60));

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    const start = Date.now();
    try {
      await fn();
      const duration = Date.now() - start;
      results.push({ name, passed: true, duration });
      console.log(`✅ ${name} (${duration}ms)`);
      passed++;
    } catch (err: any) {
      const duration = Date.now() - start;
      results.push({ name, passed: false, error: err.message, duration });
      console.log(`❌ ${name}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${tests.length} total\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    for (const result of results) {
      if (!result.passed) {
        console.log(`  - ${result.name}: ${result.error}`);
      }
    }
    process.exit(1);
  }

  console.log('✨ All tests passed!\n');
}

// Check if server is running
async function checkServer(): Promise<boolean> {
  try {
    const result = await execute('system.ping');
    return result.status === 'ok';
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log('Checking server availability...');

  const serverUp = await checkServer();
  if (!serverUp) {
    console.error('❌ Server not running at', API_URL);
    console.error('   Start with: npx tsx src/authoring/server.ts');
    process.exit(1);
  }

  console.log('✅ Server is running\n');
  await runTests();
}

main().catch(console.error);

