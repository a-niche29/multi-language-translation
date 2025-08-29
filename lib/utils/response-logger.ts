interface AIResponseLog {
  timestamp: Date;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  input: {
    text: string;
    key: string;
    source: string;
    language: string;
    systemPrompt: string;
    userPrompt: string;
  };
  rawResponse: string;
  parsedResult: {
    translation: string;
    category: string;
    reasoning: string;
  };
  parseMethod: 'primary' | 'fallback1' | 'fallback2' | 'error';
  success: boolean;
  error?: string;
}

export class ResponseLogger {
  private logs: AIResponseLog[] = [];
  private debugMode: boolean = false;

  enableDebugMode() {
    this.debugMode = true;
  }

  disableDebugMode() {
    this.debugMode = false;
  }

  logResponse(log: AIResponseLog) {
    this.logs.push(log);
    
    if (this.debugMode) {
      console.log('=== AI Response Debug ===');
      console.log('Provider:', log.provider, 'Model:', log.model);
      console.log('Language:', log.input.language);
      console.log('Input text:', log.input.text);
      console.log('Raw response:', log.rawResponse);
      console.log('Parsed:', log.parsedResult);
      console.log('Parse method used:', log.parseMethod);
      console.log('Success:', log.success);
      if (log.error) console.log('Error:', log.error);
      console.log('========================\n');
    }
  }

  getRecentLogs(count: number = 10): AIResponseLog[] {
    return this.logs.slice(-count);
  }

  getFailedResponses(): AIResponseLog[] {
    return this.logs.filter(log => !log.success);
  }

  getResponsesByParseMethod(method: string): AIResponseLog[] {
    return this.logs.filter(log => log.parseMethod === method);
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  downloadLogs() {
    const blob = new Blob([this.exportLogs()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-response-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  generateReport() {
    const total = this.logs.length;
    const successful = this.logs.filter(l => l.success).length;
    const byParseMethod = this.logs.reduce((acc, log) => {
      acc[log.parseMethod] = (acc[log.parseMethod] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalResponses: total,
      successRate: total > 0 ? (successful / total * 100).toFixed(2) + '%' : '0%',
      parseMethodBreakdown: byParseMethod,
      recentFailures: this.getFailedResponses().slice(-5)
    };
  }
}

export const responseLogger = new ResponseLogger();