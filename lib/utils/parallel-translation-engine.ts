import { 
  TranslationEntry, 
  TranslationGroup, 
  TranslationResult,
  MergedResults,
  Provider 
} from '../types/translation-group';
import { createProvider } from '../providers';
import { mergeTranslationResults } from './csv-merger';
import { ProviderBatchConfig } from '../../components/BatchSettings';

export interface ParallelEngineOptions {
  openaiKey?: string;
  anthropicKey?: string;
  googleKey?: string;
  openai?: ProviderBatchConfig;
  anthropic?: ProviderBatchConfig;
  google?: ProviderBatchConfig;
}

export class ParallelTranslationEngine {
  private options: Required<ParallelEngineOptions>;

  constructor(options: ParallelEngineOptions) {
    this.options = {
      openaiKey: options.openaiKey || '',
      anthropicKey: options.anthropicKey || '',
      googleKey: options.googleKey || '',
      openai: options.openai || {
        concurrentBatches: 3,
        batchSize: 5,
        delayMs: 1000
      },
      anthropic: options.anthropic || {
        concurrentBatches: 2,  // Reduced from 5 to avoid rate limits
        batchSize: 5,          // Reduced from 8 to spread requests
        delayMs: 2000          // Increased from 500ms to 2s
      },
      google: options.google || {
        concurrentBatches: 3,
        batchSize: 5,
        delayMs: 1000
      }
    };
  }

  async processGroups(
    entries: TranslationEntry[],
    groups: TranslationGroup[],
    onGroupProgress?: (groupId: string, progress: number) => void,
    includeMetadata: boolean = true,
    abortSignal?: AbortSignal
  ): Promise<MergedResults> {
    // Check if already aborted
    if (abortSignal?.aborted) {
      throw new Error('Translation cancelled');
    }
    
    // Create a map to store results for each group
    const allResults = new Map<string, Map<string, TranslationResult>>();

    // Group translation groups by provider
    const groupsByProvider = this.groupByProvider(groups);

    // Process each provider's groups in parallel
    const providerPromises = [];

    if (groupsByProvider.openai.length > 0) {
      providerPromises.push(
        this.processProviderGroups(
          'openai',
          entries,
          groupsByProvider.openai,
          onGroupProgress,
          abortSignal
        ).then(results => {
          results.forEach((result, groupId) => {
            allResults.set(groupId, result);
          });
        })
      );
    }

    if (groupsByProvider.anthropic.length > 0) {
      providerPromises.push(
        this.processProviderGroups(
          'anthropic',
          entries,
          groupsByProvider.anthropic,
          onGroupProgress,
          abortSignal
        ).then(results => {
          results.forEach((result, groupId) => {
            allResults.set(groupId, result);
          });
        })
      );
    }

    if (groupsByProvider.google && groupsByProvider.google.length > 0) {
      providerPromises.push(
        this.processProviderGroups(
          'google',
          entries,
          groupsByProvider.google,
          onGroupProgress,
          abortSignal
        ).then(results => {
          results.forEach((result, groupId) => {
            allResults.set(groupId, result);
          });
        })
      );
    }

    // Wait for all providers to complete
    await Promise.all(providerPromises);

    // Merge all results
    return mergeTranslationResults(entries, groups, allResults, includeMetadata);
  }

  private groupByProvider(groups: TranslationGroup[]): Record<Provider, TranslationGroup[]> {
    return groups.reduce((acc, group) => {
      if (!acc[group.provider]) {
        acc[group.provider] = [];
      }
      acc[group.provider].push(group);
      return acc;
    }, { openai: [], anthropic: [], google: [] } as Record<Provider, TranslationGroup[]>);
  }

  private async processProviderGroups(
    provider: Provider,
    entries: TranslationEntry[],
    groups: TranslationGroup[],
    onGroupProgress?: (groupId: string, progress: number) => void,
    abortSignal?: AbortSignal
  ): Promise<Map<string, Map<string, TranslationResult>>> {
    const results = new Map<string, Map<string, TranslationResult>>();
    const providerConfig = this.options[provider];
    const apiKey = provider === 'openai' ? this.options.openaiKey : 
                   provider === 'anthropic' ? this.options.anthropicKey : 
                   this.options.googleKey;

    if (!apiKey) {
      console.error(`No API key provided for ${provider}`);
      // Return empty results for all groups
      groups.forEach(group => {
        results.set(group.id, new Map());
      });
      return results;
    }

    // Create a queue of all translation tasks across all groups
    const allTasks: Array<{
      entry: TranslationEntry;
      group: TranslationGroup;
      groupIndex: number;
    }> = [];

    // Collect all tasks from all groups
    groups.forEach((group, groupIndex) => {
      entries.forEach(entry => {
        allTasks.push({ entry, group, groupIndex });
      });
    });

    // Initialize group results and progress tracking
    const groupResults = new Map<string, Map<string, TranslationResult>>();
    const groupProgress = new Map<string, number>();
    groups.forEach(group => {
      groupResults.set(group.id, new Map());
      groupProgress.set(group.id, 0);
    });

    // Process all tasks with global batch limits
    const batches = this.createBatches(allTasks, providerConfig.batchSize);
    
    for (let i = 0; i < batches.length; i += providerConfig.concurrentBatches) {
      // Check if aborted
      if (abortSignal?.aborted) {
        throw new Error('Translation cancelled');
      }

      const concurrentBatches = batches.slice(i, i + providerConfig.concurrentBatches);
      
      // Process concurrent batches
      const batchPromises = concurrentBatches.map(async batch => {
        const batchResults = await this.processMixedBatch(batch, apiKey);
        
        // Distribute results to appropriate groups
        batchResults.forEach((result, index) => {
          const task = batch[index];
          const groupResult = groupResults.get(task.group.id);
          if (groupResult) {
            groupResult.set(task.entry.key, result);
            
            // Update progress
            const currentProgress = groupProgress.get(task.group.id) || 0;
            groupProgress.set(task.group.id, currentProgress + 1);
            const progress = Math.round((currentProgress + 1) / entries.length * 100);
            onGroupProgress?.(task.group.id, progress);
          }
        });
      });

      await Promise.all(batchPromises);

      // Add delay between batch groups
      if (i + providerConfig.concurrentBatches < batches.length && providerConfig.delayMs > 0) {
        if (abortSignal?.aborted) {
          throw new Error('Translation cancelled');
        }
        await this.delay(providerConfig.delayMs);
      }
    }

    return groupResults;
  }

