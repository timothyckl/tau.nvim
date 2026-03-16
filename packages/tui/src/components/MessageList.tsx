/**
 * MessageList.tsx
 *
 * renders the conversation history: user messages, assistant text deltas,
 * thinking blocks, and tool call summaries.
 */

import React from "react"
import type { AgentEvent, MessageNode } from "@tau/core"

export type MessageListProps = {
  /** completed message nodes from the active session branch */
  history: MessageNode[]
  /** live events from the current in-progress turn */
  liveEvents: AgentEvent[]
}

/** renders the scrollable list of conversation messages */
export function MessageList(_props: MessageListProps): React.ReactElement {
  throw new Error("not implemented")
}
