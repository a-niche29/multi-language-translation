# Translation Macro Support

This document explains the available macros you can use in your translation prompts.

## Supported Macros

When creating translation prompts, you can use the following placeholders that will be automatically replaced with actual values:

### CSV-Related Macros

- `{{csv}}` - **NEW**: Full CSV format with headers: `Key,Source,English Original\nonBoarding.canIknowYourName,Static,I am so excited...`
- `{{csv_row}}` - The CSV row without headers: `onBoarding.canIknowYourName,Static,I am so excited...`
- `{{key}}` - The translation key (e.g., "purpose.ielts", "error.network")
- `{{source}}` - The source text from the CSV
- `{{english}}` - The English text to be translated
- `{{text}}` - Same as `{{english}}` (kept for backward compatibility)
- `{{language}}` - The target language name from the translation group
- `{{entries_count}}` - **NEW**: Number of entries in batch (e.g., "5")

## Example Usage

### Example 1: Simple CSV Format
```
Translate the following CSV row to {{language}}:
{{csv_row}}
```

### Example 2: Structured Format
```
Please translate this entry:
Key: {{key}}
Source: {{source}}
Text: {{english}}
Target Language: {{language}}
```

### Example 3: Context-Aware Translation
```
For the key "{{key}}" in {{language}}, translate:
"{{english}}"

Keep in mind the source context: {{source}}
```

## Default Behavior

If your prompt contains "CSV snippet below", "For each entry in the CSV", or "CSV format" and doesn't use any CSV macros, the system will automatically append the full CSV (with headers) to your prompt.

## CSV Format Detection

The system automatically detects when a prompt expects CSV format based on keywords. When detected:
1. It sends proper CSV with headers (`Key,Source,English Original`)
2. It uses enhanced CSV parsing for responses
3. It expects 4-column output: `Key, Translation, Category, Reasoning`

## Best Practices

1. Use `{{csv}}` for sophisticated prompts that expect full CSV format with headers
2. Use `{{csv_row}}` for simpler prompts that just need the data row
3. Use individual macros when you need more control over the prompt structure
4. Always test your prompts with a few sample translations to ensure they work as expected
5. For sophisticated prompts (like those in PROMPTS.md), ensure your prompt mentions CSV format to trigger enhanced parsing

## Example: Sophisticated Prompt

```
For each entry in the CSV snippet below, produce a {{language}} translation plus metadata fields including category classification.

{{csv}}

Return CSV rows in this exact order, with no header:
Key, Translation, Category, Reasoning
```

## Example: Batch Translation Prompt

```
For each entry in the CSV snippet below, produce a {{language}} translation plus metadata fields.

ENTRIES ({{entries_count}} total):
<<<
{{csv}}
>>>

REMINDER: Return exactly {{entries_count}} output rows, one for each input entry above.
```