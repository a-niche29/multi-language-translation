// Test script to debug translation issues with response logging enabled

const fs = require('fs');

// Test data with diverse entries using new headers
const testData = `Key,Source,English Original
common.words.hi,common,Hi
common.words.hello,common,Hello
menu.settings,menu,Settings
error.network,error,Network error occurred
game.points.earned,game,You earned {points} points!
user.profile.name,profile,Name
button.save,button,Save
notification.new_message,notification,You have a new message
onboarding.welcome,onboarding,Welcome to our app!
pricing.upgrade_cta,pricing,Upgrade to Premium`;

// Save test file
fs.writeFileSync('debug_test.csv', testData);

// Configuration for the test
const testConfig = {
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
  model: 'gpt-4o-mini',
  systemPrompt: 'You are an expert app localiser with 10 + years of UI/UX and marketing-copy experience across multiple languages.',
  // Using a simple prompt first to test
  simplePrompt: 'Translate "{{text}}" to Spanish',
  // Spanish sophisticated prompt from PROMPTS.md (shortened for testing)
  sophisticatedPrompt: `For each entry in the CSV snippet below, produce a Mexican-Spanish translation plus metadata fields including category classification.

OUTPUT
Return CSV rows in this exact order, with no header:
Key, Spanish Translation, Category, Translation Reasoning

IMPORTANT CSV FORMATTING:
- ALWAYS include the Key from the input as the first field (copy exactly)
- Use double quotes (") to wrap any field containing commas, quotes, or newlines
- Every row MUST have exactly 4 fields separated by commas
- Do NOT wrap the entire response in markdown code blocks
- Return ONLY the CSV rows, no additional text

{{csv}}`
};

// Test with debug logging
async function testWithDebugLogging() {
  try {
    // Import required modules
    const { OpenAIProvider } = require('./lib/providers/openai');
    const { responseLogger } = require('./lib/utils/response-logger');
    
    // Enable debug mode
    responseLogger.enableDebugMode();
    
    // Create provider
    const provider = new OpenAIProvider(testConfig.apiKey, testConfig.model);
    
    // Test 1: Single translation with simple prompt
    console.log('\\n=== TEST 1: Simple Prompt (Single) ===');
    const simpleResult = await provider.translate({
      text: 'Hello',
      key: 'test.hello',
      source: 'test',
      language: 'Spanish',
      systemPrompt: testConfig.systemPrompt,
      userPrompt: testConfig.simplePrompt
    });
    console.log('Simple Result:', simpleResult);
    
    // Test 2: Single translation with sophisticated prompt
    console.log('\\n=== TEST 2: Sophisticated Prompt (Single) ===');
    const sophisticatedResult = await provider.translate({
      text: 'Hello',
      key: 'test.hello',
      source: 'test',
      language: 'Spanish',
      systemPrompt: testConfig.systemPrompt,
      userPrompt: testConfig.sophisticatedPrompt
    });
    console.log('Sophisticated Result:', sophisticatedResult);
    
    // Test 3: Batch translation with sophisticated prompt
    console.log('\\n=== TEST 3: Sophisticated Prompt (Batch) ===');
    const entries = [
      { key: 'common.words.hi', source: 'common', english: 'Hi' },
      { key: 'common.words.hello', source: 'common', english: 'Hello' },
      { key: 'menu.settings', source: 'menu', english: 'Settings' },
      { key: 'error.network', source: 'error', english: 'Network error occurred' },
      { key: 'game.points.earned', source: 'game', english: 'You earned {points} points!' }
    ];
    
    const batchResult = await provider.translateBatch({
      entries,
      language: 'Spanish',
      systemPrompt: testConfig.systemPrompt,
      userPrompt: testConfig.sophisticatedPrompt
    });
    
    console.log('\\nBatch Results:');
    console.log('Success count:', batchResult.results.size);
    console.log('Error count:', batchResult.errors.size);
    
    // Display results
    for (const [key, result] of batchResult.results.entries()) {
      console.log(`\\n${key}:`);
      console.log('  Translation:', result.translation);
      console.log('  Category:', result.category);
      console.log('  Reasoning:', result.reasoning.substring(0, 50) + '...');
    }
    
    // Generate report
    const report = responseLogger.generateReport();
    console.log('\\n=== Debug Report ===');
    console.log(report);
    
    // Export logs
    const logs = responseLogger.exportLogs();
    fs.writeFileSync('debug-logs.json', logs);
    console.log('\\nDebug logs saved to debug-logs.json');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Check if running directly
if (require.main === module) {
  console.log('Starting translation debug test...');
  console.log('Make sure to set OPENAI_API_KEY environment variable');
  testWithDebugLogging();
}

module.exports = { testWithDebugLogging };