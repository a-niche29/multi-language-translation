import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { SavedTranslationGroup } from 'mlt/lib/storage/saved-groups';

export async function GET() {
  try {
    const promptsDir = path.join(process.cwd(), 'saved-prompts');
    
    try {
      // Read all JSON files from the saved-prompts directory
      const files = await readdir(promptsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'index.json' && f !== 'README.md');
      
      const savedGroups: SavedTranslationGroup[] = [];
      
      for (const file of jsonFiles) {
        try {
          const content = await readFile(path.join(promptsDir, file), 'utf-8');
          const group = JSON.parse(content) as SavedTranslationGroup;
          savedGroups.push(group);
        } catch {
          console.error(`Failed to read ${file}`);
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        groups: savedGroups,
        count: savedGroups.length 
      });
    } catch {
      // Directory doesn't exist
      return NextResponse.json({ 
        success: true, 
        groups: [],
        count: 0,
        message: 'No saved prompts directory found'
      });
    }
  } catch (error) {
    console.error('Error reading saved prompts:', error);
    return NextResponse.json(
      { error: 'Failed to read saved prompts', success: false },
      { status: 500 }
    );
  }
}