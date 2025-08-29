# Model Maintenance Guide

## Last Updated: 2025-07-24

### Purpose
This document serves as a maintenance guide to ensure all AI models are kept up-to-date in the translation application.

### Update Schedule
- **Monthly Check**: Review Anthropic, OpenAI, and Google model releases
- **Quarterly Review**: Comprehensive update of all model configurations

### Model Sources
1. **Anthropic Models**: https://docs.anthropic.com/en/docs/models-overview
2. **OpenAI Models**: https://platform.openai.com/docs/models
3. **Google/Gemini Models**: https://ai.google.dev/gemini-api/docs/models

### Update Checklist
- [ ] Check Anthropic documentation for new models
- [ ] Check OpenAI documentation for new models
- [ ] Check Google documentation for new models
- [ ] Update model lists in provider files
- [ ] Update default models if needed
- [ ] Test new model configurations
- [ ] Update this document with the new date

### File Locations
- Anthropic models: `/lib/providers/anthropic.ts`
- OpenAI models: `/lib/providers/openai.ts`
- Google models: `/lib/providers/google.ts`

### Current Model Inventory

#### Anthropic (as of 2025-06-16)
- Claude 4 Series: Opus 4, Sonnet 4
- Claude 3.5 Series: Sonnet (Oct 2024), Sonnet (June 2024), Haiku
- Claude 3 Series: Opus, Sonnet, Haiku

#### OpenAI (as of 2025-06-16)
- GPT-4o Series: Latest, Nov 2024, Aug 2024, May 2024, Mini, Mini July 2024
- GPT-4 Turbo Series: Latest, April 2024, Preview variants
- GPT-4 Series: Latest, June 2023
- GPT-3.5 Series: Latest, Jan 2024, Nov 2023, 16K

#### Google/Gemini (as of 2025-07-24)
- Gemini 2.5 Series: Pro, Flash, Flash-Lite, Flash Live
- Gemini 2.0 Series: Flash (Experimental), Flash Thinking (Experimental)
- Gemini 1.5 Series: Pro variants, Flash variants, Flash 8B variants
- Gemini 1.0 Series: Pro variants (Legacy)

### Notes
- Model IDs follow the pattern: `model-name-version-date`
- Always test new models before making them default
- Consider backward compatibility when removing old models