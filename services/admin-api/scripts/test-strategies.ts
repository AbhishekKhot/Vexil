import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';
const DATA_PLANE_BASE = 'http://localhost:3000/v1';

async function runTest() {
  console.log('🚀 Starting Vexil E2E Strategy & Telemetry Test');

  try {
    // 1. Register a test organization & user
    const timestamp = Date.now();
    const testEmail = `tester-${timestamp}@vexil.com`;
    const testPassword = 'Password123!';
    console.log(`\n📝 Registering tester: ${testEmail}`);
    await axios.post(`${API_BASE}/auth/register`, {
      email: testEmail,
      password: testPassword,
      name: 'E2E Tester',
      orgName: `E2E Org ${timestamp}`
    });

    console.log('🔑 Logging in to get token...');
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: testEmail,
      password: testPassword
    });
    const token = loginRes.data.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 2. Create a project
    console.log('📁 Creating project: E2E Test Project');
    const projectRes = await axios.post(`${API_BASE}/projects`, {
      name: 'E2E Test Project',
      description: 'Project for testing all evaluation strategies'
    }, { headers: authHeaders });
    const projectId = projectRes.data.id;

    // 3. Create a Production environment
    console.log('🌐 Creating Production environment');
    const envRes = await axios.post(`${API_BASE}/projects/${projectId}/environments`, {
      name: 'Production'
    }, { headers: authHeaders });
    const envId = envRes.data.id;
    const apiKey = envRes.data.apiKey;
    const dataPlaneHeaders = { Authorization: `Bearer ${apiKey}` };

    // 4. Create and configure flags for each strategy
    const flagsToCreate = [
      { key: 'bool-flag', type: 'boolean', strategy: { strategyType: 'boolean', isEnabled: true } },
      { key: 'rollout-flag', type: 'boolean', strategy: { strategyType: 'rollout', isEnabled: true, strategyConfig: { percentage: 50, hashAttribute: 'userId' } } },
      { key: 'targeted-flag', type: 'boolean', strategy: { strategyType: 'targeted_rollout', isEnabled: true, strategyConfig: { percentage: 100, hashAttribute: 'userId', rules: [{ attribute: 'country', operator: 'eq', values: ['US'] }] } } },
      { key: 'user-flag', type: 'boolean', strategy: { strategyType: 'user_targeting', isEnabled: true, strategyConfig: { userIds: ['tester-1'], hashAttribute: 'userId', fallthrough: false } } },
      { key: 'attr-flag', type: 'boolean', strategy: { strategyType: 'attribute_matching', isEnabled: true, strategyConfig: { rules: [{ attribute: 'tier', operator: 'eq', values: ['premium'] }] } } },
      { key: 'ab-flag', type: 'string', strategy: { strategyType: 'ab_test', isEnabled: true, strategyConfig: { variants: [{ key: 'control', value: 'red', weight: 50 }, { key: 'variant-a', value: 'blue', weight: 50 }], hashAttribute: 'userId' } } },
      { key: 'time-flag', type: 'boolean', strategy: { strategyType: 'time_window', isEnabled: true, strategyConfig: { startDate: new Date(Date.now() - 3600000).toISOString(), endDate: new Date(Date.now() + 3600000).toISOString() } } },
      { key: 'pre-flag', type: 'boolean', strategy: { strategyType: 'prerequisite', isEnabled: true, strategyConfig: { flagKey: 'bool-flag', expectedValue: true } } }
    ];

    console.log('\n🚩 Creating and configuring flags...');
    for (const f of flagsToCreate) {
      console.log(`   - ${f.key} (${f.strategy.strategyType})`);
      const flagRes = await axios.post(`${API_BASE}/projects/${projectId}/flags`, {
        key: f.key,
        type: f.type,
        description: `Test flag for ${f.strategy.strategyType}`
      }, { headers: authHeaders });
      
      const flagId = flagRes.data.id;
      
      await axios.put(`${API_BASE}/projects/${projectId}/environments/${envId}/flags/${flagId}`, f.strategy, { headers: authHeaders });
    }

    // 5. Evaluate Data Plane
    console.log('\n🔍 Running Evaluations (Data Plane)...');

    const testContexts = [
      { name: 'US Premium User', context: { userId: 'tester-1', country: 'US', tier: 'premium' } },
      { name: 'Non-US Free User', context: { userId: 'tester-2', country: 'GB', tier: 'free' } },
      { name: 'UK Premium User', context: { userId: 'tester-3', country: 'GB', tier: 'premium' } }
    ];

    for (const test of testContexts) {
      console.log(`\n   ▶ Testing for: ${test.name}`);
      const evalRes = await axios.post(`${DATA_PLANE_BASE}/eval`, {
        context: test.context
      }, { headers: dataPlaneHeaders });
      
      const flags = evalRes.data.flags;
      console.log(`     - bool-flag: ${flags['bool-flag'].value} (${flags['bool-flag'].reason})`);
      console.log(`     - rollout-flag: ${flags['rollout-flag'].value} (${flags['rollout-flag'].reason})`);
      console.log(`     - targeted-flag: ${flags['targeted-flag'].value} (${flags['targeted-flag'].reason})`);
      console.log(`     - user-flag: ${flags['user-flag'].value} (${flags['user-flag'].reason})`);
      console.log(`     - attr-flag: ${flags['attr-flag'].value} (${flags['attr-flag'].reason})`);
      console.log(`     - ab-flag: ${flags['ab-flag'].value} (${flags['ab-flag'].reason})`);
      console.log(`     - time-flag: ${flags['time-flag'].value} (${flags['time-flag'].reason})`);
      console.log(`     - pre-flag: ${flags['pre-flag'].value} (${flags['pre-flag'].reason})`);
    }

    // 6. Ingest Telemetry
    console.log('\n📊 Sending Telemetry Events (Telemetry Data Plane)...');
    const events = [];
    for (let i = 0; i < 20; i++) {
        events.push({
            flagKey: 'bool-flag',
            result: true,
            context: { userId: `telemetry-user-${i}` },
            timestamp: new Date().toISOString()
        });
        events.push({
            flagKey: 'targeted-flag',
            result: i < 15, // 75% TRUE
            context: { userId: `telemetry-user-${i}` },
            timestamp: new Date().toISOString()
        });
    }

    const ingestRes = await axios.post(`${DATA_PLANE_BASE}/events`, events, { headers: dataPlaneHeaders });
    console.log(`   Telemetry Ingest Status: ${ingestRes.status} (${ingestRes.data.status})`);

    // 7. Verify Statistics
    console.log('\n📈 Waiting 5 seconds for RMQ and Worker to process events...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('📁 Fetching Analytics Stats for the project...');
    const statsRes = await axios.get(`${API_BASE}/projects/${projectId}/stats`, { headers: authHeaders });
    console.log('\n   Final Stats Received:');
    statsRes.data.forEach((s: any) => {
        console.log(`     - ${s.flagKey}: ${s.count} evaluations (${s.enabledCount} enabled, ${s.passRate}% pass rate)`);
    });

    console.log('\n✅ E2E Test Completed Successfully!');

  } catch (error: any) {
    console.error('\n❌ Test Failed:');
    if (error.response) {
      console.error(`   - Status: ${error.response.status}`);
      console.error(`   - Data: ${JSON.stringify(error.response.data)}`);
      // console.error(`   - Headers: ${JSON.stringify(error.response.headers)}`);
    } else {
      console.error(`   - Message: ${error.message}`);
    }
    process.exit(1);
  }
}

runTest();
