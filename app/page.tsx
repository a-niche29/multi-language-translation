'use client';

import { useState, useEffect } from 'react';
import { TranslationGroup, TranslationEntry, MergedResults } from 'mlt/lib/types/translation-group';
import TranslationGroupCard from 'mlt/components/TranslationGroupCard';
import SavedGroupsSelector from 'mlt/components/SavedGroupsSelector';
import TranslationResults from 'mlt/components/TranslationResults';
import CSVPreview from 'mlt/components/CSVPreview';
import BatchSettings, { BatchConfig } from 'mlt/components/BatchSettings';
import GroupModal from 'mlt/components/GroupModal';
import RowRangeSelector, { RowRange } from 'mlt/components/RowRangeSelector';
import TranslationStatusTracker, { updateTranslationStatus } from 'mlt/components/TranslationStatusTracker';
import { parseCSV, validateCSVData } from 'mlt/lib/utils/csv-parser';
import { Upload, Plus, Play, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { SavedTranslationGroup } from 'mlt/lib/storage/saved-groups';

export default function Home() {
  const [groups, setGroups] = useState<TranslationGroup[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<TranslationEntry[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvValidationErrors, setCsvValidationErrors] = useState<string[]>([]);
  const [showCSVPreview, setShowCSVPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [translationResults, setTranslationResults] = useState<MergedResults | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SavedTranslationGroup | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedRowRange, setSelectedRowRange] = useState<RowRange | null>(null);
  const [batchConfig, setBatchConfig] = useState<BatchConfig>({
    openai: {
      concurrentBatches: 3,
      batchSize: 5,
      delayMs: 1000
    },
    anthropic: {
      concurrentBatches: 5,
      batchSize: 8,
      delayMs: 500
    },
    google: {
      concurrentBatches: 3,
      batchSize: 5,
      delayMs: 1000
    }
  });
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const [onlyRetryErrors, setOnlyRetryErrors] = useState(false);

  // Fetch available providers on mount
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => setAvailableProviders(data.providers))
      .catch(() => setError('Failed to fetch available providers'));
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setCsvValidationErrors([]);
    const result = await parseCSV(file);
    
    if (!result.success || !result.data) {
      setError(result.error || 'Failed to parse CSV');
      return;
    }

    const validation = validateCSVData(result.data);
    setCsvFile(file);
    setCsvData(result.data);
    setCsvHeaders(result.headers || []);
    
    if (!validation.valid) {
      setCsvValidationErrors(validation.errors);
      setShowCSVPreview(true); // Show preview even with errors
    }
  };

  const handleSaveAsGroup = () => {
    setRefreshTrigger(prev => prev + 1);
    setShowGroupModal(false);
    setEditingGroup(null);
  };

  const handleSaveAndUse = (group: TranslationGroup) => {
    setGroups([...groups, group]);
    setShowGroupModal(false);
    setEditingGroup(null);
  };

  const handleEditGroup = (group: SavedTranslationGroup) => {
    setEditingGroup(group);
    setShowGroupModal(true);
  };

  const removeGroup = (id: string) => {
    setGroups(groups.filter(g => g.id !== id));
  };

  const startTranslation = async () => {
    if (!csvData.length || !groups.length) return;

    // Validate all groups have required fields
    const invalidGroups = groups.filter(g => 
      !g.name || !g.columnName || !g.systemPrompt || !g.userPrompt
    );
    if (invalidGroups.length > 0) {
      setError('Please fill in all required fields for each translation group');
      return;
    }

    // Validate providers are available
    const requiredProviders = [...new Set(groups.map(g => g.provider))];
    const unavailableProviders = requiredProviders.filter(p => !availableProviders.includes(p));
    
    if (unavailableProviders.length > 0) {
      setError(`The following providers are not configured: ${unavailableProviders.join(', ')}`);
      return;
    }

    setIsProcessing(true);
    setError('');
    setTranslationResults(null);

    // Update all groups to processing status
    setGroups(groups.map(g => ({ ...g, status: 'processing', progress: 0 })));

    // Get the entries to translate based on selected range
    let entriesToTranslate = csvData;
    if (selectedRowRange) {
      // Array is 0-indexed, but row numbers are 1-indexed
      entriesToTranslate = csvData.slice(
        selectedRowRange.startRow - 1,
        selectedRowRange.endRow
      );
    }

    // Filter entries if only retrying errors
    if (onlyRetryErrors && translationResults) {
      entriesToTranslate = entriesToTranslate.filter(entry => {
        // Check if any language group has an error or missing translation for this entry
        return groups.some(group => {
          // Find the entry in the merged results
          const resultEntry = translationResults.entries.find(e => e.key === entry.key);
          if (!resultEntry) {
            return true; // Include if entry not found
          }
          
          // Check if translation exists for this group
          const translation = resultEntry[group.columnName];
          const category = resultEntry[`${group.columnName} Category`];
          
          if (!translation || translation === '') {
            return true; // Missing translation
          }
          
          // Check if it's an error or unchanged translation
          return translation === '[ERROR]' || 
                 translation === entry.english || // Unchanged from source
                 category === 'Error';
        });
      });

      if (entriesToTranslate.length === 0) {
        setError('No entries with errors or missing translations found');
        setIsProcessing(false);
        return;
      }
    }

    try {
      const response = await fetch('/api/translate-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: entriesToTranslate,
          groups,
          batchConfig,
          previousResults: onlyRetryErrors ? translationResults : null,
          rowRange: selectedRowRange,
          includeMetadata
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start translation');
      }

      // Read the SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response stream available');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        
        // Keep the last incomplete chunk in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmedLine.slice(6));

              switch (data.type) {
                case 'progress':
                  // Update individual group progress
                  setGroups(prev => prev.map(g => 
                    g.id === data.groupId 
                      ? { ...g, progress: data.progress }
                      : g
                  ));
                  break;

                case 'complete':
                  // Update all groups to completed and show results
                  setGroups(prev => prev.map(g => ({ ...g, status: 'completed', progress: 100 })));
                  setTranslationResults(data.results);
                  setShowResults(true);
                  // Update translation status tracking
                  updateTranslationStatus(data.results, selectedRowRange, csvData.length);
                  break;

                case 'error':
                  throw new Error(data.error);

                default:
                  break;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
      
      // Process any remaining data in buffer
      if (buffer.trim().startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.trim().slice(6));
          
          switch (data.type) {
            case 'complete':
              setTranslationResults(data.results);
              setGroups(groups.map(g => ({ ...g, status: 'completed' })));
              break;
            case 'error':
              setError(data.error);
              setGroups(groups.map(g => ({ ...g, status: 'failed' })));
              break;
          }
        } catch (e) {
          console.error('Failed to parse final SSE data:', e);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed');
      setGroups(groups.map(g => ({ ...g, status: 'failed' })));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-black">
            Multi-Language Parallel Translation
          </h1>
          {/* Results Available Indicator */}
          {!showResults && translationResults && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">Translation results available</span>
            </div>
          )}
        </div>

        {/* Available Providers Section removed - configuration is done within each translation group */}

        {/* Batch Settings */}
        <BatchSettings 
          config={batchConfig} 
          onChange={setBatchConfig} 
        />

        {/* Translation Status Tracker - show if there's previous progress */}
        {csvData.length > 0 && groups.length > 0 && (
          <TranslationStatusTracker
            csvData={csvData}
            groups={groups}
            onResume={(startRow, endRow) => {
              setSelectedRowRange({ startRow, endRow, enabled: true });
              // Auto-start translation after setting range
              setTimeout(() => startTranslation(), 100);
            }}
            isProcessing={isProcessing}
          />
        )}

        {/* Row Range Selector - only show when CSV is loaded */}
        {csvData.length > 0 && (
          <RowRangeSelector
            totalRows={csvData.length}
            onRangeChange={setSelectedRowRange}
          />
        )}

        {/* Output Format Settings */}
        {csvData.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h3 className="text-lg font-semibold text-black mb-4">Output Format</h3>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
              />
              <span className="text-sm text-gray-700">
                Include category and reasoning columns (adds 2 extra columns per language)
              </span>
            </label>
          </div>
        )}

        {/* File Upload Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          {!csvFile ? (
            <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex flex-col items-center justify-center">
                <Upload className="w-8 h-8 mb-1 text-gray-400" />
                <p className="text-sm text-gray-600">Upload CSV</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".csv"
                onChange={handleFileUpload}
              />
            </label>
          ) : (
            <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{csvFile.name}</p>
                  <p className="text-xs text-gray-500">{csvData.length} entries</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCSVPreview(true)}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                >
                  Preview
                </button>
                <button
                  onClick={() => {
                    setCsvFile(null);
                    setCsvData([]);
                    setCsvHeaders([]);
                    setCsvValidationErrors([]);
                    setTranslationResults(null);
                  }}
                  className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-8 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <pre className="text-sm text-red-800 whitespace-pre-wrap font-medium">{error}</pre>
          </div>
        )}

        {/* Templates Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Translation Sets</h2>
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setShowGroupModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create New Configuration
            </button>
            <SavedGroupsSelector 
              onLoadGroups={(loadedGroups) => {
                const newGroups = loadedGroups.map(g => ({
                  ...g,
                  id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                })) as TranslationGroup[];
                setGroups([...groups, ...newGroups]);
              }}
              onEditGroup={handleEditGroup}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </div>

        {/* Active Translation Configurations */}
        {groups.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Active Configurations</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map(group => (
                <TranslationGroupCard
                  key={group.id}
                  group={group}
                  onRemove={() => removeGroup(group.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Translation Preview */}
        {groups.length > 0 && csvData.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-black mb-4">Translation Preview</h3>
            <div className="space-y-3">
              <div className="text-sm text-black mb-3">
                The following translations will be generated:
              </div>
              {groups.map((group, index) => (
                <div key={group.id} className="flex items-center gap-4 bg-white rounded-md p-3 border border-black">
                  <span className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium text-black">
                      {group.name || <span className="text-black italic">Language not specified</span>}
                    </div>
                    <div className="text-sm text-black">
                      Column: {group.columnName || <span className="text-black italic">Column name not specified</span>}
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      group.provider === 'openai' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {group.provider === 'openai' ? 'OpenAI' : 'Anthropic'} - {group.model}
                    </span>
                  </div>
                </div>
              ))}
              <div className="text-sm text-black mt-3 pt-3 border-t border-black">
                {(() => {
                  let entriesToProcess = csvData;
                  if (selectedRowRange) {
                    entriesToProcess = csvData.slice(selectedRowRange.startRow - 1, selectedRowRange.endRow);
                  }
                  
                  if (onlyRetryErrors && translationResults) {
                    const errorEntries = entriesToProcess.filter(entry => {
                      // Find the entry in the results
                      const resultEntry = translationResults.entries.find(e => e.key === entry.key);
                      if (!resultEntry) return true; // Include if not found in results
                      
                      return groups.some(group => {
                        const translation = resultEntry[group.columnName];
                        const category = resultEntry[`${group.columnName} Category`];
                        
                        // Check if translation is missing or has error
                        return !translation || 
                               translation === '[ERROR]' || 
                               translation === '' || 
                               translation === entry.english ||
                               category === 'Error';
                      });
                    });
                    
                    return (
                      <>
                        <strong>{errorEntries.length}</strong> entries with errors or missing translations
                        {selectedRowRange && ` (from rows ${selectedRowRange.startRow} to ${selectedRowRange.endRow})`}
                        {' '}will be retranslated into <strong>{groups.length}</strong> language{groups.length !== 1 ? 's' : ''}
                      </>
                    );
                  }
                  
                  if (selectedRowRange) {
                    return (
                      <>
                        <strong>{selectedRowRange.endRow - selectedRowRange.startRow + 1}</strong> of {csvData.length} entries 
                        (rows {selectedRowRange.startRow} to {selectedRowRange.endRow}) will be translated into <strong>{groups.length}</strong> language{groups.length !== 1 ? 's' : ''}
                      </>
                    );
                  }
                  
                  return (
                    <>
                      <strong>{csvData.length}</strong> entries will be translated into <strong>{groups.length}</strong> language{groups.length !== 1 ? 's' : ''}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Retry Errors Option - only show when we have translation results */}
        {translationResults && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h3 className="text-lg font-semibold text-black mb-4">Translation Options</h3>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={onlyRetryErrors}
                onChange={(e) => setOnlyRetryErrors(e.target.checked)}
                className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
              />
              <span className="text-sm text-gray-700">
                Only translate entries with errors or missing translations
              </span>
            </label>
            {onlyRetryErrors && translationResults && (
              <p className="text-xs text-gray-500 mt-2 ml-7">
                This will skip successfully translated entries and only process failed ones
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={startTranslation}
            disabled={!csvData.length || !groups.length || isProcessing}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play size={20} />
            {isProcessing ? 'Processing...' : 'Start Parallel Translation'}
          </button>
          
          {/* View Results Button - shows when results exist but modal is closed */}
          {!showResults && translationResults && (
            <button
              onClick={() => setShowResults(true)}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FileText size={20} />
              View Previous Results
            </button>
          )}
        </div>

        {/* Translation Results Modal */}
        {showResults && translationResults && (
          <TranslationResults
            results={translationResults}
            groups={groups}
            onClose={() => setShowResults(false)}
          />
        )}

        {/* CSV Preview Modal */}
        {showCSVPreview && csvFile && (
          <CSVPreview
            fileName={csvFile.name}
            entries={csvData}
            headers={csvHeaders}
            validationErrors={csvValidationErrors}
            onClose={() => setShowCSVPreview(false)}
          />
        )}

        {/* Group Modal */}
        <GroupModal
          isOpen={showGroupModal}
          onClose={() => {
            setShowGroupModal(false);
            setEditingGroup(null);
          }}
          onSaveAsGroup={handleSaveAsGroup}
          onSaveAndUse={handleSaveAndUse}
          availableProviders={availableProviders}
          editingGroup={editingGroup}
        />
      </div>
    </main>
  );
}