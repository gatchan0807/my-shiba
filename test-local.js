#!/usr/bin/env node

/**
 * Local test script for my-shiba
 * Tests the image generation functionality locally
 */

const WORKER_URL = 'http://localhost:8787';

async function testImageGeneration() {
  console.log('🧪 Testing image generation...\n');

  // Simulate a Slack app_mention event
  const slackEvent = {
    token: 'test-token',
    team_id: 'T123456',
    api_app_id: 'A123456',
    event: {
      type: 'app_mention',
      user: 'U123456',
      text: '<@U987654> check',
      ts: Date.now() / 1000,
      channel: 'C123456',
      event_ts: Date.now() / 1000
    },
    type: 'event_callback',
    event_id: 'Ev123456',
    event_time: Math.floor(Date.now() / 1000)
  };

  try {
    console.log('📤 Sending request to worker...');
    const response = await fetch(`${WORKER_URL}/slack/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackEvent)
    });

    const data = await response.json();
    console.log('📥 Response status:', response.status);
    console.log('📥 Response data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ Test passed! Image generation should be working.');
      console.log('   Check the wrangler dev logs for PNG conversion details.');
    } else {
      console.log('\n❌ Test failed. Check the error above.');
    }
  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
  }
}

// Run the test
testImageGeneration();
