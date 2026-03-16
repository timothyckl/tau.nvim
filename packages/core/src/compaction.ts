/**
 * compaction.ts
 *
 * default compaction strategy. summarises older message nodes into a synthetic
 * summary node, keeping recent turns verbatim. see docs/compaction.md.
 */

import type { AgentEvent, MessageNode, Provider } from "./types.js"
import type { Session } from "./session.js"

// ---------------------------------------------------------------------------
// compaction settings
// ---------------------------------------------------------------------------

/** runtime-configurable compaction settings */
export type CompactionSettings = {
  /** enable proactive compaction based on token threshold (default: true) */
  proactive: boolean
  /** fraction of context window that triggers proactive compaction (default: 0.80) */
  threshold: number
  /** number of most-recent turns to keep verbatim (default: 10) */
  keepTurns: number
}

export const DEFAULT_COMPACTION_SETTINGS: CompactionSettings = {
  proactive: true,
  threshold: 0.80,
  keepTurns: 10,
}

// ---------------------------------------------------------------------------
// compaction runner
// ---------------------------------------------------------------------------

/**
 * options passed to the compaction runner.
 */
export type CompactionOptions = {
  session: Session
  provider: Provider
  settings: CompactionSettings
  /** optional custom summary instructions from a manual `/compact` call */
  instructions?: string
  /** emit agent events (compaction_start, compaction_end) to this callback */
  emit: (event: AgentEvent) => void
}

/**
 * runs the default compaction strategy: summarises all nodes before the
 * cutoff into a new summary node appended to the session. emits
 * `compaction_start` and `compaction_end` events.
 *
 * @param options - compaction configuration and dependencies
 */
export async function runCompaction(options: CompactionOptions): Promise<void> {
  throw new Error("not implemented")
}

/**
 * checks whether proactive compaction should be triggered given current token
 * usage and model context limit.
 *
 * @param tokenCount - current token count of the active branch
 * @param contextLimit - the model's maximum context window size
 * @param threshold - fraction (0.0–1.0) at which to trigger compaction
 */
export function shouldCompact(
  tokenCount: number,
  contextLimit: number,
  threshold: number,
): boolean {
  throw new Error("not implemented")
}

/**
 * identifies the cutoff node: the last node to be summarised. everything
 * after this node (up to keepTurns turns) is kept verbatim.
 *
 * @param branch - the full active branch from root to leaf
 * @param keepTurns - number of turns to preserve verbatim
 */
export function findCutoffNode(
  branch: MessageNode[],
  keepTurns: number,
): MessageNode | null {
  throw new Error("not implemented")
}
