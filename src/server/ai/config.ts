// The AI chat's settings (F7, §10). No `server-only`, so unit tests and the live check can import it;
// the key is only ever read from the server's environment.
import Anthropic from "@anthropic-ai/sdk";

export interface ChatConfig {
  apiKey: string;
  model: string;
  /** Messages one person may send per day, across all groups. */
  dailyLimit: number;
  /** https://api.anthropic.com; the e2e tests point it at their stand-in (e2e/model-stub.mts). */
  apiUrl: string;
}

/**
 * From CHAT_API_KEY, CHAT_MODEL, CHAT_DAILY_LIMIT and CHAT_API_URL, or undefined when the chat isn't
 * set up. Deliberately not ANTHROPIC_API_KEY: a Claude Code session that loads .env.local would pick
 * that name up for itself (decided in step 9).
 */
export function chatConfig(env: Record<string, string | undefined> = process.env): ChatConfig | undefined {
  const apiKey = env.CHAT_API_KEY?.trim();
  if (!apiKey) return undefined;
  const limit = Number(env.CHAT_DAILY_LIMIT);
  return {
    apiKey,
    model: env.CHAT_MODEL?.trim() || "claude-haiku-5-5",
    dailyLimit: Number.isInteger(limit) && limit > 0 ? limit : 50,
    apiUrl: env.CHAT_API_URL?.trim() || "https://api.anthropic.com",
  };
}

/**
 * A client that uses only these settings. The SDK otherwise reads ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY
 * and ANTHROPIC_AUTH_TOKEN from the environment, which a process started from Claude Code inherits
 * (they point at Claude Code's own gateway). ANTHROPIC_CUSTOM_HEADERS can't be switched off here, so
 * the e2e config and the live check clear it.
 */
export function chatClient(config: ChatConfig): Anthropic {
  return new Anthropic({ apiKey: config.apiKey, authToken: null, baseURL: config.apiUrl, timeout: 60_000, maxRetries: 2 });
}
