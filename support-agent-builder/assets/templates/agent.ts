import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { Db } from "./db.js";
import type { AgentMessage, AgentResult } from "./prompt.js";
import { runClaudeAgent } from "./providers/claude.js";
import { runOpenAIAgent } from "./providers/openai.js";

// ADAPT: if the user only needs one provider, delete the other provider file and its imports here.

export type { AgentMessage, AgentResult } from "./prompt.js";

export const PROVIDERS = ["openai", "anthropic"] as const;
export type Provider = (typeof PROVIDERS)[number];

/** LLM_PROVIDER wins. Otherwise use whichever API key is set. */
export function pickProvider(env: NodeJS.ProcessEnv = process.env): Provider {
  const chosen = env.LLM_PROVIDER?.trim().toLowerCase();
  if (chosen) {
    if ((PROVIDERS as readonly string[]).includes(chosen)) return chosen as Provider;
    throw new Error(`LLM_PROVIDER must be one of ${PROVIDERS.join(", ")}; got "${chosen}"`);
  }
  if (env.OPENAI_API_KEY) return "openai";
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  throw new Error("Set OPENAI_API_KEY or ANTHROPIC_API_KEY (or LLM_PROVIDER) to run the support agent");
}

const RUNNERS: Record<Provider, typeof runOpenAIAgent> = {
  openai: runOpenAIAgent,
  anthropic: runClaudeAgent,
};

let provider: Provider | undefined;
export const currentProvider = (): Provider => (provider ??= pickProvider());

export function runAgent(history: AgentMessage[], userText: string, db: Db): Promise<AgentResult> {
  return RUNNERS[currentProvider()](history, userText, db);
}

/** Maps either SDK's errors to an HTTP status and a customer-safe message. Details stay in server logs. */
export function describeModelError(err: unknown): { status: number; message: string } | undefined {
  if (err instanceof Anthropic.RateLimitError || err instanceof OpenAI.RateLimitError) {
    return { status: 503, message: "The assistant is busy. Try again in a minute." };
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof OpenAI.AuthenticationError) {
    console.error("support agent: API key is missing or invalid");
    return { status: 500, message: "The assistant isn't configured yet." };
  }
  if (err instanceof Anthropic.APIError || err instanceof OpenAI.APIError) {
    console.error(`support agent: model API error ${err.status}`, err.message);
    return { status: 502, message: "The assistant had a problem. Try again." };
  }
  return undefined;
}
