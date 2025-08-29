// Token-based rate limiter for API providers
export class TokenRateLimiter {
  private tokenUsage: { timestamp: number; tokens: number }[] = [];
  private readonly windowMs: number;
  private readonly maxTokens: number;
  
  constructor(maxTokensPerMinute: number) {
    this.windowMs = 60000; // 1 minute window
    this.maxTokens = maxTokensPerMinute;
  }
  
  /**
   * Estimate tokens for a text (rough approximation)
   * Generally 1 token ≈ 4 characters or 0.75 words
   */
  private estimateTokens(text: string): number {
    // Use character count divided by 4 as a conservative estimate
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Check if we can make a request with the given token count
   */
  canMakeRequest(estimatedTokens: number): boolean {
    this.cleanOldEntries();
    
    const currentUsage = this.tokenUsage.reduce((sum, entry) => sum + entry.tokens, 0);
    return currentUsage + estimatedTokens <= this.maxTokens;
  }
  
  /**
   * Get the delay needed before we can make a request
   */
  getRequiredDelay(estimatedTokens: number): number {
    this.cleanOldEntries();
    
    const currentUsage = this.tokenUsage.reduce((sum, entry) => sum + entry.tokens, 0);
    
    if (currentUsage + estimatedTokens <= this.maxTokens) {
      return 0;
    }
    
    // Find the oldest entry that needs to expire to make room
    let tokensToFree = currentUsage + estimatedTokens - this.maxTokens;
    let oldestRelevantTimestamp = Date.now();
    
    for (const entry of this.tokenUsage) {
      tokensToFree -= entry.tokens;
      if (tokensToFree <= 0) {
        oldestRelevantTimestamp = entry.timestamp;
        break;
      }
    }
    
    // Calculate delay needed
    const timeSinceOldest = Date.now() - oldestRelevantTimestamp;
    const remainingTime = this.windowMs - timeSinceOldest;
    
    return Math.max(0, remainingTime);
  }
  
  /**
   * Record token usage
   */
  recordUsage(tokens: number): void {
    this.tokenUsage.push({
      timestamp: Date.now(),
      tokens
    });
    this.cleanOldEntries();
  }
  
  /**
   * Estimate tokens for a request based on content
   */
  estimateRequestTokens(systemPrompt: string, userPrompt: string, responseEstimate = 1000): number {
    const promptTokens = this.estimateTokens(systemPrompt) + this.estimateTokens(userPrompt);
    return promptTokens + responseEstimate;
  }
  
  /**
   * Clean entries older than the time window
   */
  private cleanOldEntries(): void {
    const cutoff = Date.now() - this.windowMs;
    this.tokenUsage = this.tokenUsage.filter(entry => entry.timestamp > cutoff);
  }
  
  /**
   * Get current usage percentage
   */
  getUsagePercentage(): number {
    this.cleanOldEntries();
    const currentUsage = this.tokenUsage.reduce((sum, entry) => sum + entry.tokens, 0);
    return Math.round((currentUsage / this.maxTokens) * 100);
  }
}