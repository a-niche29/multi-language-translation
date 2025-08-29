import { GoogleGenerativeAI } from '@google/generative-ai';
import { TranslationProvider, TranslateOptions, TranslateResponse, BatchTranslateOptions, BatchTranslateResponse } from './base';
import { responseLogger } from '../utils/response-logger';
import { TranslationEntry } from '../types/translation-group';

export class GoogleProvider extends TranslationProvider {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-1.5-flash') {
    super();
    this.client = new GoogleGenerativeAI(apiKey);
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
                         prompt.includes('For each row in the CSV') ||
                         prompt.includes('For every row you receive') ||
                         prompt.includes('CSV format') ||
                         prompt.includes('output four CSV fields') ||
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
      
      // Get the generative model
      const generativeModel = this.client.getGenerativeModel({ model: this.model });
      
      // Combine system and user prompts for Gemini
      const fullPrompt = `${options.systemPrompt}\n\n${prompt}`;
      
      // Generate content
      const result = await generativeModel.generateContent(fullPrompt);
      const response = result.response.text();
      
      // Use enhanced parsing for CSV prompts
      const parsed = isCSVPrompt 
        ? this.parseCSVResponse(response, options.key, options.text, options.language)
        : this.parseResponse(response, options.text, options.language);
      
      // Log the response for debugging
      responseLogger.logResponse({
        timestamp: new Date(),
        provider: 'google',
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
      throw new Error(`Google translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      
      // Get the generative model
      const generativeModel = this.client.getGenerativeModel({ model: this.model });
      
      // Combine system and user prompts for Gemini
      const fullPrompt = `${options.systemPrompt}\n\n${prompt}`;
      
      // Generate content
      const result = await generativeModel.generateContent(fullPrompt);
      const response = result.response.text();
      
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
          provider: 'google',
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

// Last updated: 2025-07-24
// Latest Gemini models from Google AI
export const GOOGLE_MODELS = [
  // Gemini 2.5 Series (Latest)
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite' },
  { id: 'gemini-2.5-flash-live', name: 'Gemini 2.5 Flash Live' },
  
  // Gemini 2.0 Series
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)' },
  { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Flash Thinking (Experimental)' },
  
  // Gemini 1.5 Series
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro (Latest)' },
  { id: 'gemini-1.5-pro-002', name: 'Gemini 1.5 Pro 002' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash (Latest)' },
  { id: 'gemini-1.5-flash-002', name: 'Gemini 1.5 Flash 002' },
  { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B' },
  { id: 'gemini-1.5-flash-8b-latest', name: 'Gemini 1.5 Flash 8B (Latest)' },
  
  // Gemini 1.0 Series (Legacy)
  { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro' },
  { id: 'gemini-1.0-pro-latest', name: 'Gemini 1.0 Pro (Latest)' }
];