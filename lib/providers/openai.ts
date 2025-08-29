import OpenAI from 'openai';
import { TranslationProvider, TranslateOptions, TranslateResponse, BatchTranslateOptions, BatchTranslateResponse } from './base';
import { responseLogger } from '../utils/response-logger';
import { TranslationEntry } from '../types/translation-group';

export class OpenAIProvider extends TranslationProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    super();
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async translate(options: TranslateOptions): Promise<TranslateResponse> {
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
      
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      });

      const response = completion.choices[0]?.message?.content || '';
      
      // Use enhanced parsing for CSV prompts
      const parsed = isCSVPrompt 
        ? this.parseCSVResponse(response, options.key, options.text, options.language)
        : this.parseResponse(response, options.text, options.language);
      
      // Log the response for debugging
      responseLogger.logResponse({
        timestamp: new Date(),
        provider: 'openai',
        model: this.model,
        input: {
          text: options.text,
          key: options.key,
          source: options.source,
          language: options.language,
          systemPrompt: options.systemPrompt,
          userPrompt: prompt
        },
        rawResponse: response,
        parsedResult: parsed,
        parseMethod: this.getParseMethod(response, parsed),
        success: parsed.translation !== options.text || parsed.category !== 'Error'
      });
      
      return parsed;
    } catch (error) {
      throw new Error(`OpenAI translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private getParseMethod(response: string, result: TranslateResponse): 'primary' | 'fallback1' | 'fallback2' | 'error' {
    if (result.category === 'Error' && result.reasoning === 'Failed to parse AI response') {
      return 'error';
    }
    if (result.reasoning === 'Extracted from response') {
      return 'fallback1';
    }
    if (result.reasoning === 'Direct response assumed as translation') {
      return 'fallback2';
    }
    return 'primary';
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
                         prompt.includes('CSV format');
      
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
      
      // Make the API call
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      });
      
      const response = completion.choices[0]?.message?.content || '';
      
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
          provider: 'openai',
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
      // If batch fails, mark all as errors
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
}

// Last updated: 2025-07-25
// Check for new models at: https://platform.openai.com/docs/models
export const OPENAI_MODELS = [
  // GPT-4.1 Series (Latest)
  { id: 'gpt-4.1', name: 'GPT-4.1 (Latest)' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
  
  // GPT-4o Series (Multimodal)
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4o-2024-11-20', name: 'GPT-4o (Nov 2024)' },
  { id: 'gpt-4o-2024-08-06', name: 'GPT-4o (Aug 2024)' },
  { id: 'gpt-4o-2024-05-13', name: 'GPT-4o (May 2024)' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'gpt-4o-mini-2024-07-18', name: 'GPT-4o Mini (July 2024)' },
  
  // GPT-4 Turbo Series
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'gpt-4-turbo-2024-04-09', name: 'GPT-4 Turbo (April 2024)' },
  { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo Preview' },
  { id: 'gpt-4-0125-preview', name: 'GPT-4 Turbo Preview (Jan 2024)' },
  { id: 'gpt-4-1106-preview', name: 'GPT-4 Turbo Preview (Nov 2023)' },
  
  // GPT-4 Series
  { id: 'gpt-4', name: 'GPT-4' },
  { id: 'gpt-4-0613', name: 'GPT-4 (June 2023)' },
  
  // GPT-3.5 Series
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  { id: 'gpt-3.5-turbo-0125', name: 'GPT-3.5 Turbo (Jan 2024)' },
  { id: 'gpt-3.5-turbo-1106', name: 'GPT-3.5 Turbo (Nov 2023)' },
  { id: 'gpt-3.5-turbo-16k', name: 'GPT-3.5 Turbo 16K' }
];