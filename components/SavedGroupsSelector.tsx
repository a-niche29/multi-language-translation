'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, FileText, X, Edit2, Download, Upload } from 'lucide-react';
import { SavedTranslationGroup, savedGroupsStorage } from 'mlt/lib/storage/saved-groups';
import { TranslationGroup } from 'mlt/lib/types/translation-group';
import { PromptSyncButton } from './prompt-sync-button';

interface SavedGroupsSelectorProps {
  onLoadGroups: (groups: Partial<TranslationGroup>[]) => void;
  onEditGroup: (group: SavedTranslationGroup) => void;
  refreshTrigger?: number;
}

export default function SavedGroupsSelector({ onLoadGroups, onEditGroup, refreshTrigger }: SavedGroupsSelectorProps) {
  const [savedGroups, setSavedGroups] = useState<SavedTranslationGroup[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [importMessage, setImportMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSavedGroups(savedGroupsStorage.getAll());
  }, [refreshTrigger]);

  const handleToggleGroup = (groupId: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedGroups(newSelected);
  };

  const handleLoadSelected = () => {
    const groupsToLoad = savedGroups
      .filter(sg => selectedGroups.has(sg.id))
      .map(sg => ({
        name: sg.group.name,
        columnName: sg.group.columnName,
        provider: sg.group.provider,
        model: sg.group.model,
        systemPrompt: sg.group.systemPrompt,
        userPrompt: sg.group.userPrompt,
        status: 'pending' as const,
        progress: 0
      }));
    
    onLoadGroups(groupsToLoad);
    setSelectedGroups(new Set());
    setIsOpen(false);
  };

  const handleDeleteGroup = (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    savedGroupsStorage.delete(groupId);
    setSavedGroups(savedGroupsStorage.getAll());
    selectedGroups.delete(groupId);
    setSelectedGroups(new Set(selectedGroups));
  };

  const handleExport = () => {
    const exportData = selectedGroups.size > 0 
      ? savedGroupsStorage.exportToJSON(Array.from(selectedGroups))
      : savedGroupsStorage.exportToJSON();
    
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translation-prompts-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setImportMessage({ 
      text: `Exported ${selectedGroups.size > 0 ? selectedGroups.size : savedGroups.length} prompt configurations`, 
      type: 'success' 
    });
    setTimeout(() => setImportMessage(null), 3000);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = savedGroupsStorage.importFromJSON(text);
      
      if (result.success) {
        setSavedGroups(savedGroupsStorage.getAll());
        setImportMessage({ 
          text: `Successfully imported ${result.imported} prompt configuration${result.imported > 1 ? 's' : ''}`, 
          type: 'success' 
        });
      } else {
        setImportMessage({ 
          text: result.errors.join(', '), 
          type: 'error' 
        });
      }
    } catch {
      setImportMessage({ 
        text: 'Failed to import file. Please check the file format.', 
        type: 'error' 
      });
    }

    // Clear the input value so the same file can be imported again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setTimeout(() => setImportMessage(null), 5000);
  };

  const handleImportFromSavedPrompts = async () => {
    setIsImporting(true);
    try {
      const response = await fetch('/api/import-saved-prompts');
      const data = await response.json();
      
      if (data.success && data.groups.length > 0) {
        let imported = 0;
        const errors: string[] = [];
        
        for (const group of data.groups) {
          try {
            // Check if this prompt already exists (by name and creation time)
            const existing = savedGroups.find(g => 
              g.name === group.name && g.createdAt === group.createdAt
            );
            
            if (!existing) {
              savedGroupsStorage.save(group);
              imported++;
            }
          } catch {
            errors.push(`Failed to import ${group.name}`);
          }
        }
        
        if (imported > 0) {
          setSavedGroups(savedGroupsStorage.getAll());
          setImportMessage({ 
            text: `Successfully imported ${imported} saved prompt${imported > 1 ? 's' : ''}${errors.length > 0 ? ` (${errors.length} skipped)` : ''}`, 
            type: 'success' 
          });
        } else {
          setImportMessage({ 
            text: 'All prompts have already been imported', 
            type: 'success' 
          });
        }
      } else {
        setImportMessage({ 
          text: data.message || 'No saved prompts found to import', 
          type: 'error' 
        });
      }
    } catch {
      setImportMessage({ 
        text: 'Failed to import saved prompts', 
        type: 'error' 
      });
    } finally {
      setIsImporting(false);
      setTimeout(() => setImportMessage(null), 5000);
    }
  };

  // Show the button even if no saved groups exist, to allow importing

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-blue-700 text-white hover:bg-blue-800 transition-colors"
      >
        <FileText size={20} />
        <span className="font-medium">Load Saved Templates</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[36rem] bg-white border border-gray-300 rounded-lg shadow-lg z-10">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-800">Select templates to load</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleImportFromSavedPrompts}
                  disabled={isImporting}
                  className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-blue-700 text-white border border-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-50"
                  title="Import from previously saved prompts"
                >
                  <Upload className="h-4 w-4" />
                  {isImporting ? 'Loading...' : 'From Backup'}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-blue-700 text-white border border-blue-700 rounded-md hover:bg-blue-800"
                  title="Import prompts from JSON file"
                >
                  <Upload className="h-4 w-4" />
                  From File
                </button>
                <button
                  onClick={handleExport}
                  disabled={savedGroups.length === 0}
                  className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-blue-700 text-white border border-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-50"
                  title={selectedGroups.size > 0 ? 'Export selected prompts' : 'Export all prompts'}
                >
                  <Download className="h-4 w-4" />
                  Export {selectedGroups.size > 0 && `(${selectedGroups.size})`}
                </button>
                <PromptSyncButton />
              </div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => {
                  if (selectedGroups.size === savedGroups.length) {
                    setSelectedGroups(new Set());
                  } else {
                    setSelectedGroups(new Set(savedGroups.map(g => g.id)));
                  }
                }}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
              >
                <div className={`w-4 h-4 border-2 rounded ${
                  selectedGroups.size === savedGroups.length && savedGroups.length > 0
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-400'
                } flex items-center justify-center`}>
                  {selectedGroups.size === savedGroups.length && savedGroups.length > 0 && (
                    <Check size={12} className="text-white" />
                  )}
                </div>
                <span>Select All</span>
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Choose one or more saved templates
            </p>
            {importMessage && (
              <div className={`mt-2 p-2 text-sm rounded ${
                importMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                {importMessage.text}
              </div>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto">
            {savedGroups.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p className="mb-2">No saved templates found</p>
                <p className="text-sm">Import from backup or create new templates</p>
              </div>
            ) : (
              savedGroups.map(group => (
              <div
                key={group.id}
                onClick={() => handleToggleGroup(group.id)}
                className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <div className={`w-5 h-5 border-2 rounded ${
                      selectedGroups.has(group.id)
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-gray-400'
                    } flex items-center justify-center`}>
                      {selectedGroups.has(group.id) && (
                        <Check size={14} className="text-white" />
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-800">{group.name}</h4>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditGroup(group);
                            setIsOpen(false);
                          }}
                          className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
                          title="Edit template"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteGroup(e, group.id)}
                          className="p-1 text-gray-600 hover:text-red-600 transition-colors"
                          title="Delete saved template"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                    {group.description && (
                      <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>{group.group.provider} - {group.group.model}</span>
                      <span>{group.group.name}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
            )}
          </div>

          <div className="p-4 border-t bg-gray-50">
            <div className="flex gap-2">
              <button
                onClick={handleLoadSelected}
                disabled={selectedGroups.size === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Load {selectedGroups.size > 0 ? `${selectedGroups.size} Template${selectedGroups.size > 1 ? 's' : ''}` : 'Selected'}
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setSelectedGroups(new Set());
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 text-sm text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />
    </div>
  );
}