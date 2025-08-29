export type Provider = 'openai' | 'anthropic' | 'google';

export interface TranslationGroup {
  id: string;
  name: string; // e.g., "Spanish", "Portuguese"
  language?: string; // Optional, defaults to name if not specified
  provider: Provider;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  columnName: string; // e.g., "Spanish Translation", "Portuguese Translation"
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

export interface TranslationEntry {
  key: string;
  source: string;
  english: string;
  [columnName: string]: string; // Dynamic columns for each translation group
}

export interface TranslationResult {
  translation: string;
  category: string;
  reasoning: string;
}

export interface ParallelTranslationJob {
  csvData: TranslationEntry[];
  groups: TranslationGroup[];
  results: Map<string, Map<string, TranslationResult>>; // groupId -> key -> result
}

export interface MergedResults {
  entries: TranslationEntry[];
  headers: string[];
}

export interface GroupProgress {
  groupId: string;
  progress: number;
  status: TranslationGroup['status'];
  error?: string;
}