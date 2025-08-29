# Translation Prompts Reference

## Spanish Translation Configuration

### System Prompt (Constant)
```
You are an expert app localiser with 10 + years of UI/UX and marketing-copy experience across multiple languages.
```

### User Prompt (Spanish)
```
For each entry in the CSV snippet below, produce a Mexican-Spanish translation plus metadata fields including category classification.

RULE 1 Placeholders – preserve EXACTLY
• Curly-brace placeholders {alphaNumeric} → regex {[A-Za-z0-9_]+}
• ICU plurals        {n} inside keys …one / …other
• Hash pattern       #{number} → treat "#" as literal text
• Punctuation after token {percentile}% , {hour}:{minute}
• Dart interpolation   $variable → regex $[A-Za-z][A-Za-z0-9]*
• Highlighter tags    {highlighter}…{/highlighter} (if ever present)
Do not change the spelling of any token. Order may change to suit Spanish syntax, but every token must appear once.

RULE 2 Tone & style
• Follow the tone grid at the end of this prompt.
• Sentence case for buttons and headers.
• One ¡…! allowed in Gamification, Marketing, Social buckets; no emojis.
• Use tú in all buckets except System / Legal, which uses Usted or impersonal voice.
• Apply gender-neutral phrasing when natural.

RULE 3 Length
Keep translations concise; if noticeably longer than English, explain why in "reasoning".

RULE 4 Terminology (glossary)
KEEP / TRANSLATE exactly as flagged.
• KEEP Stimuler, IELTS, CEFR, Sarah, Premium, PRO, Roadmap, Streak, Paywall, Onboarding (internal labels)
• TRANSLATE Trial → "prueba gratis"; Subscription → "suscripción"; Upgrade → "actualizar"; Mentor → "mentor / mentoría"; Callback / Call → "llamada"
• AI mixed rule Keep "AI" inside fixed branded phrases ("AI Call", "AI Tutor"); elsewhere translate to "IA".
Onboarding: translate to "Introducción" when it appears on an end-user screen.

RULE 5 Category Classification
Choose ONE category from this list (use exact spelling):
• Onboarding - welcome messages, initial setup, first-run experience, introductions
• Gamification - achievements, rewards, streaks, progress celebrations, badges
• Progress - performance updates, statistics, learning metrics, feedback
• Conversation - AI tutor dialogue, chat interactions, speaking practice
• Practice - exercise instructions, lesson content, practice activities
• Test-Prep - exam preparation, IELTS content, test-specific material
• Pricing - subscription offers, payment, upgrades, paywall messages
• Notification - alerts, reminders, push notifications, time-sensitive messages
• Error - error messages, warnings, validation feedback, failure states
• Social - sharing features, social accomplishments, community features
• Profile - user profile, library, settings, personal preferences
• System - technical messages, legal text, terms, system status

RULE 6 Translation Reasoning (be thorough but concise)
Provide comprehensive explanation covering:
• Word choice rationale (why specific terms were selected)
• Grammar/tense decisions (why past/present/future, formal/informal)
• Cultural adaptations (what was adjusted for Mexican context)
• Tone adjustments (how you matched the category's tone requirements)
• Placeholder handling (if any were reordered or required special attention)
• For modifications: Start with "Modified:" then explain (1) what changed and (2) why the original was inadequate
• If choosing between multiple possible categories, briefly justify your choice

OUTPUT
Return CSV rows in this exact order, with no header:
Key, Spanish Translation, Category, Translation Reasoning

IMPORTANT CSV FORMATTING:
- ALWAYS include the Key from the input as the first field (copy exactly)
- Use double quotes (") to wrap any field containing commas, quotes, or newlines
- Escape inner double quotes by doubling them ("")
- Every row MUST have exactly 4 fields separated by commas
- Do NOT wrap the entire response in markdown code blocks
- Return ONLY the CSV rows, no additional text
- Example: purpose.ielts,"¡Hola! Soy Sarah. Estoy aquí para ayudarte.",Conversation,"Changed 'Hey!' to '¡Hola!' for culturally appropriate greeting with Spanish punctuation. Used tú form ('ayudarte') for friendly AI companion tone. Present tense maintains immediacy and availability."
- Example: error.network,"Error de conexión de red",Error,"Added 'de red' for clarity in technical context. Calm, factual tone without alarming language. No exclamation to maintain solution-oriented approach per Error category guidelines."
- IMPORTANT: Category must be one word from the list, no quotes
- CRITICAL: Each row MUST start with the exact key from the input entries
- CRITICAL: Return EXACTLY one output row for each input entry - never combine entries
- CRITICAL: If an input entry has multiline English text, still return only ONE output row for that key

TONE GRID - How to write for each category:
• Onboarding: warm, welcoming, tú form; courteous inserts; sentence case
• Gamification: celebratory, one ¡…! allowed; tú form; moderate hype; no emojis
• Progress: encouraging, data-driven, motivational yet precise; tú form
• Conversation: natural spoken Spanish, concise; tú form; avoid technical jargon
• Practice: clear instructional imperatives; tú form; neutral enthusiasm
• Test-Prep: formal instructional; exam terminology; tú form; precise language
• Pricing: benefit-oriented persuasion; transparent; one exclamation max; tú form
• Notification: direct voice (tú); courteous; mild urgency when appropriate
• Error: calm, solution-oriented; sentence case; tú or impersonal if needed
• Social: upbeat, first-person when sharing; friendly tú form
• Profile: functional labels; terse; tú form for actions
• System: formal, Usted or impersonal; unambiguous; LatAm-generic legal wording
```

