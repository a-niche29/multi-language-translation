# Saved Prompts Directory

This directory contains synchronized prompt configurations from your browser's localStorage.

## How it works

1. When you save prompt configurations in the web app, they're stored in your browser's localStorage
2. Click the "Sync to Files" button in the "Load Saved Templates" dropdown to sync them here
3. Each prompt configuration is saved as an individual JSON file
4. An `index.json` file tracks all synced prompts

## File naming

Files are named using the pattern: `{sanitized-name}-{timestamp}.json`
- Sanitized name: lowercase, spaces replaced with hyphens
- Timestamp: Unix timestamp when the prompt was created

## Example structure

```json
{
  "id": "unique-id",
  "name": "Spanish Translation",
  "description": "Production Spanish translation with tone guidelines",
  "language": "Spanish",
  "group": {
    "name": "Spanish",
    "columnName": "spanish",
    "provider": "openai",
    "model": "gpt-4",
    "systemPrompt": "You are an expert app localiser...",
    "userPrompt": "For each entry in the CSV snippet below..."
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Benefits

- **Backup**: Your prompts are backed up to files
- **Version Control**: Track changes to prompts in git
- **Sharing**: Share specific prompt configurations with team members
- **Claude Access**: Claude can now read and help you with your saved prompts

## Note

This directory is gitignored by default to keep user-specific prompts private.