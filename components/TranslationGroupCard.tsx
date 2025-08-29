'use client';

import { TranslationGroup } from 'mlt/lib/types/translation-group';
import { OPENAI_MODELS, ANTHROPIC_MODELS } from 'mlt/lib/providers';
import { X } from 'lucide-react';

interface TranslationGroupCardProps {
  group: TranslationGroup;
  onRemove?: () => void;
}

export default function TranslationGroupCard({ 
  group,
  onRemove
}: TranslationGroupCardProps) {
  const models = group.provider === 'openai' ? OPENAI_MODELS : ANTHROPIC_MODELS;
  const model = models.find(m => m.id === group.model);

  return (
    <div className="border border-black rounded-lg p-4 bg-white">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-black">{group.name}</h3>
            <p className="text-sm text-black">Column: {group.columnName}</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="text-right">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                group.provider === 'openai' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
              }`}>
                {group.provider === 'openai' ? 'OpenAI' : 'Anthropic'}
              </span>
              <p className="text-xs text-black mt-1">{model?.name || group.model}</p>
            </div>
            {onRemove && (
              <button
                onClick={onRemove}
                className="p-1 text-black hover:text-red-600 transition-colors"
                title="Remove configuration"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Status indicator and progress bar */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-block w-2 h-2 rounded-full ${
              group.status === 'completed' ? 'bg-green-500' :
              group.status === 'processing' ? 'bg-blue-500 animate-pulse' :
              group.status === 'failed' ? 'bg-red-500' :
              'bg-blue-300'
            }`} />
            <span className="text-sm text-black">
              {group.status === 'processing' ? `Processing - ${group.progress}%` : group.status}
            </span>
          </div>
          {group.status === 'processing' && (
            <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${group.progress}%` }}
              >
                <div className="h-full bg-white/30 animate-pulse" />
              </div>
            </div>
          )}
        </div>

        {group.error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded-md">
            <p className="text-xs text-red-600">{group.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}