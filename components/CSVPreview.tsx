'use client';

import { TranslationEntry } from 'mlt/lib/types/translation-group';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CSVPreviewProps {
  fileName: string;
  entries: TranslationEntry[];
  headers: string[];
  validationErrors?: string[];
  onClose: () => void;
}

export default function CSVPreview({ fileName, entries, headers, validationErrors = [], onClose }: CSVPreviewProps) {
  const requiredColumns = [
    { display: 'Key', header: 'key' },
    { display: 'Source', header: 'source' },
    { display: 'English Original', header: 'english original', altHeader: 'english' }
  ];
  const hasAllRequired = requiredColumns.every(col => 
    headers.some(h => h.toLowerCase() === col.header.toLowerCase() || 
                     (col.altHeader && h.toLowerCase() === col.altHeader.toLowerCase()))
  );
  
  // Get first 10 entries for preview
  const previewEntries = entries.slice(0, 10);
  const hasMore = entries.length > 10;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-black">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-black">CSV Preview</h2>
              <p className="text-sm text-black mt-1">{fileName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-blue-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Statistics and Requirements */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-medium text-black mb-2">CSV Statistics</h3>
              <ul className="space-y-1 text-sm text-black">
                <li>Total rows: <span className="font-medium text-black">{entries.length}</span></li>
                <li>Total columns: <span className="font-medium text-black">{headers.length}</span></li>
                <li>Columns: <span className="font-medium text-black">{headers.join(', ')}</span></li>
              </ul>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-medium text-black mb-2">Required Format</h3>
              <div className="space-y-2">
                <p className="text-sm text-black">Your CSV must contain these columns:</p>
                <ul className="space-y-1">
                  {requiredColumns.map(col => {
                    const hasColumn = headers.some(h => 
                      h.toLowerCase() === col.header.toLowerCase() || 
                      (col.altHeader && h.toLowerCase() === col.altHeader.toLowerCase())
                    );
                    return (
                      <li key={col.header} className="flex items-center gap-2 text-sm">
                        {hasColumn ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className={hasColumn ? 'text-green-700' : 'text-red-700'}>
                          <strong>{col.display}</strong>
                          {col.header === 'key' && ' - Unique identifier for each translation'}
                          {col.header === 'source' && ' - Source context or location'}
                          {col.header === 'english original' && ' - English text to translate'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Validation Errors
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Data Preview Table */}
          {hasAllRequired && (
            <div>
              <h3 className="font-medium text-black mb-3">Data Preview</h3>
              <div className="overflow-x-auto border border-black rounded-lg">
                <table className="min-w-full divide-y divide-black">
                  <thead className="bg-blue-50">
                    <tr>
                      {headers.map(header => (
                        <th
                          key={header}
                          className="px-4 py-3 text-left text-xs font-medium text-black uppercase tracking-wider"
                        >
                          {header}
                          {requiredColumns.some(col => 
                            col.header.toLowerCase() === header.toLowerCase() || 
                            (col.altHeader && col.altHeader.toLowerCase() === header.toLowerCase())
                          ) && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-black">
                    {previewEntries.map((entry, index) => (
                      <tr key={index}>
                        {headers.map(header => (
                          <td key={header} className="px-4 py-3 text-sm text-black">
                            <div className="max-w-xs truncate" title={entry[header]}>
                              {entry[header] || <span className="text-black italic">empty</span>}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasMore && (
                <p className="text-sm text-black mt-3 text-center">
                  Showing first 10 rows of {entries.length} total rows
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-black bg-blue-50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-black">
              {hasAllRequired ? (
                <span className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  CSV format is valid and ready for translation
                </span>
              ) : (
                <span className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-4 h-4" />
                  Missing required columns
                </span>
              )}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}