/**
 * Goal-Seeking Placement Commands Integration Tests
 *
 * Tests for B1-003: scene.place_around, scene.place_along, scene.fill_area
 *
 * Run with: npx tsx src/tests/goal-seeking-placement.test.ts
 */

const API_URL = 'http://127.0.0.1:4200/api/execute';

interface CommandResult {
  command: string;
  status: 'ok' | 'error';
  data?: any;
  error?: string;
}

async function executeCommands(commands: string[]): Promise<{ results: CommandResult[] }> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands }),
  });
  return response.json();
}

async function test(name: string, commands: string[], validator: (results: CommandResult[]) => void) {
  console.log(`\n🧪 ${name}`);
  try {
    const response = await executeCommands(commands);
    validator(response.results);
    console.log('   ✓ Passed');
  } catch (error) {
    console.log(`   ✗ Failed: ${error}`);
    throw error;
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('Goal-Seeking Placement Commands Tests');
  console.log('========================================\n');

  // Test 1: place_around with circle
  await test(
    'scene.place_around - circular arrangement',
    [
      'scene.place_around count=6 center=0,0,0 radius=2 size=0.4,0.8,0.4 shape=circle seed=42'
    ],
    (results) => {
      const result = results[0];
      if (result.status !== 'ok') {
        throw new Error(`Command failed: ${result.error}`);
      }
      if (!result.data || result.data.count !== 6) {
        throw new Error(`Expected 6 placements, got ${result.data?.count}`);
      }
      console.log(`   Placed ${result.data.count} objects in a circle`);
      console.log(`   Rejected: ${result.data.rejected}`);
    }
  );

  // Test 2: place_around with rectangle
  await test(
    'scene.place_around - rectangular arrangement',
    [
      'scene.place_around count=8 center=0,0,0 radius=2 shape=rect width=3 depth=2 size=0.4,0.8,0.4 minDist=0.2 seed=42'
    ],
    (results) => {
      const result = results[0];
      if (result.status !== 'ok') {
        throw new Error(`Command failed: ${result.error}`);
      }
      console.log(`   Placed ${result.data.count} of ${result.data.requested} requested objects around rectangle`);
      console.log(`   First placement: (${result.data.placements[0].position.x.toFixed(2)}, ${result.data.placements[0].position.z.toFixed(2)}) rotation: ${result.data.placements[0].rotationDeg}°`);
    }
  );

  // Test 3: place_along - linear arrangement
  await test(
    'scene.place_along - evenly distributed',
    [
      'scene.place_along count=5 start=0,0,0 end=4,0,0 size=0.3,0.5,0.3 facing=forward'
    ],
    (results) => {
      const result = results[0];
      if (result.status !== 'ok') {
        throw new Error(`Command failed: ${result.error}`);
      }
      if (!result.data || result.data.count !== 5) {
        throw new Error(`Expected 5 placements, got ${result.data?.count}`);
      }
      console.log(`   Placed ${result.data.count} objects along ${result.data.lineLength}m line`);
      console.log(`   Spacing: ${result.data.spacing}m`);
      console.log(`   First: (${result.data.placements[0].position.x}, ${result.data.placements[0].position.z})`);
      console.log(`   Last: (${result.data.placements[4].position.x}, ${result.data.placements[4].position.z})`);
    }
  );

  // Test 4: place_along with fixed spacing
  await test(
    'scene.place_along - fixed spacing',
    [
      'scene.place_along count=10 start=-3,0,0 end=3,0,0 size=0.2,0.4,0.2 spacing=0.5 facing=end'
    ],
    (results) => {
      const result = results[0];
      if (result.status !== 'ok') {
        throw new Error(`Command failed: ${result.error}`);
      }
      console.log(`   Placed ${result.data.count} objects with 0.5m spacing`);
      console.log(`   Rotation: ${result.data.placements[0].rotationDeg}° (facing end)`);
    }
  );

  // Test 5: fill_area - Poisson disk scatter
  await test(
    'scene.fill_area - Poisson disk scatter',
    [
      'scene.fill_area bounds=-5,-5,5,5 density=1.0 size=0.3,0.5,0.3 minDist=0.5 seed=42'
    ],
    (results) => {
      const result = results[0];
      if (result.status !== 'ok') {
        throw new Error(`Command failed: ${result.error}`);
      }
      if (!result.data || result.data.count < 10) {
        throw new Error(`Expected at least 10 placements in 100m² area, got ${result.data?.count}`);
      }
      console.log(`   Scattered ${result.data.count} objects in ${result.data.area}m² area`);
      console.log(`   Density: ${result.data.density}, Min distance: ${result.data.minDistance}m`);
      console.log(`   Sample position: (${result.data.placements[0].position.x.toFixed(2)}, ${result.data.placements[0].position.z.toFixed(2)})`);
    }
  );

  // Test 6: Error handling - missing parameters
  await test(
    'Error handling - missing required parameters',
    [
      'scene.place_around count=5'
    ],
    (results) => {
      const result = results[0];
      if (result.status !== 'error') {
        throw new Error('Expected error for missing parameters');
      }
      if (!result.error || !result.error.includes('Usage:')) {
        throw new Error('Expected usage error message');
      }
      console.log(`   Correctly rejected: ${result.error.substring(0, 50)}...`);
    }
  );

  // Test 7: Invalid format handling
  await test(
    'Error handling - invalid position format',
    [
      'scene.place_along count=3 start=invalid end=0,0,0 size=0.3,0.5,0.3'
    ],
    (results) => {
      const result = results[0];
      if (result.status !== 'error') {
        throw new Error('Expected error for invalid format');
      }
      console.log(`   Correctly rejected: ${result.error}`);
    }
  );

  console.log('\n========================================');
  console.log('✓ All tests passed!');
  console.log('========================================\n');
}

// Run tests
runTests().catch((error) => {
  console.error('\n✗ Test suite failed:', error);
  process.exit(1);
});
