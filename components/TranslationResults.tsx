'use client';

import { useState } from 'react';
import { TranslationGroup, MergedResults } from 'mlt/lib/types/translation-group';
import { Download, X, FileSpreadsheet, FileJson, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { generateCSVContent, downloadCSV } from 'mlt/lib/utils/csv-merger';

interface TranslationResultsProps {
  results: MergedResults;
  groups: TranslationGroup[];
  onClose: () => void;
}

export default function TranslationResults({ results, groups, onClose }: TranslationResultsProps) {
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'xlsx'>('csv');
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const entries = results?.entries || [];
  
  // Debug logging
  console.log('TranslationResults - entries count:', entries?.length);
  console.log('TranslationResults - headers:', results?.headers);
  
  if (!results || !entries.length) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md p-6">
          <div className="flex items-center text-red-600 mb-4">
            <AlertCircle className="w-6 h-6 mr-2" />
            <h2 className="text-xl font-semibold">No Results Available</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Translation completed but no results were generated. This may be due to errors during processing.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Calculate detailed failure statistics
  const failureStats = groups.map(group => {
    const failedCount = entries.filter(entry => entry[group.columnName] === '[ERROR]').length;
    return {
      groupName: group.name,
      columnName: group.columnName,
      provider: group.provider,
      model: group.model,
      totalEntries: entries.length,
      failedCount,
      successCount: entries.length - failedCount,
      successRate: ((entries.length - failedCount) / entries.length * 100).toFixed(1)
    };
  });

  const totalTranslations = groups.length * entries.length;
  const totalFailures = failureStats.reduce((sum, stat) => sum + stat.failedCount, 0);
  const successfulTranslations = totalTranslations - totalFailures;
  const overallSuccessRate = ((successfulTranslations / totalTranslations) * 100).toFixed(1);

  const handleExport = async () => {
    console.log('handleExport - entries:', entries?.length);
    console.log('handleExport - headers:', results.headers);
    
    if (exportFormat === 'csv') {
      const headers = results?.headers || [];
      if (!headers.length) {
        alert('No headers available for CSV export');
        return;
      }
      const csvContent = generateCSVContent(entries, headers);
      console.log('CSV content length:', csvContent.length);
      console.log('CSV preview:', csvContent.substring(0, 500));
      downloadCSV(csvContent, 'translations_final.csv');
    } else if (exportFormat === 'json') {
      const jsonContent = JSON.stringify(entries, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'translations_final.json';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // XLSX export would require additional library
      alert('XLSX export not yet implemented');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div>
                <h2 className="text-2xl font-bold text-black">Translation Results</h2>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-sm text-black">
                    {successfulTranslations} of {totalTranslations} translations completed ({overallSuccessRate}% success rate)
                  </p>
                  <button
                    onClick={() => setShowDetailedStats(!showDetailedStats)}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    {showDetailedStats ? 'Hide' : 'Show'} detailed statistics
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-blue-100 rounded-lg"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Detailed Statistics Panel */}
        {showDetailedStats && (
          <div className="p-6 bg-blue-50 border-b border-black">
            <h3 className="font-semibold text-black mb-3">Translation Statistics by Group</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {failureStats.map((stat, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-black">
                  <h4 className="font-medium text-black mb-2">{stat.groupName}</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-black">Provider:</span>
                      <span className="font-medium">{stat.provider} ({stat.model})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-black">Success:</span>
                      <span className="font-medium text-green-600">{stat.successCount}/{stat.totalEntries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-black">Failed:</span>
                      <span className="font-medium text-red-600">{stat.failedCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-black">Success Rate:</span>
                      <span className="font-medium">{stat.successRate}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {totalFailures > 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  <p className="font-medium">Total {totalFailures} translations failed across all groups.</p>
                  <p>Failed entries are marked with [ERROR] in the table below.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Table */}
        <div className="flex-1 overflow-auto p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-black">
              <thead className="bg-blue-50 sticky top-0">
                <tr>
                  {results.headers.map(header => (
                    <th
                      key={header}
                      className="px-4 py-3 text-left text-xs font-medium text-black uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-black">
                {entries.map((entry) => (
                  <tr key={entry.key} className="hover:bg-blue-50">
                    {results.headers.map(header => {
                      const value = entry[header] || '';
                      const hasError = value === '[ERROR]';
                      const isTranslationColumn = groups.some(g => g.columnName === header);

                      return (
                        <td key={header} className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`${hasError ? 'text-red-600 font-medium' : 'text-black'}`}>
                              {value}
                            </span>
                            {hasError && isTranslationColumn && (
                              <span title="Translation failed">
                                <AlertCircle className="w-4 h-4 text-red-500" />
                              </span>
                            )}
                            {!hasError && isTranslationColumn && value && (
                              <span title="Translation successful">
                                <CheckCircle2 className="w-4 h-4 text-green-500 opacity-50" />
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Export Controls */}
        <div className="p-6 border-t border-black bg-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-black">Export format:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setExportFormat('csv')}
                  className={`px-3 py-1 text-sm rounded-md ${
                    exportFormat === 'csv'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-black border border-black hover:bg-blue-100'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 inline mr-1" />
                  CSV
                </button>
                <button
                  onClick={() => setExportFormat('json')}
                  className={`px-3 py-1 text-sm rounded-md ${
                    exportFormat === 'json'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-black border border-black hover:bg-blue-100'
                  }`}
                >
                  <FileJson className="w-4 h-4 inline mr-1" />
                  JSON
                </button>
                <button
                  onClick={() => setExportFormat('xlsx')}
                  className={`px-3 py-1 text-sm rounded-md ${
                    exportFormat === 'xlsx'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-black border border-black hover:bg-blue-100'
                  }`}
                  disabled
                >
                  <FileSpreadsheet className="w-4 h-4 inline mr-1" />
                  XLSX (Coming Soon)
                </button>
              </div>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <Download className="w-4 h-4" />
              Export Results
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}