## Hindi Translation Configuration

### System Prompt (Constant)
```
You are an expert app localiser with 10 + years of UI/UX and marketing-copy experience across multiple languages.
```

### User Prompt (Hindi)
```
For each entry in the CSV snippet below, return exactly four CSV fields: the key, a Hindi + English mixed translation plus two metadata fields of category classification and translation reasoning. The order will look like: 
Key, hi_Deva, Category, Reasoning

If the 'Target Translation' cell in the input is non-empty, still output a fresh Hinglish translation and begin Reasoning with "Modified:".

The hi_Deva field will be a "mixed script":  
• Hindi words in Devanagari  
• English words in Latin script  
• Terms in the KEEP list (below) always stay English (Latin), other English words may remain English when more natural.


RULE 1 Placeholders – preserve EXACTLY

• Curly-brace placeholders {alphaNumeric}               → regex \{[A-Za-z0-9_]+\}
• ICU plurals            {n} inside keys …one / …other
• Hash pattern           #{number}                      → treat "#" as literal text
• Punctuation after token {percentile}% , {hour}:{minute} → keep punctuation intact
• Dart interpolation     $variable                      → regex \$[A-Za-z_][A-Za-z0-9_]*
• Highlighter tags       {highlighter}…{/highlighter} (if ever present)

Rules that supersede all others  
1. Never transliterate, reorder, or wrap placeholders with Hindi diacritics. 
2. Do not change the spelling of any placeholder token.  
3. Every placeholder must appear exactly once in the output; word order outside placeholders may change to suit Hindi syntax.


RULE 2 Tone & Style

• Use **आप** for user-facing text; use an impersonal / passive construction ("कृपया…") in System & Error.
• Sentence case for buttons, headers, and short labels.
• Max one "!" where allowed (see grid); none in Error or System.
• No emojis.
• Prefer everyday English UI / ed-tech words; avoid rare Sanskritisms.
• Terms in the KEEP list must remain English, Latin script.
• Do not insert ISO diacritics in Latin words (write "karo", not "karō").
• Aim for gender-neutral phrasing **using colloquial Hinglish** (e.g., "sab log", "sab users"); avoid formal words like "उपयोगकर्ता".
• When the string is spoken **in first-person by the product's tutor persona ("Sarah", "AI Tutor", "Personal English Speaking Partner", etc.) use the feminine possessive and agreement: "मैं आपकी … हूँ".  Never use "आपका".
• When mixing scripts, ensure Hindi words appear in Devanagari, English words in Latin.


RULE 3 Length  (mixed Devanagari + Latin)

• Expansion flags  
  – If the English source is 7–25 characters and len(hi_Deva) ÷ len(English) > 1.6 → explain in Reasoning.  
  – If the English source is > 25 characters and the same ratio > 1.25 → explain.

• Tight-UI caution (buttons, chips, tabs)  
  – For keys or comments that indicate a compact component—e.g. names containing
    "cta", "btn", "button", "chip", "tab", or "nav"—keep the Hinglish output as short as
    *or shorter than* the English text whenever a natural synonym exists.  
  – If you *must* exceed the English length to stay natural in Hindi, state the final
    ratio in Reasoning and note the potential overflow: "Warning: compact-UI risk; ratio 1.45".

• No numeric cap for English strings ≤ 6 characters.

RULE 4 Glossary (KEEP list)

KEEP Stimuler, IELTS, CEFR, PRO, Premium, Paywall, Login, Logout, Profile, Settings,
     Streak, Dashboard, Lesson, Quiz, Test, Flashcard, Speaking, Listening, Reading,
     Writing, Grammar, Vocabulary, Practice, Review, Score, Progress, Badge, Level,
     Goal, Hint, AI Tutor, AI Call, Upgrade, Subscription, Trial, Download, Upload 

RULE 5 Category Classification
Choose ONE category from this list (use exact spelling):
• Onboarding - welcome messages, initial setup, first-run experience, introductions
• Gamification - achievements, rewards, streaks, progress celebrations, badges
• Progress - performance updates, statistics, learning metrics, feedback
• Conversation - AI tutor dialogue, chat interactions, speaking practice
• Practice - exercise instructions, lesson content, practice activities
• Test-Prep - exam preparation, IELTS content, test-specific material
• Pricing - subscription offers, payment, upgrades, paywall messages
• Notification - alerts, reminders, push notifications, time-sensitive messages
• Error - error messages, warnings, validation feedback, failure states
• Social - sharing features, social accomplishments, community features
• Profile - user profile, library, settings, personal preferences
• System - technical messages, legal text, terms, system status

RULE 6 Translation Reasoning (be thorough but concise)
Provide comprehensive explanation covering:
• Placeholder handling (if any were reordered or required special attention)
• Word choice rationale (why specific terms were selected)
• Grammar/tense decisions (why past/present/future, formal/informal)
• Cultural adaptations (what was adjusted for Indian context)
• Tone adjustments (how you matched the category's tone requirements)
• For modifications: Start with "Modified:" then explain (1) what changed and (2) why the original was inadequate
• If the entire hi_Deva or Reasoning field contains even one comma , , plus sign +, double quote " , or newline \n, wrap the whole field in double quotes, then double every internal "
Example:
key_with_quotes,"""Error"" message है, कृपया retry करें",Error,"Added quotes; wrapped & escaped per rules. Kept retry in english because of mainstream understanding"

OUTPUT

Return **CSV rows only**, no header, no markdown. 
Key, hi_Deva, Category, Reasoning

IMPORTANT CSV FORMATTING:

- ALWAYS copy the Key from the input exactly as the first field.
- If ANY character inside hi_Deva or Reasoning is a comma, double quote, or newline, wrap the ENTIRE field in double quotes "…".
- After wrapping, double every interior double quote:  →  "".
- Every row MUST have exactly 4 fields separated by commas
- Do NOT wrap the entire response in markdown code blocks
- Return ONLY the CSV rows, no additional text
- Example: purpose.ielts,"Hello! मैं Sarah हूँ. मैं आपकी मदद के लिए यहाँ हूँ.",Conversation,"Replaced Hindi greeting 'नमस्ते!' with English 'Hello!' to keep friendly Latin opening. Maintained first-person feminine per tutor persona rule; present tense adds immediacy."
- Example: error.network,"Network connection error",Error,"Kept concise English phrase to match tech jargon familiarity. Calm, solution-oriented tone. No exclamation per Error guidelines."
- IMPORTANT: Category must be one word from the list, no quotes
- CRITICAL: Each row MUST start with the exact key from the input entries
- CRITICAL: Return EXACTLY one output row for each input entry - never combine entries
- CRITICAL: If an input entry has multiline English text, still return only ONE output row for that key


EXAMPLE 1 - English Copy 
Complete your profile

EXAMPLE 1 - Translation
अपना Profile पूरा करें

EXAMPLE 2 - English Copy
Chat with Sarah Anytime, Anywhere you want to...

EXAMPLE 2 - Translation
Sarah से कभी भी, कहीं भी chat करें…

EXAMPLE 3 - English Copy
LIMITED TIME OFFER

EXAMPLE 3 - Translation
LIMITED TIME OFFER

EXAMPLE 4 - English Copy
The app is brilliant! You can't find anything better than that. you speak and then it estimate your speech as IELTS band, your grammar, fluency, intonation and more

EXAMPLE 4 - Translation
यह app शानदार है! इससे बेहतर आपको कुछ नहीं मिलेगा. आप बोलते हैं और यह आपकी speech को IELTS band, आपके grammar, fluency, intonation आदि के हिसाब से मापता है

EXAMPLE 5 - English Copy
Save 

EXAMPLE 5 - Translation
Save

TONE GRID

• Onboarding & First-run: Warm, welcoming Hinglish; use "आप"; keep sentences short; max one "!".
• Gamification: Celebratory Hinglish; use "आप"; at most one "!"; no emojis.
• Progress / Feedback: Encouraging, data-driven, precise; use "आप"; one "!" only for milestone highlights.
• Conversation / AI Call: Natural spoken Hinglish, concise; use "आप"; avoid over-formality; max one "!".
• Practice: Clear imperatives; neutral enthusiasm; use "आप"; normally no "!".
• Test-Prep / IELTS: Formal instructional Hinglish with exam vocabulary; use "आप"; no exclamations.
• Pricing & Paywall: Persuasive yet transparent Hinglish; use "आप"; max one "!"; no hype words.
• Notifications & Reminders: Direct, courteous, moderate urgency; use "आप"; max one "!".
• Error & Warning: Calm, solution-oriented; impersonal/passive Hindi ("कृपया…"); no exclamations.
• Social Sharing: Friendly, upbeat Hinglish; first-person tone where relevant; use "आप"; max one "!"; no emojis.
• Profile / Library: Functional labels, concise Hinglish; use "आप"; no exclamations.
• System / Legal: Formal register; impersonal/passive Hindi; avoid Hinglish beyond KEEP terms; no exclamations.
```