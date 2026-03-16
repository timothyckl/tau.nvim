/**
 * App.tsx
 *
 * root ink component. wires the agent core to the tui renderer. subscribes
 * to AgentEvent and delegates to child components.
 */

import React from "react"
import type { Agent } from "@tau/core"

// ---------------------------------------------------------------------------
// props
// ---------------------------------------------------------------------------

export type AppProps = {
  agent: Agent
  /** initial message to send on mount, if any (from --continue or inline arg) */
  initialMessage?: string
}

// ---------------------------------------------------------------------------
// component
// ---------------------------------------------------------------------------

/**
 * root application component. manages top-level state (current turn, event
 * accumulation) and renders the header, message list, and editor.
 */
export function App(_props: AppProps): React.ReactElement {
  throw new Error("not implemented")
}
