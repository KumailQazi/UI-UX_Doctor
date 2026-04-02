import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export interface JsonObject {
  [key: string]: unknown;
}

export function isAnthropicModel(model: string): boolean {
  return model.toLowerCase().includes("claude");
}

export function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return new OpenAI({ apiKey });
}

export function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return new Anthropic({ apiKey });
}

export function safeParseJson<T>(content: string | null | undefined, fallback: T): T {
  if (!content) {
    return fallback;
  }

  const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.error("[AI Client] Failed to parse JSON response", error);
    return fallback;
  }
}
