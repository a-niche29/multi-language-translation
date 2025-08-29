import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { SavedTranslationGroup } from 'mlt/lib/storage/saved-groups';

export async function POST(request: NextRequest) {
  try {
    const { groups }: { groups: SavedTranslationGroup[] } = await request.json();
    
    if (!groups || !Array.isArray(groups)) {
      return NextResponse.json(
        { error: 'Invalid groups data' },
        { status: 400 }
      );
    }

    // Create saved-prompts directory if it doesn't exist
    const promptsDir = path.join(process.cwd(), 'saved-prompts');
    await mkdir(promptsDir, { recursive: true });

    // Save each group as an individual file
    const savedFiles: string[] = [];
    
    for (const group of groups) {
      // Create a safe filename from the group name
      const timestamp = new Date(group.createdAt).getTime();
      const safeName = group.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      const filename = `${safeName}-${timestamp}.json`;
      const filepath = path.join(promptsDir, filename);
      
      // Write the group data to file
      await writeFile(
        filepath,
        JSON.stringify(group, null, 2),
        'utf-8'
      );
      
      savedFiles.push(filename);
    }

    // Create an index file with all groups
    const indexPath = path.join(promptsDir, 'index.json');
    const index = {
      lastSynced: new Date().toISOString(),
      totalGroups: groups.length,
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        language: g.group.language || g.group.name,
        description: g.description,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt
      }))
    };
    
    await writeFile(
      indexPath,
      JSON.stringify(index, null, 2),
      'utf-8'
    );

    return NextResponse.json({ 
      success: true, 
      savedFiles,
      message: `Successfully saved ${groups.length} prompt configurations` 
    });
  } catch (error) {
    console.error('Error saving prompts:', error);
    return NextResponse.json(
      { error: 'Failed to save prompts to files' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Read the index file to return current saved prompts info
    const indexPath = path.join(process.cwd(), 'saved-prompts', 'index.json');
    const { readFile } = await import('fs/promises');
    
    try {
      const indexContent = await readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexContent);
      return NextResponse.json(index);
    } catch {
      // No index file exists yet
      return NextResponse.json({ 
        lastSynced: null,
        totalGroups: 0,
        groups: []
      });
    }
  } catch (error) {
    console.error('Error reading prompts index:', error);
    return NextResponse.json(
      { error: 'Failed to read prompts index' },
      { status: 500 }
    );
  }
}