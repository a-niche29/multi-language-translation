import { NextRequest, NextResponse } from 'next/server';
import { TranslationEntry, TranslationGroup } from 'mlt/lib/types/translation-group';
import { ParallelTranslationEngine } from 'mlt/lib/utils/parallel-translation-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entries, groups } = body as {
      entries: TranslationEntry[];
      groups: TranslationGroup[];
    };

    // Validate inputs
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: 'No entries provided' },
        { status: 400 }
      );
    }

    if (!groups || !Array.isArray(groups) || groups.length === 0) {
      return NextResponse.json(
        { error: 'No translation groups provided' },
        { status: 400 }
      );
    }

    // Check if required API keys are available
    const needsOpenAI = groups.some(g => g.provider === 'openai');
    const needsAnthropic = groups.some(g => g.provider === 'anthropic');
    const needsGoogle = groups.some(g => g.provider === 'google');
    
    if (needsOpenAI && !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured on server' },
        { status: 500 }
      );
    }
    
    if (needsAnthropic && !process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured on server' },
        { status: 500 }
      );
    }
    
    if (needsGoogle && !process.env.GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: 'Google API key not configured on server' },
        { status: 500 }
      );
    }

    // Create translation engine with server-side API keys
    const engine = new ParallelTranslationEngine({
      openaiKey: process.env.OPENAI_API_KEY || '',
      anthropicKey: process.env.ANTHROPIC_API_KEY || '',
      googleKey: process.env.GOOGLE_API_KEY || ''
    });

    // Process all groups in parallel
    const results = await engine.processGroups(
      entries,
      groups,
      (groupId, progress) => {
        // In a real implementation, you might use Server-Sent Events here
        // to send progress updates to the client
        console.log(`Group ${groupId}: ${progress}%`);
      }
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Translation failed' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes timeout for large translations