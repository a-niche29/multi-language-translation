import Anthropic from '@anthropic-ai/sdk';
import { TranslationProvider, TranslateOptions, TranslateResponse, BatchTranslateOptions, BatchTranslateResponse } from './base';
import { TranslationEntry } from '../types/translation-group';
import { responseLogger } from '../utils/response-logger';
import { TokenRateLimiter } from '../utils/rate-limiter';

export class AnthropicProvider extends TranslationProvider {
  private client: Anthropic;
  private model: string;
  private rateLimitRetries = 3;
  private initialRetryDelay = 2000; // 2 seconds
  private rateLimiter: TokenRateLimiter;

  constructor(apiKey: string, model: string = 'claude-3-5-sonnet-20241022') {
    super();
    this.client = new Anthropic({ apiKey });
    this.model = model;
    // Anthropic's rate limit: 200,000 input tokens per minute
    this.rateLimiter = new TokenRateLimiter(200000);
  }

  async translate(options: TranslateOptions): Promise<TranslateResponse> {
    return this.translateWithRetry(options);
  }

  private async translateWithRetry(options: TranslateOptions, attempt = 1): Promise<TranslateResponse> {
    try {
      // Create CSV row for the prompt
      const csvRow = `${this.escapeCSV(options.key)},${this.escapeCSV(options.source)},${this.escapeCSV(options.text)}`;
      
      // Create full CSV format with headers for sophisticated prompts
      const csvWithHeaders = `Key,Source,English Original\n${csvRow}`;
      
      // Replace all supported macros
      let prompt = options.userPrompt;
      
      // Check if this is a sophisticated prompt that expects CSV format
      const isCSVPrompt = prompt.includes('CSV snippet below') || 
                         prompt.includes('For each entry in the CSV') ||
                         prompt.includes('For each row in the CSV') ||  // Marathi pattern
                         prompt.includes('For every row you receive') || // Kannada pattern
                         prompt.includes('CSV format') ||
                         prompt.includes('output four CSV fields') ||    // Common pattern
                         prompt.includes('output exactly four CSV fields');
      
      // Replace CSV-related macros
      prompt = prompt.replace(/\{\{csv_row\}\}/g, csvRow);
      prompt = prompt.replace(/\{\{csv\}\}/g, csvWithHeaders);
      prompt = prompt.replace(/\{\{key\}\}/g, options.key);
      prompt = prompt.replace(/\{\{source\}\}/g, options.source);
      prompt = prompt.replace(/\{\{english\}\}/g, options.text);
      prompt = prompt.replace(/\{\{text\}\}/g, options.text); // Keep for backward compatibility
      prompt = prompt.replace(/\{\{language\}\}/g, options.language);
      
      // If the prompt mentions CSV and no CSV macros were used, append the full CSV
      if (isCSVPrompt && 
          !options.userPrompt.includes('{{csv_row}}') && 
          !options.userPrompt.includes('{{csv}}') &&
          !options.userPrompt.includes('{{key}}')) {
        prompt = `${prompt}\n\n${csvWithHeaders}`;
      }
      
      // Check rate limits before making request
      const estimatedTokens = this.rateLimiter.estimateRequestTokens(
        options.systemPrompt,
        prompt,
        1000 // Estimated response tokens
      );
      
      const delay = this.rateLimiter.getRequiredDelay(estimatedTokens);
      if (delay > 0) {
        console.log(`Rate limit approaching (${this.rateLimiter.getUsagePercentage()}% used), waiting ${delay}ms before request`);
        await this.delay(delay);
      }
      
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 1000,
        temperature: 0.3,
        system: options.systemPrompt,
        messages: [
          { role: 'user', content: prompt }
        ]
      });

      const response = message.content[0]?.type === 'text' 
        ? message.content[0].text 
        : '';
      
      // Record token usage (estimate based on request + response)
      this.rateLimiter.recordUsage(estimatedTokens);
        