  private async processSingleGroupWithConcurrentBatches(
    entries: TranslationEntry[],
    group: TranslationGroup,
    apiKey: string,
    config: ProviderBatchConfig,
    onProgress: (progress: number) => void,
    abortSignal?: AbortSignal
  ): Promise<Map<string, TranslationResult>> {
    // Check if aborted
    if (abortSignal?.aborted) {
      throw new Error('Translation cancelled');
    }
    
    const results = new Map<string, TranslationResult>();
    const provider = createProvider(group.provider, apiKey, group.model);

    // Create batches
    const batches = this.createBatches(entries, config.batchSize);
    let processedCount = 0;

    // Process batches with concurrency control
    for (let i = 0; i < batches.length; i += config.concurrentBatches) {
      // Check if aborted before processing next batch group
      if (abortSignal?.aborted) {
        throw new Error('Translation cancelled');
      }
      
      const concurrentBatches = batches.slice(i, i + config.concurrentBatches);
      
      // Process concurrent batches
      const batchPromises = concurrentBatches.map(batch => 
        this.processBatch(batch, group, provider).then(batchResults => {
          batchResults.forEach((result, key) => {
            results.set(key, result);
          });
          processedCount += batch.length;
          onProgress(Math.round((processedCount / entries.length) * 100));
        })
      );

      await Promise.all(batchPromises);

      // Add delay between concurrent batch groups (if not the last group)
      if (i + config.concurrentBatches < batches.length && config.delayMs > 0) {
        // Check if aborted before delay
        if (abortSignal?.aborted) {
          throw new Error('Translation cancelled');
        }
        await this.delay(config.delayMs);
      }
    }

    return results;
  }

  private async processBatch(
    batch: TranslationEntry[],
    group: TranslationGroup,
    provider: ReturnType<typeof createProvider>
  ): Promise<Map<string, TranslationResult>> {
    const batchResults = new Map<string, TranslationResult>();

    try {
      // Use batch translation for efficiency
      const batchResponse = await provider.translateBatch({
        entries: batch,
        language: group.name,
        systemPrompt: group.systemPrompt,
        userPrompt: group.userPrompt
      });

      // Process results
      batchResponse.results.forEach((result, key) => {
        batchResults.set(key, result);
      });

      // Log any errors
      if (batchResponse.errors.size > 0) {
        console.warn(`Batch translation had ${batchResponse.errors.size} errors:`, 
          Array.from(batchResponse.errors.entries()));
      }
    } catch (error) {
      console.error('Batch translation failed, falling back to individual translations:', error);
      
      // Fallback to individual translations if batch fails
      const promises = batch.map(async (entry) => {
        try {
          const response = await provider.translate({
            text: entry.english,
            key: entry.key,
            source: entry.source,
            language: group.name,
            systemPrompt: group.systemPrompt,
            userPrompt: group.userPrompt
          });
          batchResults.set(entry.key, response);
        } catch (individualError) {
          console.error(`Failed to translate ${entry.key}:`, individualError);
          batchResults.set(entry.key, {
            translation: '[ERROR]',
            category: 'Error',
            reasoning: individualError instanceof Error ? individualError.message : 'Unknown error'
          });
        }
      });

      await Promise.all(promises);
    }

    return batchResults;
  }

  private async processMixedBatch(
    batch: Array<{
      entry: TranslationEntry;
      group: TranslationGroup;
      groupIndex: number;
    }>,
    apiKey: string
  ): Promise<TranslationResult[]> {
    const results: TranslationResult[] = [];

    const promises = batch.map(async (task, index) => {
      const provider = createProvider(task.group.provider, apiKey, task.group.model);
      
      try {
        const response = await provider.translate({
          text: task.entry.english,
          key: task.entry.key,
          source: task.entry.source,
          language: task.group.name,
          systemPrompt: task.group.systemPrompt,
          userPrompt: task.group.userPrompt
        });
        results[index] = response;
      } catch (error) {
        console.error(`Failed to translate ${task.entry.key} for ${task.group.name}:`, error);
        results[index] = {
          translation: '[ERROR]',
          category: 'Error',
          reasoning: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    await Promise.all(promises);
    return results;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}