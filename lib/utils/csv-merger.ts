import { TranslationEntry, TranslationGroup, TranslationResult } from '../types/translation-group';

export function mergeTranslationResults(
  originalEntries: TranslationEntry[],
  groups: TranslationGroup[],
  results: Map<string, Map<string, TranslationResult>>,
  includeMetadata: boolean = true
): { entries: TranslationEntry[]; headers: string[] } {
  // Create headers array starting with original columns
  const baseHeaders = ['Key', 'Source', 'English Original'];
  const translationHeaders: string[] = [];

  // Add headers for each translation group
  groups.forEach(group => {
    translationHeaders.push(group.columnName);
    if (includeMetadata) {
      translationHeaders.push(`${group.columnName} Category`);
      translationHeaders.push(`${group.columnName} Reasoning`);
    }
  });

  const headers = [...baseHeaders, ...translationHeaders];

  // Merge results into entries
  const mergedEntries = originalEntries.map(entry => {
    const mergedEntry: TranslationEntry = { ...entry };

    groups.forEach(group => {
      const groupResults = results.get(group.id);
      if (groupResults) {
        const result = groupResults.get(entry.key);
        if (result) {
          mergedEntry[group.columnName] = result.translation;
          if (includeMetadata) {
            mergedEntry[`${group.columnName} Category`] = result.category;
            mergedEntry[`${group.columnName} Reasoning`] = result.reasoning;
          }
        } else {
          // Set empty values if no result
          mergedEntry[group.columnName] = '';
          if (includeMetadata) {
            mergedEntry[`${group.columnName} Category`] = '';
            mergedEntry[`${group.columnName} Reasoning`] = '';
          }
        }
      }
    });

    return mergedEntry;
  });

  return { entries: mergedEntries, headers };
}

export function generateCSVContent(entries: TranslationEntry[], headers: string[]): string {
  // Create CSV header row
  const headerRow = headers.map(h => `"${h}"`).join(',');

  // Create data rows
  const dataRows = entries.map(entry => {
    return headers.map(header => {
      // Map new headers to internal field names
      let fieldName = header;
      if (header === 'Key') fieldName = 'key';
      else if (header === 'Source') fieldName = 'source';
      else if (header === 'English Original') fieldName = 'english';
      
      const value = entry[fieldName] || '';
      // Escape quotes and wrap in quotes
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}