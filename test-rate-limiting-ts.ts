// Test script to verify rate limiting functionality
import { TokenRateLimiter } from './lib/utils/rate-limiter';

async function testRateLimiting() {
  console.log('Testing rate limiter calculations...\n');
  
  const rateLimiter = new TokenRateLimiter(200000); // 200k tokens per minute
  
  // Test 1: Small requests should go through
  console.log('Test 1: Small request');
  const smallText = 'Hello world';
  const tokens1 = rateLimiter.estimateRequestTokens(
    'You are a translator',
    smallText,
    100
  );
  console.log(`Estimated tokens: ${tokens1}`);
  console.log(`Can make request: ${rateLimiter.canMakeRequest(tokens1)}`);
  console.log(`Required delay: ${rateLimiter.getRequiredDelay(tokens1)}ms`);
  console.log(`Usage: ${rateLimiter.getUsagePercentage()}%\n`);
  
  // Test 2: Simulate multiple requests
  console.log('Test 2: Simulating multiple requests');
  for (let i = 0; i < 5; i++) {
    const tokens = 10000; // 10k tokens per request
    rateLimiter.recordUsage(tokens);
    console.log(`After request ${i + 1}: Usage ${rateLimiter.getUsagePercentage()}%`);
  }
  
  // Test 3: Check if we need to wait
  console.log('\nTest 3: Checking large request after usage');
  const largeTokens = 50000;
  console.log(`Large request tokens: ${largeTokens}`);
  console.log(`Can make request: ${rateLimiter.canMakeRequest(largeTokens)}`);
  const delay = rateLimiter.getRequiredDelay(largeTokens);
  console.log(`Required delay: ${delay}ms (${(delay / 1000).toFixed(1)}s)`);
  
  // Test 4: Test batch scenarios
  console.log('\nTest 4: Testing batch translation scenarios');
  
  // Reset with fresh limiter
  const batchLimiter = new TokenRateLimiter(200000);
  
  // Simulate batch of 10 entries with sophisticated prompt
  const batchPrompt = 'Translate the following CSV entries...'.repeat(10);
  const batchTokens = batchLimiter.estimateRequestTokens(
    'You are a professional translator',
    batchPrompt,
    10000 // 10 entries * 1000 tokens response
  );
  console.log(`Batch of 10 entries: ${batchTokens} tokens`);
  console.log(`Can process batch: ${batchLimiter.canMakeRequest(batchTokens)}`);
  
  // Simulate filling up the rate limit
  console.log('\nTest 5: Simulating rate limit filling');
  const fillLimiter = new TokenRateLimiter(200000);
  let totalUsed = 0;
  for (let i = 0; i < 20; i++) {
    const requestTokens = 15000;
    if (fillLimiter.canMakeRequest(requestTokens)) {
      fillLimiter.recordUsage(requestTokens);
      totalUsed += requestTokens;
      console.log(`Request ${i + 1}: Used ${totalUsed} tokens (${fillLimiter.getUsagePercentage()}%)`);
    } else {
      const waitTime = fillLimiter.getRequiredDelay(requestTokens);
      console.log(`Request ${i + 1}: Rate limit reached! Need to wait ${(waitTime / 1000).toFixed(1)}s`);
      break;
    }
  }
}

// Run the test
testRateLimiting().catch(console.error);