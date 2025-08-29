'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { TranslationGroup, Provider } from 'mlt/lib/types/translation-group';
import { OPENAI_MODELS, ANTHROPIC_MODELS, GOOGLE_MODELS } from 'mlt/lib/providers';
import { savedGroupsStorage, SavedTranslationGroup } from 'mlt/lib/storage/saved-groups';

interface GroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAsGroup: (group: SavedTranslationGroup) => void;
  onSaveAndUse: (group: TranslationGroup) => void;
  availableProviders?: string[];
  editingGroup?: SavedTranslationGroup | null;
}

export default function GroupModal({
  isOpen,
  onClose,
  onSaveAsGroup,
  onSaveAndUse,
  availableProviders = ['openai', 'anthropic', 'google'],
  editingGroup
}: GroupModalProps) {
  const [name, setName] = useState('');
  const [columnName, setColumnName] = useState('');
  const [provider, setProvider] = useState<Provider>('openai');
  const [model, setModel] = useState('gpt-4.1-mini');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  
  const defaultSystemPrompt = 'You are an expert app localiser with 10 + years of UI/UX and marketing-copy experience across multiple languages.';

  const defaultUserPrompt = `Translate the following English text to {{language}}:
{{text}}`;

  useEffect(() => {
    if (editingGroup) {
      setName(editingGroup.group.name);
      setColumnName(editingGroup.group.columnName);
      setProvider(editingGroup.group.provider);
      setModel(editingGroup.group.model);
      setSystemPrompt(editingGroup.group.systemPrompt || '');
      setUserPrompt(editingGroup.group.userPrompt || '');
      setSaveName(editingGroup.name);
      setSaveDescription(editingGroup.description || '');
    } else {
      // Reset form when not editing
      setName('');
      setColumnName('');
      setProvider('openai');
      setModel('gpt-4.1-mini');
      setSystemPrompt(defaultSystemPrompt);
      setUserPrompt('');
      setSaveName('');
      setSaveDescription('');
    }
  }, [editingGroup, isOpen]);

  const models = provider === 'openai' ? OPENAI_MODELS : 
                 provider === 'anthropic' ? ANTHROPIC_MODELS : 
                 GOOGLE_MODELS;

  const handleProviderChange = (newProvider: Provider) => {
    setProvider(newProvider);
    // Set default model for the provider
    if (newProvider === 'openai') {
      setModel('gpt-4.1-mini');
    } else if (newProvider === 'anthropic') {
      setModel('claude-3-5-haiku-20241022');
    } else {
      setModel('gemini-1.5-flash');
    }
  };

  const createGroupObject = (): TranslationGroup => {
    return {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      columnName,
      provider,
      model,
      systemPrompt: systemPrompt || defaultSystemPrompt,
      userPrompt: userPrompt.replace('{{language}}', name) || defaultUserPrompt.replace('{{language}}', name),
      status: 'pending',
      progress: 0
    };
  };

  const handleSaveAsGroup = () => {
    if (!name.trim() || !columnName.trim() || !saveName.trim()) return;

    const group = createGroupObject();
    let savedGroup: SavedTranslationGroup;

    if (editingGroup) {
      // Update existing group
      savedGroup = {
        ...editingGroup,
        name: saveName,
        description: saveDescription,
        group: {
          name: group.name,
          columnName: group.columnName,
          provider: group.provider,
          model: group.model,
          systemPrompt: group.systemPrompt,
          userPrompt: group.userPrompt
        },
        updatedAt: new Date().toISOString()
      };
    } else {
      // Create new saved group
      savedGroup = savedGroupsStorage.createFromGroup(saveName, saveDescription, group);
    }

    savedGroupsStorage.save(savedGroup);
    onSaveAsGroup(savedGroup);
    onClose();
  };

  const handleSaveAndUse = () => {
    if (!name.trim() || !columnName.trim() || !saveName.trim()) return;

    const group = createGroupObject();
    
    // Save to storage first
    handleSaveAsGroup();
    
    // Then add to active groups
    onSaveAndUse(group);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {editingGroup ? 'Edit Translation Configuration' : 'Create New Translation Configuration'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-600 hover:text-red-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Basic Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Basic Configuration</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Language <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-gray-800 bg-white placeholder-gray-400"
                placeholder="e.g., Spanish, French, German"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Column Header <span className="text-red-500">*</span>
                <span className="font-normal text-gray-600 ml-1">(how it will appear in the output CSV)</span>
              </label>
              <input
                type="text"
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-gray-800 bg-white placeholder-gray-400"
                placeholder="e.g., spanish_translation, fr_text"
              />
            </div>
          </div>

          {/* Provider Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Provider Configuration</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value as Provider)}
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-800 bg-white placeholder-gray-400"
                >
                  {availableProviders.includes('openai') && <option value="openai">OpenAI</option>}
                  {availableProviders.includes('anthropic') && <option value="anthropic">Anthropic</option>}
                  {availableProviders.includes('google') && <option value="google">Google</option>}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-800 bg-white placeholder-gray-400"
                >
                  {models.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Prompts */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Prompts</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                System Prompt
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md h-24 text-sm text-gray-800 bg-white placeholder-gray-400"
                placeholder={defaultSystemPrompt}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User Prompt <span className="font-normal text-gray-600">(use {'{{text}}'} as placeholder)</span>
              </label>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md h-32 text-sm text-gray-800 bg-white placeholder-gray-400"
                placeholder={defaultUserPrompt}
              />
            </div>
          </div>

          {/* Save Configuration */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">Save Configuration</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Configuration Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-gray-800 bg-white placeholder-gray-400"
                placeholder="e.g., Spanish UI Translation"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                value={saveDescription}
                onChange={(e) => setSaveDescription(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md h-20 text-sm text-gray-800 bg-white placeholder-gray-400"
                placeholder="Add notes about this configuration..."
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSaveAsGroup}
              disabled={!name.trim() || !columnName.trim() || !saveName.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save as Template
            </button>
            <button
              onClick={handleSaveAndUse}
              disabled={!name.trim() || !columnName.trim() || !saveName.trim()}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save and Use
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}