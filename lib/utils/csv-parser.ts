import { TranslateResponse } from '../providers/base';
import { TranslationEntry } from '../types/translation-group';
import { responseValidator } from './response-validator';
import Papa from 'papaparse';

interface ParseCSVResult {
  success: boolean;
  data?: TranslationEntry[];
  headers?: string[];
  error?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Robust CSV parser that handles various edge cases in AI-generated CSV responses
 * Now using PapaParse for more reliable parsing
 */
export class RobustCSVParser {
  /**
   * Parse a CSV row using PapaParse for reliable parsing
   * Handles various edge cases automatically
   */
  parseRow(row: string): string[] {
    const result = Papa.parse(row, {
      delimiter: ',',
      quoteChar: '"',
      escapeChar: '"',
      header: false,
      skipEmptyLines: true
    });
    
    if (result.errors.length > 0) {
      console.warn('CSV parsing warning:', result.errors);
    }
    
    return (result.data[0] as string[]) || [];
  }

  /**
   * Preprocess AI response to clean up common formatting issues
   */
  preprocessResponse(response: string): string {
    let cleaned = response;
    
    // Remove markdown code blocks
    cleaned = cleaned.replace(/^```(?:csv)?\s*\n?/gm, '');
    cleaned = cleaned.replace(/\n?```\s*$/gm, '');
    
    // Remove markdown formatting
    cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1'); // Bold
    cleaned = cleaned.replace(/\*(.+?)\*/g, '$1'); // Italic
    cleaned = cleaned.replace(/`(.+?)`/g, '$1'); // Code
    
    // Normalize quotes
    cleaned = cleaned.replace(/[""]/g, '"'); // Smart quotes to regular
    cleaned = cleaned.replace(/['']/g, "'"); // Smart apostrophes to regular
    
    // Remove common instruction text patterns
    cleaned = cleaned.replace(/^(?:Here(?:'s| is) (?:the|your) (?:translation|CSV).*?:)\s*/im, '');
    cleaned = cleaned.replace(/^(?:I've translated.*?:)\s*/im, '');
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
  }
  
  /**
   * Smart field parsing that handles common AI response patterns
   * Attempts to extract fields even from malformed responses
   */
  parseAIResponse(response: string): TranslateResponse | null {
    // Preprocess the response
    const cleanResponse = this.preprocessResponse(response);

    // Handle case where AI returns instruction text or explanatory text
    if (cleanResponse.toLowerCase().includes('i\'m ready to translate') ||
        cleanResponse.toLowerCase().includes('please provide') ||
        cleanResponse.match(/\b(i'll|i will|let me) (output|return|provide|give you|format)/i) ||
        cleanResponse.includes('format you specified') ||
        cleanResponse.includes('four csv fields') ||
        cleanResponse.includes('four fields')) {
      return null;
    }

    // Split by newlines to handle multi-line responses
    const lines = cleanResponse.split('\n').filter(line => line.trim());
    
    // Try to find the actual data line (skip headers or explanatory text)
    let dataLine = '';
    for (const line of lines) {
      // Skip lines that look like headers or instructions
      if (line.toLowerCase().includes('key,') || 
          line.toLowerCase().includes('category') && line.toLowerCase().includes('reasoning')) {
        continue;
      }
      // Take the first line that looks like data
      if (line.includes(',')) {
        dataLine = line;
        break;
      }
    }

    if (!dataLine) {
      return null;
    }

    // Parse the CSV row
    const fields = this.parseRow(dataLine);

    // Expected format: Key, Translation, Category, Reasoning
    // We need at least 2 fields (key and translation)
    if (fields.length < 2) {
      return null;
    }

    // Extract fields based on position
    const [, translation, category, reasoning] = fields;

    // Validate the translation field before returning
    if (!translation || translation.trim() === '') {
      return null;
    }

    // Note: We now expect the key as the first field, but we only return translation data
    return {
      translation: translation.trim(),
      category: category?.trim() || 'Unknown',
      reasoning: reasoning?.trim() || 'Parsed from CSV'
    };
  }

  /**
   * Normalize a field for proper CSV formatting
   * Adds quotes if needed and escapes internal quotes
   */
  normalizeField(field: string): string {
    // Check if field needs quoting
    const needsQuoting = field.includes(',') || 
                        field.includes('"') || 
                        field.includes('\n') ||
                        field.includes('\r');

    if (!needsQuoting) {
      return field;
    }

    // Escape internal quotes by doubling them
    const escaped = field.replace(/"/g, '""');
    
    // Wrap in quotes
    return `"${escaped}"`;
  }

  /**
   * Convert fields array to properly formatted CSV row
   */
  toCSV(fields: string[]): string {
    return fields.map(field => this.normalizeField(field)).join(',');
  }

  /**
   * Parse response with multiple fallback strategies
   */
  parseWithFallbacks(response: string, text: string, targetLanguage?: string): TranslateResponse {
    // Early detection of acknowledgment/explanatory responses
    const acknowledgmentPatterns = [
      /^(and |then |next |now |yes, )?(i'll|i will|i would|i can|let me) (output|return|provide|give you|format|translate)/i,
      /^(sure|okay|yes|alright),?\s*(i'll|i will|here is|here are)/i,
      /\b(output|return|provide) (the |exactly )?(four|4) (csv )?(fields?|columns?)/i,
      /\bformat you (specified|requested|asked for)/i,
      /^(yes, )?here (is|are) (the|your) translation/i,
    ];
    
    for (const pattern of acknowledgmentPatterns) {
      if (pattern.test(response.trim())) {
        return {
          translation: '[ERROR]',
          category: 'Error',
          reasoning: 'AI returned acknowledgment text instead of translation - likely missing CSV data'
        };
      }
    }
    
    // Detect incomplete responses that suggest the AI was explaining
    if (response.match(/\b(Key|Category|Reasoning|Translation|CSV|fields?)\b/i) && 
        !response.includes(',') && 
        response.length < 100) {
      return {
        translation: '[ERROR]',
        category: 'Error', 
        reasoning: 'Response mentions CSV structure without providing actual CSV'
      };
    }
    
    // Try primary parsing
    const parsed = this.parseAIResponse(response);
    if (parsed?.translation) {
      return parsed;
    }

    // Fallback 1: Try to extract translation from common patterns
    const patterns = [
      /translation[:\s]*(.+?)(?:,|\n|$)/i,
      /translated[:\s]*(.+?)(?:,|\n|$)/i,
      /result[:\s]*(.+?)(?:,|\n|$)/i,
    ];

    for (const pattern of patterns) {
      const match = response.match(pattern);
      if (match?.[1]) {
        return {
          translation: match[1].trim().replace(/^["']|["']$/g, ''),
          category: 'Unknown',
          reasoning: 'Extracted from response'
        };
      }
    }

    // Fallback 2: If response looks like a translation (not instruction text)
    const cleanedResponse = response.trim();
    
    // Check for explanatory text patterns before processing
    const explanatoryPatterns = [
      /\b(i'll|i will|let me|i would) (output|return|provide|give you|format)/i,
      /\bformat you specified\b/i,
      /\band i'll\b/i,
      /\bfour csv fields\b/i,
      /\boutput four csv fields\b/i,
    ];
    
    for (const pattern of explanatoryPatterns) {
      if (pattern.test(cleanedResponse)) {
        return {
          translation: text,
          category: 'Error',
          reasoning: 'AI returned explanatory text instead of translation'
        };
      }
    }
    
    // Skip validation for responses that look like CSV format (contain commas)
    // These should have been parsed above, so if we're here it's likely malformed
    if (cleanedResponse.includes(',') && cleanedResponse.split(',').length >= 2) {
      // Try one more time to extract just the translation part
      const parts = cleanedResponse.split(',');
      if (parts.length >= 2) {
        const possibleTranslation = parts[1].trim().replace(/^["']|["']$/g, '');
        if (possibleTranslation && possibleTranslation !== text) {
          return {
            translation: possibleTranslation,
            category: 'Unknown',
            reasoning: 'Extracted from malformed CSV'
          };
        }
      }
    }
    
    // Validate before accepting as translation
    if (targetLanguage && !cleanedResponse.includes(',')) {
      const validation = responseValidator.validateTranslationResponse(
        cleanedResponse,
        text,
        targetLanguage
      );
      
      if (!validation.isValid) {
        console.warn('Response validation failed:', validation.issues);
        // Don't accept invalid responses as translations
        return {
          translation: text,
          category: 'Error',
          reasoning: `Invalid response: ${validation.issues[0]}`
        };
      }
    }
    
    if (cleanedResponse.length < text.length * 3 && // Not too long
        !cleanedResponse.toLowerCase().includes('translate') &&
        !cleanedResponse.toLowerCase().includes('csv')) {
      return {
        translation: cleanedResponse,
        category: 'Unknown',
        reasoning: 'Direct response assumed as translation'
      };
    }

    // Final fallback: Return original text
    return {
      translation: text,
      category: 'Error',
      reasoning: 'Failed to parse AI response'
    };
  }
}

export const csvParser = new RobustCSVParser();

export async function parseCSV(file: File): Promise<ParseCSVResult> {
  try {
    const text = await file.text();
    
    // Use PapaParse for robust CSV parsing
    const parseResult = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      transform: (value) => value.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV parsing warnings:', results.errors);
        }
      }
    });
    
    if (parseResult.data.length === 0) {
      return {
        success: false,
        error: 'CSV file is empty'
      };
    }
    
    // Get headers from the parsed result
    const headers = parseResult.meta.fields || [];
    
    // Validate required headers - check for both old and new header names
    const requiredHeaders = [
      { new: 'key', old: 'key' },
      { new: 'source', old: 'source' },
      { new: 'english original', old: 'english' }
    ];
    
    const missingHeaders = requiredHeaders.filter(h => 
      !headers.includes(h.new.toLowerCase()) && !headers.includes(h.old.toLowerCase())
    ).map(h => h.new);
    
    if (missingHeaders.length > 0) {
      return {
        success: false,
        error: `Missing required headers: ${missingHeaders.join(', ')}`
      };
    }
    
    // Convert parsed data to TranslationEntry format
    const data: TranslationEntry[] = [];
    const errors: string[] = [];
    
    parseResult.data.forEach((row, index) => {
      try {
        const entry: TranslationEntry = {
          key: row['key'] || '',
          source: row['source'] || '',
          english: row['english original'] || row['english'] || '' // Support both new and old header
        };
        
        // Add any additional columns
        Object.keys(row).forEach(key => {
          if (!['key', 'source', 'english original', 'english'].includes(key)) {
            // Restore original case for additional columns
            const originalHeader = parseResult.meta.fields?.find(f => f.toLowerCase() === key) || key;
            entry[originalHeader] = row[key] || '';
          }
        });
        
        data.push(entry);
      } catch (err) {
        errors.push(`Error processing row ${index + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    });
    
    if (errors.length > 0 && data.length === 0) {
      return {
        success: false,
        error: errors.join('\n')
      };
    }
    
    // Restore original header casing for output
    const originalHeaders = parseResult.meta.fields || [];
    
    return {
      success: true,
      data,
      headers: originalHeaders,
      error: errors.length > 0 ? `Parsed with ${errors.length} errors` : undefined
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse CSV file'
    };
  }
}

export function validateCSVData(data: TranslationEntry[]): ValidationResult {
  const errors: string[] = [];
  const seenKeys = new Set<string>();
  
  data.forEach((entry, index) => {
    const rowNum = index + 2; // +2 because index starts at 0 and we skip header row
    
    // Check for empty required fields
    if (!entry.key) {
      errors.push(`Row ${rowNum}: Missing key`);
    }
    if (!entry.source) {
      errors.push(`Row ${rowNum}: Missing source text`);
    }
    if (!entry.english) {
      errors.push(`Row ${rowNum}: Missing English text`);
    }
    
    // Check for duplicate keys
    if (entry.key && seenKeys.has(entry.key)) {
      errors.push(`Row ${rowNum}: Duplicate key "${entry.key}"`);
    } else if (entry.key) {
      seenKeys.add(entry.key);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}