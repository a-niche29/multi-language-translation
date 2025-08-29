// Test script to verify rate limiting functionality
const { AnthropicProvider } = require('./lib/providers/anthropic');

async function testRateLimiting() {
  // Mock API key for testing
  const provider = new AnthropicProvider('test-key', 'claude-3-haiku-20240307');
  
  console.log('Testing rate limiter calculations...\n');
  
  // Test 1: Small requests should go through
  console.log('Test 1: Small request');
  const smallText = 'Hello world';
  const tokens1 = provider.rateLimiter.estimateRequestTokens(
    'You are a translator',
    smallText,
    100
  );
  console.log(`Estimated tokens: ${tokens1}`);
  console.log(`Can make request: ${provider.rateLimiter.canMakeRequest(tokens1)}`);
  console.log(`Required delay: ${provider.rateLimiter.getRequiredDelay(tokens1)}ms`);
  console.log(`Usage: ${provider.rateLimiter.getUsagePercentage()}%\n`);
  
  // Test 2: Simulate multiple requests
  console.log('Test 2: Simulating multiple requests');
  for (let i = 0; i < 5; i++) {
    const tokens = 10000; // 10k tokens per request
    provider.rateLimiter.recordUsage(tokens);
    console.log(`After request ${i + 1}: Usage ${provider.rateLimiter.getUsagePercentage()}%`);
  }
  
  // Test 3: Check if we need to wait
  console.log('\nTest 3: Checking large request after usage');
  const largeTokens = 50000;
  console.log(`Large request tokens: ${largeTokens}`);
  console.log(`Can make request: ${provider.rateLimiter.canMakeRequest(largeTokens)}`);
  const delay = provider.rateLimiter.getRequiredDelay(largeTokens);
  console.log(`Required delay: ${delay}ms (${(delay / 1000).toFixed(1)}s)`);
  
  // Test 4: Test the actual retry mechanism
  console.log('\nTest 4: Testing retry mechanism with mock error');
  
  // Create a mock rate limit error
  const rateLimitError = new Error('429 {"type":"error","error":{"type":"rate_limit_error","message":"Rate limit exceeded"}}');
  
  // Test if error is recognized
  console.log(`Is rate limit error: ${provider.isRateLimitError(rateLimitError)}`);
  
  // Test backoff delays
  console.log('\nBackoff delays:');
  for (let attempt = 1; attempt <= 4; attempt++) {
    const delay = provider.calculateBackoffDelay(attempt);
    console.log(`Attempt ${attempt}: ${delay}ms (${(delay / 1000).toFixed(1)}s)`);
  }
}

// Run the test
testRateLimiting().catch(console.error);