      // Use enhanced parsing for CSV prompts
      return isCSVPrompt 
        ? this.parseCSVResponse(response, options.key, options.text, options.language)
        : this.parseResponse(response, options.text, options.language);
    } catch (error) {
      if (this.isRateLimitError(error) && attempt <= this.rateLimitRetries) {
        const delay = this.calculateBackoffDelay(attempt);
        console.warn(`Rate limit hit for ${options.key}, retrying in ${delay}ms (attempt ${attempt}/${this.rateLimitRetries})`);
        await this.delay(delay);
        return this.translateWithRetry(options, attempt + 1);
      }
      throw new Error(`Anthropic translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private escapeCSV(value: string): string {
    // If value contains comma, newline, or double quote, wrap in quotes
    if (value.includes(',') || value.includes('\n') || value.includes('"')) {
      // Escape double quotes by doubling them
      const escaped = value.replace(/"/g, '""');
      return `"${escaped}"`;
    }
    return value;
  }
  
  private parseCSVResponse(response: string, expectedKey: string, originalText: string, language?: string): TranslateResponse {
    try {
      // First try to parse as CSV with the expected 4-column format
      const lines = response.trim().split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        // Parse CSV line considering quoted fields
        const fields = this.parseCSVLine(line);
        
        // Expected format: Key, Translation, Category, Reasoning
        if (fields.length >= 4) {
          const [key, translation, category, reasoning] = fields;
          
          // Check if this is the row for our key
          if (key === expectedKey || lines.length === 1) {
            return {
              translation: translation || originalText,
              category: category || 'Unknown',
              reasoning: reasoning || 'Parsed from CSV response'
            };
          }
        }
        // Fallback: if we have at least 2 fields, assume second is translation
        else if (fields.length >= 2) {
          return {
            translation: fields[1],
            category: fields[2] || 'Unknown',
            reasoning: fields[3] || 'Parsed from partial CSV response'
          };
        }
      }
      
      // If no valid CSV found, fall back to the standard parser
      return this.parseResponse(response, originalText, language);
    } catch {
      // If CSV parsing fails, fall back to standard parser
      return this.parseResponse(response, originalText, language);
    }
  }
  
  private parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
      const char = line[i];
      
      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            // Escaped quote
            current += '"';
            i += 2;
            continue;
          } else {
            // End of quoted field
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          current += char;
          i++;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          i++;
        } else if (char === ',') {
          fields.push(current);
          current = '';
          i++;
        } else {
          current += char;
          i++;
        }
      }
    }
    
    // Don't forget the last field
    fields.push(current);
    
    return fields.map(f => f.trim());
  }
  
  async translateBatch(options: BatchTranslateOptions): Promise<BatchTranslateResponse> {
    return this.translateBatchWithRetry(options);
  }

  private async translateBatchWithRetry(options: BatchTranslateOptions, attempt = 1): Promise<BatchTranslateResponse> {
    const results = new Map<string, TranslateResponse>();
    const errors = new Map<string, string>();
    
    try {
      // Create CSV format with all entries
      const csvHeaders = 'Key,Source,English Original';
      const csvRows = options.entries.map(entry => 
        `${this.escapeCSV(entry.key)},${this.escapeCSV(entry.source)},${this.escapeCSV(entry.english)}`
      ).join('\n');
      
      const fullCSV = `${csvHeaders}\n${csvRows}`;
      const entryCount = options.entries.length;
      
      // Build the prompt
      let prompt = options.userPrompt;
      
      // Check if this is a sophisticated prompt
      const isCSVPrompt = prompt.includes('CSV snippet below') || 
                         prompt.includes('For each entry in the CSV') ||
                         prompt.includes('For each row in the CSV') ||  // Marathi pattern
                         prompt.includes('For every row you receive') || // Kannada pattern
                         prompt.includes('CSV format') ||
                         prompt.includes('output four CSV fields') ||    // Common pattern
                         prompt.includes('output exactly four CSV fields');
      
      // Replace macros for batch
      prompt = prompt.replace(/\{\{csv\}\}/g, fullCSV);
      prompt = prompt.replace(/\{\{entries_count\}\}/g, entryCount.toString());
      prompt = prompt.replace(/\{\{language\}\}/g, options.language);
      
      // If prompt expects CSV but doesn't use macros, append the data
      if (isCSVPrompt && !options.userPrompt.includes('{{csv}}')) {
        prompt = `${prompt}

ENTRIES (${entryCount} total):
<<<
${fullCSV}
>>>

REMINDER: Return exactly ${entryCount} output rows, one for each input entry above.`;
      }
      
      // Check rate limits for batch request
      const estimatedTokens = this.rateLimiter.estimateRequestTokens(
        options.systemPrompt,
        prompt,
        1000 * Math.min(entryCount, 10) // Estimated response tokens
      );
      
      const delay = this.rateLimiter.getRequiredDelay(estimatedTokens);
      if (delay > 0) {
        console.log(`Rate limit approaching for batch (${this.rateLimiter.getUsagePercentage()}% used), waiting ${delay}ms`);
        await this.delay(delay);
      }
      
      // Make the API call
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 1000 * Math.min(entryCount, 10), // Scale tokens with batch size
        temperature: 0.3,
        system: options.systemPrompt,
        messages: [
          { role: 'user', content: prompt }
        ]
      });

      const response = message.content[0]?.type === 'text' 
        ? message.content[0].text 
        : '';
      
      // Record token usage
      this.rateLimiter.recordUsage(estimatedTokens);
      
      // Parse batch response
      const parsed = this.parseBatchCSVResponse(response, options.entries);
      
      // Map results to entries
      for (const entry of options.entries) {
        const result = parsed.get(entry.key);
        if (result) {
          results.set(entry.key, result);
        } else {
          errors.set(entry.key, 'No translation found in response');
          results.set(entry.key, {
            translation: '[ERROR]',
            category: 'Error',
            reasoning: 'Missing from batch response'
          });
        }
      }
      
      // Log batch response for debugging - using first entry for logging
      if (options.entries.length > 0) {
        responseLogger.logResponse({
          timestamp: new Date(),
          provider: 'anthropic',
          model: this.model,
          input: {
            text: `Batch of ${entryCount} entries`,
            key: options.entries[0].key,
            source: options.entries[0].source,
            language: options.language,
            systemPrompt: options.systemPrompt,
            userPrompt: prompt
          },
          rawResponse: response,
          parsedResult: {
            translation: `Batch: ${results.size} successful, ${errors.size} errors`,
            category: 'Batch',
            reasoning: `Processed ${entryCount} entries in batch`
          },
          parseMethod: errors.size === 0 ? 'primary' : 'fallback1',
          success: errors.size === 0
        });
      }
      
    } catch (error) {
      // Check if it's a rate limit error and we have retries left
      if (this.isRateLimitError(error) && attempt <= this.rateLimitRetries) {
        const delay = this.calculateBackoffDelay(attempt);
        console.warn(`Rate limit hit for batch of ${options.entries.length} entries, retrying in ${delay}ms (attempt ${attempt}/${this.rateLimitRetries})`);
        await this.delay(delay);
        return this.translateBatchWithRetry(options, attempt + 1);
      }
      
      // If batch fails after retries, mark all as errors
      for (const entry of options.entries) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.set(entry.key, errorMsg);
        results.set(entry.key, {
          translation: '[ERROR]',
          category: 'Error', 
          reasoning: `Batch translation failed: ${errorMsg}`
        });
      }
    }
    
    return { results, errors };
  }
  
  private parseBatchCSVResponse(response: string, entries: TranslationEntry[]): Map<string, TranslateResponse> {
    const results = new Map<string, TranslateResponse>();
    
    try {
      // Clean response
      const cleanResponse = response
        .replace(/^```csv\s*/gm, '')
        .replace(/^```\s*/gm, '')
        .replace(/\s*```$/gm, '')
        .trim();
      
      // Split into lines
      const lines = cleanResponse.split('\n').filter(line => line.trim());
      
      // Skip header if present
      const firstLine = lines[0]?.toLowerCase();
      const startIndex = (firstLine?.includes('key') && firstLine?.includes('translation')) ? 1 : 0;
      
      // Parse each line
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const fields = this.parseCSVLine(line);
        
        if (fields.length >= 4) {
          const [key, translation, category, reasoning] = fields;
          
          // Try exact match first
          if (results.has(key)) {
            continue; // Skip duplicates
          }
          
          results.set(key, {
            translation: translation || '',
            category: category || 'Unknown',
            reasoning: reasoning || 'Batch translated'
          });
        } else if (fields.length >= 2) {
          // Fallback for partial responses
          const key = fields[0];
          results.set(key, {
            translation: fields[1] || '',
            category: fields[2] || 'Unknown',
            reasoning: fields[3] || 'Partial response'
          });
        }
      }
      
      // If we didn't get all entries, try fuzzy matching
      if (results.size < entries.length) {
        for (const entry of entries) {
          if (!results.has(entry.key)) {
            // Try normalized key matching
            const normalizedKey = entry.key.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            for (const [parsedKey, value] of results.entries()) {
              const normalizedParsedKey = parsedKey.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (normalizedParsedKey === normalizedKey && !results.has(entry.key)) {
                results.set(entry.key, value);
                results.delete(parsedKey);
                break;
              }
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Failed to parse batch CSV response:', error);
    }
    
    return results;
  }

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      // Check for 429 status code or rate limit message
      return error.message.includes('429') || 
             error.message.includes('rate_limit_error') ||
             error.message.includes('rate limit');
    }
    return false;
  }

  private calculateBackoffDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.initialRetryDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // 0-1000ms jitter
    return Math.min(baseDelay + jitter, 30000); // Max 30 seconds
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Last updated: 2025-07-29
// Check for new models at: https://docs.anthropic.com/en/docs/models-overview
export const ANTHROPIC_MODELS = [
  // Claude 4 Series (Latest)
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4 (Latest)' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (Latest)' },
  
  // Claude 3.7 Series
  { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet (Hybrid Reasoning)' },
  
  // Claude 3.5 Series
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Latest)' },
  { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet (June)' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
  
  // Claude 3 Series
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
  { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
];