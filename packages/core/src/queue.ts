/**
 * queue.ts
 *
 * typed queue for messages sent while the agent is running. see
 * docs/architecture.md for the steering vs follow-up semantics.
 */

import type { QueuedMessage } from "./types.js"

// ---------------------------------------------------------------------------
// message queue
// ---------------------------------------------------------------------------

/**
 * a small typed queue checked by the agent loop at two points:
 * - after each tool execution (for steering messages)
 * - at the end of a full turn (for follow-up messages)
 */
export interface MessageQueue {
  /** enqueue a message to be delivered at the appropriate point */
  enqueue(message: QueuedMessage): void

  /**
   * drains all pending steering messages. called after each tool execution.
   * if any steering messages are present the agent loop should discard any
   * remaining queued tool calls and inject the steering text.
   */
  drainSteering(): QueuedMessage[]

  /**
   * drains all pending follow-up messages. called after the full agent turn
   * ends (model has finished and all tools are done).
   */
  drainFollowup(): QueuedMessage[]

  /** returns true if there are any queued messages of either kind */
  hasPending(): boolean

  /** removes all messages from the queue without processing them */
  clear(): void
}

// ---------------------------------------------------------------------------
// factory
// ---------------------------------------------------------------------------

/**
 * creates a new empty message queue.
 */
export function createQueue(): MessageQueue {
  // two separate arrays keep drain operations O(n) without cross-contamination
  const steering: QueuedMessage[] = []
  const followup: QueuedMessage[] = []

  return {
    enqueue(message) {
      if (message.kind === "steering") steering.push(message)
      else followup.push(message)
    },
    drainSteering() { return steering.splice(0) },
    drainFollowup() { return followup.splice(0) },
    hasPending()    { return steering.length > 0 || followup.length > 0 },
    clear()         { steering.splice(0); followup.splice(0) },
  }
}
