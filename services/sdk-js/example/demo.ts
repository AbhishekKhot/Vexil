import { createVexilClient } from '../src';

async function runDemo() {
  // Use a development key from your locally running Vexil Admin
  const vexil = createVexilClient({
    apiKey: 'your_local_dev_key', // Replace this with a real key from the dashboard
    baseUrl: 'http://localhost:3000'
  });

  console.log('Fetching flags for user context...');
  
  try {
    const flags = await vexil.fetchFlags({
      userId: 'user_123',
      country: 'US',
      betaUser: true
    });

    console.log('Flags fetched successfully:', Object.keys(flags));

    // Example feature flag check
    const isDarkModeEnabled = vexil.isEnabled('dark-mode');
    console.log(`Is dark-mode enabled? ${isDarkModeEnabled}`);

    const bannerText = vexil.getValue<string>('banner-text');
    console.log(`Banner text: ${bannerText || 'N/A'}`);

    // Track an evaluation event
    console.log('Tracking evaluation event...');
    await vexil.trackEvents([{
      flagKey: 'dark-mode',
      result: isDarkModeEnabled,
      context: { userId: 'user_123' },
      timestamp: new Date().toISOString()
    }]);

    console.log('Demo finished!');

  } catch (error) {
    console.error('Demo failed:', error);
  }
}

runDemo();
