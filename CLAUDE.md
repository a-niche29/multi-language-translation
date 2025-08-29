# Claude Assistant Instructions

## Testing Process (CRITICAL)

When asked to test or verify fixes:
1. **ALWAYS** read TESTING_WORKFLOW.md first
2. Follow the documented test cases for the specific error being addressed
3. Run tests according to the checklist in the workflow
4. Update TESTING_WORKFLOW.md with any new test cases discovered during testing
5. Document test results against the workflow checklist

## Error Handling Process

When encountering ANY error:
1. **IMMEDIATELY** document it in TESTING_WORKFLOW.md under "Error-Specific Test Cases"
2. Add the problem category, symptoms, and test cases needed
3. Only then proceed to fix the issue
4. After fixing, run tests from TESTING_WORKFLOW.md

## Project-Specific Context

This is a multi-language translation tool that processes CSV files through AI providers (OpenAI, Anthropic).
Key workflows:
- CSV upload → Translation group configuration → Batch translation → Export results
- All prompts expect CSV format, not individual text
- Retry functionality for failed translations

## Common Issues to Watch For
- Turbopack module resolution errors
- Data structure access errors (especially during retry)
- CSV format vs text replacement mismatches
- Low translation success rates