'use client';

import { useState } from 'react';
import { Download, Upload, Loader2, Check, AlertCircle } from 'lucide-react';
import { savedGroupsStorage } from 'mlt/lib/storage/saved-groups';

export function PromptSyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<'success' | 'error' | null>(null);
  const [toastMessage, setToastMessage] = useState<{ title: string; description: string; variant?: 'default' | 'destructive' } | null>(null);

  // Simple toast function replacement
  const toast = ({ title, description, variant = 'default' }: { title: string; description: string; variant?: 'default' | 'destructive' }) => {
    setToastMessage({ title, description, variant });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setLastSyncStatus(null);

    try {
      // Get all saved groups from localStorage
      const groups = savedGroupsStorage.getAll();
      
      if (groups.length === 0) {
        toast({
          title: "No saved prompts",
          description: "You don't have any saved prompt configurations to sync.",
          variant: "default",
        });
        setIsSyncing(false);
        return;
      }

      // Send to API
      const response = await fetch('/api/sync-prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groups }),
      });

      const result = await response.json();

      if (response.ok) {
        setLastSyncStatus('success');
        toast({
          title: "Sync successful",
          description: result.message,
          variant: "default",
        });
      } else {
        throw new Error(result.error || 'Failed to sync prompts');
      }
    } catch (error) {
      setLastSyncStatus('error');
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : 'An error occurred while syncing prompts',
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
      // Reset status after 3 seconds
      setTimeout(() => setLastSyncStatus(null), 3000);
    }
  };

  const checkSyncStatus = async () => {
    try {
      const response = await fetch('/api/sync-prompts');
      const data = await response.json();
      
      if (data.lastSynced) {
        toast({
          title: "Sync status",
          description: `Last synced: ${new Date(data.lastSynced).toLocaleString()} (${data.totalGroups} groups)`,
          variant: "default",
        });
      } else {
        toast({
          title: "Not synced",
          description: "No prompts have been synced to files yet.",
          variant: "default",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to check sync status",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-blue-700 text-white border border-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSyncing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : lastSyncStatus === 'success' ? (
            <>
              <Check className="h-4 w-4 text-green-500" />
              Synced
            </>
          ) : lastSyncStatus === 'error' ? (
            <>
              <AlertCircle className="h-4 w-4 text-red-500" />
              Failed
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Sync to Files
            </>
          )}
        </button>
        
        <button
          onClick={checkSyncStatus}
          className="inline-flex items-center p-1.5 text-sm hover:bg-gray-100 rounded-md transition-colors"
          title="Check sync status"
        >
          <Upload className="h-4 w-4" />
        </button>
      </div>

      {/* Simple toast notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 max-w-sm p-4 bg-white border rounded-lg shadow-lg animate-in slide-in-from-bottom-2">
          <h3 className={`font-semibold ${toastMessage.variant === 'destructive' ? 'text-red-600' : 'text-gray-900'}`}>
            {toastMessage.title}
          </h3>
          <p className="mt-1 text-sm text-gray-600">{toastMessage.description}</p>
        </div>
      )}
    </>
  );
}