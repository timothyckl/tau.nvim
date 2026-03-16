/**
 * anthropic.ts
 *
 * provider implementation backed by the anthropic sdk. emits AgentEvent
 * values from a streamed api response. see docs/architecture.md for the
 * provider interface contract.
 */

import type { AgentEvent, MessageNode, Provider, StreamOptions, Tool } from "../types.js"

/**
 * configuration for the anthropic provider.
 */
export type AnthropicProviderConfig = {
  /** api key — defaults to ANTHROPIC_API_KEY env var */
  apiKey?: string
}

/**
 * creates a Provider backed by the Anthropic SDK.
 *
 * @param config - anthropic-specific configuration
 */
export function createAnthropicProvider(config: AnthropicProviderConfig = {}): Provider {
  throw new Error("not implemented")
}
