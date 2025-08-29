'use client';

import { useState, useEffect } from 'react';
import { TranslationGroup, TranslationEntry } from 'mlt/lib/types/translation-group';
import { Play, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';

export interface TranslationStatus {
  totalRows: number;
  translatedRows: Set<number>; // Row indices that have been translated
  failedRows: Set<number>; // Row indices that failed
  lastTranslatedRow: number;
}

interface TranslationStatusTrackerProps {
  csvData: TranslationEntry[];
  groups: TranslationGroup[];
  onResume: (startRow: number, endRow: number) => void;
  isProcessing: boolean;
}

const STORAGE_KEY = 'mlt_translation_status';

export default function TranslationStatusTracker({ 
  csvData, 
  groups, 
  onResume,
  isProcessing 
}: TranslationStatusTrackerProps) {
  const [status, setStatus] = useState<TranslationStatus | null>(null);

  // Load status from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && csvData.length > 0) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsedStatus = JSON.parse(stored);
          // Convert arrays back to Sets
          parsedStatus.translatedRows = new Set(parsedStatus.translatedRows);
          parsedStatus.failedRows = new Set(parsedStatus.failedRows);
          
          // Validate that the status matches current CSV
          if (parsedStatus.totalRows === csvData.length) {
            setStatus(parsedStatus);
          } else {
            // CSV has changed, clear old status
            localStorage.removeItem(STORAGE_KEY);
            setStatus(null);
          }
        } catch (e) {
          console.error('Failed to parse translation status:', e);
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
  }, [csvData.length]);

  // Currently unused but kept for future use
  // const saveStatus = (newStatus: TranslationStatus) => {
  //   // Convert Sets to arrays for storage
  //   const storableStatus = {
  //     ...newStatus,
  //     translatedRows: Array.from(newStatus.translatedRows),
  //     failedRows: Array.from(newStatus.failedRows)
  //   };
  //   localStorage.setItem(STORAGE_KEY, JSON.stringify(storableStatus));
  //   setStatus(newStatus);
  // };

  const handleResumeFromRow = (startRow: number) => {
    const endRow = csvData.length;
    onResume(startRow, endRow);
  };

  const handleResumeNextBatch = () => {
    if (!status) return;
    
    const nextUntranslatedRow = findNextUntranslatedRow();
    if (nextUntranslatedRow !== -1) {
      // Resume with next 50 rows or until end
      const batchSize = 50;
      const endRow = Math.min(nextUntranslatedRow + batchSize - 1, csvData.length);
      onResume(nextUntranslatedRow, endRow);
    }
  };

  const findNextUntranslatedRow = (): number => {
    if (!status) return 1;
    
    for (let i = 1; i <= csvData.length; i++) {
      if (!status.translatedRows.has(i - 1) && !status.failedRows.has(i - 1)) {
        return i;
      }
    }
    return -1;
  };

  const clearStatus = () => {
    localStorage.removeItem(STORAGE_KEY);
    setStatus(null);
  };

  if (!status || csvData.length === 0 || groups.length === 0) {
    return null;
  }

  const translatedCount = status.translatedRows.size;
  const failedCount = status.failedRows.size;
  const remainingCount = csvData.length - translatedCount - failedCount;
  const progressPercentage = ((translatedCount + failedCount) / csvData.length) * 100;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-8 border-2 border-blue-500">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-black">Previous Translation Progress</h3>
        <button
          onClick={clearStatus}
          className="text-sm text-red-600 hover:text-red-800"
        >
          Clear history
        </button>
      </div>

      <div className="space-y-4">
        {/* Progress bar */}
        <div className="w-full bg-blue-100 rounded-full h-3 overflow-hidden">
          <div 
            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-semibold">{translatedCount}</span>
            </div>
            <span className="text-black">Translated</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
              <AlertCircle className="w-4 h-4" />
              <span className="font-semibold">{failedCount}</span>
            </div>
            <span className="text-black">Failed</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
              <RotateCcw className="w-4 h-4" />
              <span className="font-semibold">{remainingCount}</span>
            </div>
            <span className="text-black">Remaining</span>
          </div>
        </div>

        {/* Resume options */}
        {remainingCount > 0 && (
          <div className="border-t border-black pt-4 space-y-3">
            <p className="text-sm text-black">
              You have {remainingCount} untranslated rows. Resume translation from:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={handleResumeNextBatch}
                disabled={isProcessing}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4" />
                Next {Math.min(50, remainingCount)} rows
              </button>
              
              <button
                onClick={() => handleResumeFromRow(findNextUntranslatedRow())}
                disabled={isProcessing}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4" />
                All remaining rows
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Export a function to update translation status from the main component
export function updateTranslationStatus(
  results: { entries: Record<string, string>[] },
  rowRange: { startRow: number; endRow: number } | null,
  totalRows: number
) {
  const stored = localStorage.getItem(STORAGE_KEY);
  let status: TranslationStatus;
  
  if (stored) {
    const parsed = JSON.parse(stored);
    status = {
      totalRows: parsed.totalRows,
      translatedRows: new Set(parsed.translatedRows),
      failedRows: new Set(parsed.failedRows),
      lastTranslatedRow: parsed.lastTranslatedRow
    };
  } else {
    status = {
      totalRows,
      translatedRows: new Set(),
      failedRows: new Set(),
      lastTranslatedRow: 0
    };
  }

  // Update status based on results
  if (results && results.entries) {
    const startIdx = rowRange ? rowRange.startRow - 1 : 0;
    
    results.entries.forEach((entry: Record<string, string>, index: number) => {
      const actualRowIndex = startIdx + index;
      
      // Check if any translation in this row failed
      const hasFailed = Object.values(entry).some(value => value === '[ERROR]');
      
      if (hasFailed) {
        status.failedRows.add(actualRowIndex);
        status.translatedRows.delete(actualRowIndex);
      } else {
        status.translatedRows.add(actualRowIndex);
        status.failedRows.delete(actualRowIndex);
      }
      
      status.lastTranslatedRow = Math.max(status.lastTranslatedRow, actualRowIndex + 1);
    });
  }

  // Save updated status
  const storableStatus = {
    ...status,
    translatedRows: Array.from(status.translatedRows),
    failedRows: Array.from(status.failedRows)
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storableStatus));
}