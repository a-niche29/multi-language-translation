'use client';

import { useState } from 'react';
import { Settings, Info, Cpu, Timer, Package } from 'lucide-react';

export interface ProviderBatchConfig {
  concurrentBatches: number;
  batchSize: number;
  delayMs: number;
}

export interface BatchConfig {
  openai: ProviderBatchConfig;
  anthropic: ProviderBatchConfig;
  google: ProviderBatchConfig;
}

interface BatchSettingsProps {
  config: BatchConfig;
  onChange: (config: BatchConfig) => void;
}

export default function BatchSettings({ config, onChange }: BatchSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'openai' | 'anthropic' | 'google'>('openai');

  const updateProviderConfig = (provider: 'openai' | 'anthropic' | 'google', updates: Partial<ProviderBatchConfig>) => {
    onChange({
      ...config,
      [provider]: { ...config[provider], ...updates }
    });
  };

  const providerConfig = config[activeTab];
  const providerName = activeTab === 'openai' ? 'OpenAI' : activeTab === 'anthropic' ? 'Anthropic' : 'Google';

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-lg font-semibold text-black hover:text-blue-600 transition-colors"
      >
        <Settings className="w-5 h-5" />
        Advanced Settings
        <span className="text-sm font-normal text-black ml-2">
          (Provider-specific batch processing)
        </span>
      </button>

      {isOpen && (
        <div className="mt-6">
          {/* Provider Tabs */}
          <div className="border-b border-black mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('openai')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'openai'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-black hover:text-blue-600 hover:border-blue-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  OpenAI Settings
                </span>
              </button>
              <button
                onClick={() => setActiveTab('anthropic')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'anthropic'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-black hover:text-blue-600 hover:border-blue-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  Anthropic Settings
                </span>
              </button>
              <button
                onClick={() => setActiveTab('google')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'google'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-black hover:text-blue-600 hover:border-blue-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  Google Settings
                </span>
              </button>
            </nav>
          </div>

          {/* Provider-specific settings */}
          <div className="space-y-6">
            {/* Concurrent Batches */}
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                <Cpu className="w-4 h-4 inline mr-1" />
                Concurrent Batches
                <span className="ml-2 text-xs font-normal text-black">
                  (How many batches to send simultaneously)
                </span>
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={providerConfig.concurrentBatches}
                  onChange={(e) => updateProviderConfig(activeTab, { concurrentBatches: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className="w-12 text-center font-medium text-black">
                  {providerConfig.concurrentBatches}
                </span>
              </div>
              <div className="mt-2 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-black">
                  {activeTab === 'openai' 
                    ? 'OpenAI rate limits vary by model. GPT-4 is more restrictive than GPT-3.5. Start with 3-5 for safety.'
                    : activeTab === 'anthropic'
                    ? 'Anthropic generally allows higher concurrency. 5-10 concurrent batches work well.'
                    : 'Google Gemini models support good concurrency. 3-5 concurrent batches recommended.'
                  }
                </p>
              </div>
            </div>

            {/* Batch Size */}
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                <Package className="w-4 h-4 inline mr-1" />
                Batch Size
                <span className="ml-2 text-xs font-normal text-black">
                  (Entries per batch)
                </span>
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={providerConfig.batchSize}
                  onChange={(e) => updateProviderConfig(activeTab, { batchSize: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className="w-12 text-center font-medium text-black">
                  {providerConfig.batchSize}
                </span>
              </div>
              <div className="mt-2 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-black">
                  Number of translation entries to include in each API request. 
                  Larger batches are more efficient but may timeout.
                </p>
              </div>
            </div>

            {/* Delay Between Batches */}
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                <Timer className="w-4 h-4 inline mr-1" />
                Delay Between Batches
                <span className="ml-2 text-xs font-normal text-black">
                  (Milliseconds)
                </span>
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="5000"
                  step="100"
                  value={providerConfig.delayMs}
                  onChange={(e) => updateProviderConfig(activeTab, { delayMs: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className="w-16 text-center font-medium text-black">
                  {providerConfig.delayMs}ms
                </span>
              </div>
              <div className="mt-2 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-black">
                  Time to wait between sending batch requests. Increase if you encounter rate limit errors.
                  Set to 0 for maximum speed.
                </p>
              </div>
            </div>

            {/* Performance Estimate */}
            <div className={`${activeTab === 'openai' ? 'bg-green-50' : activeTab === 'anthropic' ? 'bg-purple-50' : 'bg-blue-50'} rounded-lg p-4`}>
              <h4 className="text-sm font-medium text-black mb-2">
                {providerName} Performance Estimate
              </h4>
              <div className="space-y-1 text-sm text-black">
                <p>
                  • Max concurrent API calls: {' '}
                  <span className="font-medium">
                    {providerConfig.concurrentBatches * providerConfig.batchSize} entries
                  </span>
                </p>
                <p>
                  • Throughput: {' '}
                  <span className="font-medium">
                    ~{Math.round(1000 / (providerConfig.delayMs || 100) * providerConfig.batchSize * providerConfig.concurrentBatches)} entries/second
                  </span>
                </p>
                <p>
                  • Time per 1000 entries: {' '}
                  <span className="font-medium">
                    ~{Math.round(1000 / (providerConfig.batchSize * providerConfig.concurrentBatches) * (providerConfig.delayMs || 100) / 1000)}s
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Overall Strategy Info */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-black mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Processing Strategy
            </h4>
            <p className="text-xs text-black mb-2">
              Configurations are processed by provider to optimize API usage:
            </p>
            <ol className="text-xs text-black space-y-1 list-decimal list-inside">
              <li>All OpenAI translations run concurrently (respecting OpenAI limits)</li>
              <li>All Anthropic translations run concurrently (respecting Anthropic limits)</li>
              <li>All Google translations run concurrently (respecting Google limits)</li>
              <li>Each language group processes its batches with the configured concurrency</li>
              <li>Different providers run in parallel for maximum efficiency</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}