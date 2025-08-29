// Test script to reproduce Marathi/Kannada translation issues
import fs from 'fs';
import { AnthropicProvider } from './lib/providers/anthropic.js';

// Read the prompts
const marathiPrompt = JSON.parse(fs.readFileSync('./saved-prompts/marathi-1751878251146.json', 'utf8'));
const kannadaPrompt = JSON.parse(fs.readFileSync('./saved-prompts/kannada-1751878283423.json', 'utf8'));

// Test entries
const testEntries = [
  { key: 'test.simple', source: 'common', english: 'Hello' },
  { key: 'test.placeholder', source: 'common', english: 'Welcome {name}!' },
  { key: 'test.long', source: 'common', english: 'This is a longer text to test how the translation handles more complex sentences.' }
];

async function testLanguage(languageName, prompt) {
  console.log(`\n=== Testing ${languageName} ===`);
  
  const provider = new AnthropicProvider(
    process.env.ANTHROPIC_API_KEY,
    prompt.group.model
  );
  
  for (const entry of testEntries) {
    console.log(`\nTesting: ${entry.key} - "${entry.english}"`);
    
    try {
      const result = await provider.translate({
        text: entry.english,
        key: entry.key,
        source: entry.source,
        language: languageName,
        systemPrompt: prompt.group.systemPrompt,
        userPrompt: prompt.group.userPrompt
      });
      
      console.log('Result:', result);
      
      // Check if the response contains buffer text
      if (result.translation.includes("I'll output") || 
          result.translation.includes("I'll return") ||
          result.translation.includes("format you specified")) {
        console.error('❌ ERROR: Response contains buffer text instead of translation!');
      } else if (result.translation === entry.english) {
        console.error('❌ ERROR: Translation is same as English text!');
      } else {
        console.log('✅ Translation appears valid');
      }
    } catch (error) {
      console.error('❌ Translation failed:', error.message);
    }
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Please set ANTHROPIC_API_KEY environment variable');
    process.exit(1);
  }
  
  await testLanguage('Marathi', marathiPrompt);
  await testLanguage('Kannada', kannadaPrompt);
}

main().catch(console.error);