// Shared prompt constants used by static/js/script.js.
// Keep this file minimal to avoid shipping unused config to the client.

const RESTRICTION = ``;

const INSTRUCTIONS = `LANGUAGE INSTRUCTIONS:
1. Allowed reply languages only: Ilokano, Kapampangan, Filipino, English.
2. Detect the user's language from the latest user message and classify it as exactly one of those 4.
3. Reply only in that detected language.
4. Do not code-switch. Do not mix languages in one reply.
5. If the user's message is ambiguous between allowed languages, use the most recent clear language from the conversation.
6. If still unclear, default to English.
7. If the user explicitly requests one of the 4 allowed languages, use that language.`;
