// Public messages shared by the stream route and chat. Never forward raw provider errors.
export const ASSISTANT_ERRORS = {
  connection: "The assistant could not connect. Please try again.",
  quota: "The assistant has reached its AI service quota. Please try later or ask the app administrator to check Gemini usage and billing.",
  busy: "The AI service is busy. Please try again shortly.",
  timeout: "The assistant took too long to answer. Please try again.",
  empty: "The assistant returned no answer. Please try again.",
  configuration: "The assistant's AI service needs attention. Please ask the app administrator to check its configuration.",
} as const

const publicMessages = new Set<string>(Object.values(ASSISTANT_ERRORS))

export function isAssistantErrorMessage(message: string): boolean {
  return publicMessages.has(message)
}
