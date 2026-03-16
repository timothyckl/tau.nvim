/**
 * session.ts
 *
 * reads and writes the append-only jsonl session tree. see docs/session-format.md
 * for the full file format spec.
 */

import type { MessageNode, SessionHeader } from "./types.js"

// ---------------------------------------------------------------------------
// public interface
// ---------------------------------------------------------------------------

/**
 * a loaded session. all writes are appended to the underlying jsonl file;
 * no existing lines are ever modified.
 *
 * use the standalone `loadSession()` and `createSession()` factory functions
 * to obtain an instance — do not construct directly.
 */
export interface Session {
  // -- read ------------------------------------------------------------------

  /**
   * returns the ordered list of nodes on the active branch, from root to the
   * current leaf.
   */
  activeBranch(): MessageNode[]

  /** returns all nodes in the tree, in file order */
  tree(): MessageNode[]

  // -- write -----------------------------------------------------------------

  /**
   * appends a new node as a child of the current active parent. auto-assigns
   * `id` (uuid v4) and `timestamp` (unix ms). returns the completed node.
   *
   * @param node - the node to append, without id or timestamp
   */
  append(node: Omit<MessageNode, "id" | "timestamp">): Promise<MessageNode>

  /**
   * sets the in-memory active parent for the next append. use to create a
   * branch from any existing node. on a fresh load from disk the active parent
   * is set to the most recently written leaf; call branch() to override it.
   *
   * @param fromNodeId - id of the node to branch from
   */
  branch(fromNodeId: string): void

  /** absolute path to the underlying jsonl file */
  readonly path: string
}

// ---------------------------------------------------------------------------
// session header
// ---------------------------------------------------------------------------

/** the expected version tag written on line 1 of every session file */
export const SESSION_VERSION = 1 as const

/** creates a new session header object */
export function createHeader(): SessionHeader {
  throw new Error("not implemented")
}

// ---------------------------------------------------------------------------
// factory functions
// ---------------------------------------------------------------------------

/**
 * loads an existing session from disk, parses the jsonl tree, and validates
 * the version header. throws if the file does not exist or the version is
 * unrecognised.
 *
 * @param filePath - absolute path to the jsonl session file
 */
export async function loadSession(filePath: string): Promise<Session> {
  throw new Error("not implemented")
}

/**
 * creates a new empty session file at the given path, writing only the header
 * line. throws if the file already exists.
 *
 * @param filePath - absolute path where the new session file should be created
 */
export async function createSession(filePath: string): Promise<Session> {
  throw new Error("not implemented")
}

/**
 * returns the default session file path for the current working directory,
 * based on a hash of the cwd.
 *
 * @param cwd - the working directory to derive the path from
 */
export function resolveSessionPath(cwd: string): string {
  throw new Error("not implemented")
}
