/**
 * openai-compat.ts
 *
 * provider implementation backed by the openai sdk, pointed at a custom
 * baseURL. covers ollama, lm studio, and any other openai-compatible server.
 */

import type { Provider } from "../types.js"

/**
 * configuration for the openai-compatible provider.
 */
export type OpenAICompatProviderConfig = {
  /**
   * base url of the openai-compatible server.
   * e.g. "http://localhost:11434/v1" for ollama.
   */
  baseURL: string
  /** api key — many local servers accept any non-empty string */
  apiKey?: string
}

/**
 * creates a Provider backed by an OpenAI-compatible API endpoint.
 *
 * @param config - base url and optional api key
 */
export function createOpenAICompatProvider(config: OpenAICompatProviderConfig): Provider {
  throw new Error("not implemented")
}
