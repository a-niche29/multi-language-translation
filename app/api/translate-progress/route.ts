import { NextRequest } from 'next/server';
import { TranslationEntry, TranslationGroup } from 'mlt/lib/types/translation-group';
import { ParallelTranslationEngine } from 'mlt/lib/utils/parallel-translation-engine';
import { BatchConfig } from 'mlt/components/BatchSettings';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  // State tracking for controller
  let isControllerClosed = false;
  const abortController = new AbortController();
  
  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      // Safe enqueue helper
      const safeEnqueue = (data: Uint8Array) => {
        try {
          if (!isControllerClosed && !abortController.signal.aborted) {
            controller.enqueue(data);
          }
        } catch (error) {
          console.error('Failed to enqueue data:', error);
        }
      };
      
      // Handle client disconnection
      request.signal.addEventListener('abort', () => {
        isControllerClosed = true;
        abortController.abort();
      });
      
      try {
        const body = await request.json();
        const { entries, groups, batchConfig, includeMetadata = true, previousResults } = body as {
          entries: TranslationEntry[];
          groups: TranslationGroup[];
          batchConfig?: BatchConfig;
          includeMetadata?: boolean;
          previousResults?: { entries: TranslationEntry[]; headers: string[] };
        };

        // Validate inputs
        if (!entries || !Array.isArray(entries) || entries.length === 0) {
          safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'error', 
            error: 'No entries provided' 
          })}\n\n`));
          isControllerClosed = true;
          controller.close();
          return;
        }

        if (!groups || !Array.isArray(groups) || groups.length === 0) {
          safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'error', 
            error: 'No translation groups provided' 
          })}\n\n`));
          isControllerClosed = true;
          controller.close();
          return;
        }

        // Check if required API keys are available
        const needsOpenAI = groups.some(g => g.provider === 'openai');
        const needsAnthropic = groups.some(g => g.provider === 'anthropic');
        
        if (needsOpenAI && !process.env.OPENAI_API_KEY) {
          safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'error', 
            error: 'OpenAI API key not configured on server' 
          })}\n\n`));
          isControllerClosed = true;
          controller.close();
          return;
        }
        
        if (needsAnthropic && !process.env.ANTHROPIC_API_KEY) {
          safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'error', 
            error: 'Anthropic API key not configured on server' 
          })}\n\n`));
          isControllerClosed = true;
          controller.close();
          return;
        }

        // Send initial status
        safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
          type: 'start',
          totalGroups: groups.length,
          totalEntries: entries.length
        })}\n\n`));

        // Create translation engine with user-configured settings
        const engine = new ParallelTranslationEngine({
          openaiKey: process.env.OPENAI_API_KEY || '',
          anthropicKey: process.env.ANTHROPIC_API_KEY || '',
          openai: batchConfig?.openai,
          anthropic: batchConfig?.anthropic
        });

        // Process all groups with progress tracking
        const results = await engine.processGroups(
          entries,
          groups,
          (groupId, progress) => {
            // Send progress update
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'progress',
              groupId,
              progress
            })}\n\n`));
          },
          includeMetadata,
          abortController.signal
        );

        // Merge with previous results if doing retry
        let finalResults = results;
        if (previousResults && previousResults.entries) {
          // Create a map of previous results by key
          const prevResultsMap = new Map<string, TranslationEntry>();
          previousResults.entries.forEach((entry) => {
            prevResultsMap.set(entry.key, entry);
          });
          
          // Update with new results
          results.entries.forEach((entry) => {
            prevResultsMap.set(entry.key, entry);
          });
          
          // Convert back to array format
          finalResults = {
            entries: Array.from(prevResultsMap.values()),
            headers: results.headers
          };
        }

        // Send completion with results
        safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
          type: 'complete',
          results: finalResults
        })}\n\n`));

      } catch (error) {
        safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
          type: 'error',
          error: error instanceof Error ? error.message : 'Translation failed'
        })}\n\n`));
      } finally {
        isControllerClosed = true;
        abortController.abort();
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes timeout