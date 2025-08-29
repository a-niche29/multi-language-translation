import { TranslationGroup } from '../types/translation-group';

export interface SavedTranslationGroup {
  id: string;
  name: string;
  description?: string;
  group: Omit<TranslationGroup, 'id' | 'status' | 'progress' | 'results' | 'error'>;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'mlt_saved_groups';

export const savedGroupsStorage = {
  getAll(): SavedTranslationGroup[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  save(savedGroup: SavedTranslationGroup): void {
    if (typeof window === 'undefined') return;
    const groups = this.getAll();
    const existingIndex = groups.findIndex(g => g.id === savedGroup.id);
    
    if (existingIndex >= 0) {
      groups[existingIndex] = { ...savedGroup, updatedAt: new Date().toISOString() };
    } else {
      groups.push(savedGroup);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  },

  delete(id: string): void {
    if (typeof window === 'undefined') return;
    const groups = this.getAll().filter(g => g.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  },

  createFromGroup(name: string, description: string | undefined, group: TranslationGroup): SavedTranslationGroup {
    const now = new Date().toISOString();
    return {
      id: `saved_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      group: {
        name: group.name,
        columnName: group.columnName,
        provider: group.provider,
        model: group.model,
        systemPrompt: group.systemPrompt,
        userPrompt: group.userPrompt
      },
      createdAt: now,
      updatedAt: now
    };
  },

  applyToGroup(savedGroup: SavedTranslationGroup, targetGroupId: string): TranslationGroup {
    return {
      id: targetGroupId,
      ...savedGroup.group,
      status: 'pending',
      progress: 0
    };
  },

  importFromJSON(jsonData: string): { success: boolean; imported: number; errors: string[] } {
    if (typeof window === 'undefined') {
      return { success: false, imported: 0, errors: ['Not in browser environment'] };
    }

    const errors: string[] = [];
    let imported = 0;

    try {
      const data = JSON.parse(jsonData);
      const groups = Array.isArray(data) ? data : [data];

      for (const item of groups) {
        try {
          // Validate required fields
          if (!item.name || !item.group || !item.group.name || !item.group.columnName) {
            errors.push(`Invalid group format: missing required fields`);
            continue;
          }

          // Create a new saved group with fresh IDs
          const savedGroup: SavedTranslationGroup = {
            id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: item.name,
            description: item.description || 'Imported from external source',
            group: {
              name: item.group.name,
              columnName: item.group.columnName,
              provider: item.group.provider || 'openai',
              model: item.group.model || 'gpt-4.1-mini',
              systemPrompt: item.group.systemPrompt || '',
              userPrompt: item.group.userPrompt || ''
            },
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          this.save(savedGroup);
          imported++;
        } catch (err) {
          errors.push(`Failed to import group: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      return { success: imported > 0, imported, errors };
    } catch (err) {
      return { 
        success: false, 
        imported: 0, 
        errors: [`Failed to parse JSON: ${err instanceof Error ? err.message : 'Unknown error'}`] 
      };
    }
  },

  exportToJSON(groupIds?: string[]): string {
    const groups = this.getAll();
    const toExport = groupIds 
      ? groups.filter(g => groupIds.includes(g.id))
      : groups;
    
    return JSON.stringify(toExport, null, 2);
  }
};