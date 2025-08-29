'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { responseLogger } from '../lib/utils/response-logger';

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<ReturnType<typeof responseLogger.getRecentLogs>>([]);
  const [debugMode, setDebugMode] = useState(false);
  const [filter, setFilter] = useState<'all' | 'failed' | 'fallback'>('all');

  const updateLogs = useCallback(() => {
    let filteredLogs;
    switch (filter) {
      case 'failed':
        filteredLogs = responseLogger.getFailedResponses();
        break;
      case 'fallback':
        filteredLogs = responseLogger.getResponsesByParseMethod('fallback2');
        break;
      default:
        filteredLogs = responseLogger.getRecentLogs(20);
    }
    setLogs(filteredLogs);
  }, [filter]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isOpen) {
        updateLogs();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, updateLogs]);

  const toggleDebugMode = () => {
    const newMode = !debugMode;
    setDebugMode(newMode);
    if (newMode) {
      responseLogger.enableDebugMode();
    } else {
      responseLogger.disableDebugMode();
    }
  };

  const report = responseLogger.generateReport();

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-700"
      >
        🐛 Debug Panel
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 w-96 h-96 bg-white border-l border-t border-gray-200 shadow-lg overflow-hidden flex flex-col">
      <div className="bg-gray-800 text-white p-3 flex justify-between items-center">
        <h3 className="font-semibold">AI Response Debugger</h3>
        <button onClick={() => setIsOpen(false)} className="text-xl">×</button>
      </div>

      <div className="p-3 bg-gray-50 border-b">
        <div className="text-sm space-y-1">
          <p>Total Responses: {report.totalResponses}</p>
          <p>Success Rate: {report.successRate}</p>
          <p>Parse Methods: {JSON.stringify(report.parseMethodBreakdown)}</p>
        </div>
        
        <div className="flex gap-2 mt-2">
          <button
            onClick={toggleDebugMode}
            className={`px-2 py-1 text-xs rounded ${debugMode ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
          >
            Console Logging: {debugMode ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => responseLogger.downloadLogs()}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded"
          >
            Export Logs
          </button>
        </div>

        <div className="flex gap-1 mt-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-1 text-xs rounded ${filter === 'all' ? 'bg-gray-600 text-white' : 'bg-gray-200'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-2 py-1 text-xs rounded ${filter === 'failed' ? 'bg-red-500 text-white' : 'bg-gray-200'}`}
          >
            Failed
          </button>
          <button
            onClick={() => setFilter('fallback')}
            className={`px-2 py-1 text-xs rounded ${filter === 'fallback' ? 'bg-yellow-500 text-white' : 'bg-gray-200'}`}
          >
            Fallback2
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {logs.map((log, i) => (
          <div key={i} className={`text-xs p-2 rounded border ${
            log.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
          }`}>
            <div className="font-semibold">{log.input.text.substring(0, 50)}...</div>
            <div className="text-gray-600">
              {log.provider} • {log.model} • {log.parseMethod}
            </div>
            <details className="mt-1">
              <summary className="cursor-pointer text-blue-600">Raw Response</summary>
              <pre className="mt-1 p-1 bg-gray-100 rounded overflow-x-auto">{log.rawResponse}</pre>
            </details>
            <div className="mt-1">
              Result: {log.parsedResult.translation.substring(0, 50)}...
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}