import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GoogleProvider } from './google';
import { TranslationProvider } from './base';
import { Provider } from '../types/translation-group';

export function createProvider(
  provider: Provider, 
  apiKey: string, 
  model: string
): TranslationProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(apiKey, model);
    case 'anthropic':
      return new AnthropicProvider(apiKey, model);
    case 'google':
      return new GoogleProvider(apiKey, model);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export { OPENAI_MODELS } from './openai';
export { ANTHROPIC_MODELS } from './anthropic';
export { GOOGLE_MODELS } from './google';
export type { TranslateResponse } from './base';