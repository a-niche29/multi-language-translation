interface ValidationResult {
  isValid: boolean;
  issues: string[];
  confidence: number;
  suggestedFix?: string;
}

export class ResponseValidator {
  /**
   * Validate if a response looks like a proper translation
   */
  validateTranslationResponse(
    response: string,
    originalText: string,
    targetLanguage: string
  ): ValidationResult {
    const issues: string[] = [];
    let confidence = 100;

    // Check 1: Response shouldn't be too short
    if (response.length < 3) {
      issues.push('Response is suspiciously short (less than 3 characters)');
      confidence -= 40;
    }

    // Check 2: Response shouldn't be identical to input
    if (response.toLowerCase() === originalText.toLowerCase()) {
      issues.push('Response is identical to original text');
      confidence -= 50;
    }

    // Check 3: Check for common AI failure patterns
    const failurePatterns = [
      /^(i'm|i am) (ready|happy|prepared) to translate/i,
      /^please provide/i,
      /^translate:/i,
      /^error:/i,
      /^sorry/i,
      /^i cannot/i,
      /^s concise$/i,  // The specific issue we found
      /^[a-z]+ (concise|formal|informal)$/i,  // Style descriptors
    ];
    
    // Check 3.5: Check for explanatory text patterns (specific to Marathi/Kannada issue)
    const explanatoryPatterns = [
      /\b(i'll|i will|let me|i would|i can) (output|return|provide|give you|format|translate)/i,
      /\bformat you specified\b/i,
      /\band i'll\b/i,
      /\bhere is the translation\b/i,
      /\bhere are the four fields\b/i,
      /\bfour csv fields\b/i,
      /\boutput four csv fields\b/i,
    ];
    
    for (const pattern of explanatoryPatterns) {
      if (pattern.test(response)) {
        issues.push(`Response contains explanatory text instead of translation: ${pattern}`);
        confidence -= 80; // Heavy penalty as this is clearly not a translation
        break;
      }
    }

    for (const pattern of failurePatterns) {
      if (pattern.test(response)) {
        issues.push(`Response matches failure pattern: ${pattern}`);
        confidence -= 60;
        break;
      }
    }

    // Check 4: Language-specific validation
    const languageChecks = this.checkLanguageSpecific(response, targetLanguage);
    if (!languageChecks.valid) {
      issues.push(...languageChecks.issues);
      confidence -= languageChecks.penalty;
    }

    // Check 5: CSV format issues
    if (response.includes('\n') && !response.includes(',')) {
      issues.push('Response has newlines but no commas - might be malformed');
      confidence -= 20;
    }

    // Check 6: Looks like a style descriptor instead of translation
    // Only check if it's JUST a style descriptor (not part of a longer translation)
    const styleDescriptors = ['concise', 'formal', 'casual', 'polite', 'friendly'];
    const words = response.toLowerCase().split(' ');
    // Check if response is ONLY a style descriptor (exactly matches)
    if (words.length === 1 && styleDescriptors.includes(words[0])) {
      issues.push('Response appears to be only a style descriptor, not a translation');
      confidence -= 70;
    }
    // Check for pattern like "translation concise" or "formal translation"
    else if (words.length === 2 && 
             words.every(word => styleDescriptors.includes(word) || word === 'translation')) {
      issues.push('Response appears to be a style descriptor phrase, not a translation');
      confidence -= 70;
    }

    return {
      isValid: confidence >= 50,
      issues,
      confidence: Math.max(0, confidence),
      suggestedFix: this.suggestFix(issues)
    };
  }

  private checkLanguageSpecific(text: string, language: string): { valid: boolean; issues: string[]; penalty: number } {
    const issues: string[] = [];
    let penalty = 0;

    switch (language.toLowerCase()) {
      case 'spanish':
      case 'español':
        // Check for Spanish-specific characters or patterns
        if (!/[áéíóúñ¿¡]/i.test(text) && text.length > 20) {
          issues.push('Long text without Spanish-specific characters');
          penalty = 10;
        }
        // Check for common Spanish words
        const spanishWords = /\b(el|la|de|que|y|a|en|un|ser|se|no|haber|por|con|su|para|como|estar|tener|le|lo|todo|pero|más|hacer|o|poder|decir|este|ir|ver|dar|saber|querer|llegar|pasar|deber|poner|parecer|quedar|creer|hablar|llevar|dejar|seguir|encontrar|llamar|venir|pensar|salir|volver|tomar|conocer|vivir)\b/i;
        if (!spanishWords.test(text) && text.split(' ').length > 3) {
          issues.push('No common Spanish words detected');
          penalty += 20;
        }
        break;

      case 'hindi':
      case 'हिंदी':
        // Check for Devanagari script
        if (!/[\u0900-\u097F]/.test(text)) {
          issues.push('No Devanagari script detected for Hindi translation');
          penalty = 50;
        }
        break;

      case 'french':
      case 'français':
        // Check for French-specific characters
        if (!/[àâäçèéêëîïôùûü]/i.test(text) && text.length > 20) {
          issues.push('Long text without French-specific characters');
          penalty = 10;
        }
        break;

      case 'german':
      case 'deutsch':
        // Check for German-specific characters
        if (!/[äöüß]/i.test(text) && text.length > 20) {
          issues.push('Long text without German-specific characters');
          penalty = 10;
        }
        break;
        
      case 'marathi':
      case 'मराठी':
        // Check for Devanagari script (Marathi uses same script as Hindi)
        if (!/[\u0900-\u097F]/.test(text)) {
          issues.push('No Devanagari script detected for Marathi translation');
          penalty = 50;
        }
        // Marathi allows mixed script, so English words are OK
        break;
        
      case 'kannada':
      case 'ಕನ್ನಡ':
        // Check for Kannada script
        if (!/[\u0C80-\u0CFF]/.test(text)) {
          issues.push('No Kannada script detected for Kannada translation');
          penalty = 50;
        }
        // Kannada allows mixed script, so English words are OK
        break;
    }

    return { valid: penalty < 30, issues, penalty };
  }

  private suggestFix(issues: string[]): string | undefined {
    if (issues.some(i => i.includes('style descriptor'))) {
      return 'The AI returned a style descriptor instead of a translation. Try clarifying the prompt to explicitly request the translated text.';
    }
    if (issues.some(i => i.includes('failure pattern'))) {
      return 'The AI response suggests it didn\'t understand the request. Consider simplifying the prompt or providing examples.';
    }
    if (issues.some(i => i.includes('identical to original'))) {
      return 'The translation is identical to the original. The AI might not have processed the request correctly.';
    }
    return undefined;
  }

  /**
   * Test a prompt to see what kind of responses it generates
   */
  async testPrompt(
    systemPrompt: string,
    userPromptTemplate: string,
    testCases: { text: string; expectedLanguage: string }[]
  ): Promise<{ prompt: string; results: ValidationResult[] }> {
    const results: ValidationResult[] = [];
    
    // This would actually call the AI in production
    // For now, we'll return validation results based on the prompt structure
    
    // Check if prompt is clear about output format
    const promptIssues: string[] = [];
    
    if (!userPromptTemplate.includes('{{text}}')) {
      promptIssues.push('User prompt template missing {{text}} placeholder');
    }
    
    if (!systemPrompt.toLowerCase().includes('csv') && !systemPrompt.toLowerCase().includes('format')) {
      promptIssues.push('System prompt doesn\'t specify output format clearly');
    }
    
    if (!systemPrompt.includes('translation') && !userPromptTemplate.includes('translate')) {
      promptIssues.push('Neither prompt clearly indicates this is a translation task');
    }

    // Simulate validation results
    testCases.forEach(() => {
      results.push({
        isValid: promptIssues.length === 0,
        issues: promptIssues,
        confidence: 100 - (promptIssues.length * 20),
        suggestedFix: promptIssues.length > 0 ? 'Clarify the prompt with explicit format instructions' : undefined
      });
    });

    return {
      prompt: `System: ${systemPrompt}\nUser: ${userPromptTemplate}`,
      results
    };
  }
}

export const responseValidator = new ResponseValidator();