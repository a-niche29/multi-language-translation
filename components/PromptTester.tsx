'use client';

import React, { useState } from 'react';
import { responseValidator } from '../lib/utils/response-validator';

interface TestResult {
  input: string;
  mockResponse: string;
  validation: {
    isValid: boolean;
    issues: string[];
    confidence: number;
    suggestedFix?: string;
  };
}

export function PromptTester() {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const commonProblematicResponses = [
    { input: "Hello", response: "s concise" },
    { input: "Hello", response: "Hola" },
    { input: "Hello", response: "greeting,Hola,Greeting,Common greeting" },
    { input: "Hello", response: "I'm ready to translate. Please provide the text." },
    { input: "Hello", response: "Translation: Hola" },
    { input: "Hello", response: "Hello" },
    { input: "Good morning", response: "formal" },
    { input: "Thank you", response: "polite friendly" },
  ];

  const testPrompt = () => {
    const results: TestResult[] = commonProblematicResponses.map(test => ({
      input: test.input,
      mockResponse: test.response,
      validation: responseValidator.validateTranslationResponse(
        test.response,
        test.input,
        targetLanguage
      )
    }));
    setTestResults(results);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700"
      >
        🧪 Test Prompts
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Prompt & Response Validator</h2>
          <button onClick={() => setIsOpen(false)} className="text-2xl">×</button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium mb-1">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Enter your system prompt..."
              className="w-full p-2 border rounded h-24"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">User Prompt Template</label>
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="Translate to Spanish: {{text}}"
              className="w-full p-2 border rounded h-24"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Target Language</label>
            <input
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>

          <button
            onClick={testPrompt}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Test Common Problematic Responses
          </button>

          {testResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Test Results:</h3>
              {testResults.map((result, i) => (
                <div key={i} className={`p-3 rounded border ${
                  result.validation.isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Input: &quot;{result.input}&quot;</p>
                      <p className="text-sm text-gray-600">Response: &quot;{result.mockResponse}&quot;</p>
                      <p className="text-sm mt-1">
                        Confidence: {result.validation.confidence}% | 
                        Status: {result.validation.isValid ? '✅ Valid' : '❌ Invalid'}
                      </p>
                    </div>
                  </div>
                  {result.validation.issues.length > 0 && (
                    <div className="mt-2 text-sm">
                      <p className="font-medium text-red-600">Issues:</p>
                      <ul className="list-disc list-inside text-red-600">
                        {result.validation.issues.map((issue, j) => (
                          <li key={j}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.validation.suggestedFix && (
                    <p className="mt-2 text-sm text-blue-600">
                      💡 {result.validation.suggestedFix}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}