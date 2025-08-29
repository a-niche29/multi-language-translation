import { csvParser } from '../utils/csv-parser';
import { TranslationEntry } from '../types/translation-group';

export interface TranslateOptions {
  text: string;
  key: string;
  source: string;
  language: string;
  systemPrompt: string;
  userPrompt: string;
}

export interface BatchTranslateOptions {
  entries: TranslationEntry[];
  language: string;
  systemPrompt: string;
  userPrompt: string;
}

export interface TranslateResponse {
  translation: string;
  category: string;
  reasoning: string;
}

export interface BatchTranslateResponse {
  results: Map<string, TranslateResponse>;
  errors: Map<string, string>;
}

export abstract class TranslationProvider {
  abstract translate(options: TranslateOptions): Promise<TranslateResponse>;
  
  // New batch translation method
  abstract translateBatch(options: BatchTranslateOptions): Promise<BatchTranslateResponse>;
  
  protected parseResponse(response: string, originalText: string, language?: string): TranslateResponse {
    // Use the robust CSV parser with fallbacks
    return csvParser.parseWithFallbacks(response, originalText, language);
  }
}