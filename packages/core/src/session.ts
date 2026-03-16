/**
 * session.ts
 *
 * reads and writes the append-only jsonl session tree. see docs/session-format.md
 * for the full file format spec.
 */

import { appendFile, mkdir, open, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { homedir } from "node:os"
import { createHash, randomUUID } from "node:crypto"
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
  return { type: "tau-session", version: SESSION_VERSION }
}

// ---------------------------------------------------------------------------
// internal helpers
// ---------------------------------------------------------------------------

/**
 * @internal
 * constructs a session object over an in-memory node list and file path.
 * all methods close over the mutable `nodes`, `nodeById`, and `activeParentId`.
 *
 * @param filePath - absolute path to the underlying jsonl file
 * @param initialNodes - nodes already loaded from disk (may be empty)
 * @param initialActiveParentId - id of the active leaf node, or null for empty sessions
 */
function buildSession(
  filePath: string,
  initialNodes: MessageNode[],
  initialActiveParentId: string | null,
): Session {
  const nodes: MessageNode[] = [...initialNodes]
  const nodeById = new Map<string, MessageNode>(nodes.map(n => [n.id, n]))
  let activeParentId: string | null = initialActiveParentId

  // serialise all disk writes so concurrent append() calls cannot interleave
  let writeChain: Promise<void> = Promise.resolve()

  return {
    path: filePath,

    activeBranch(): MessageNode[] {
      // walk from the active leaf back to root, then reverse to get root-first order
      const branch: MessageNode[] = []
      let currentId: string | null = activeParentId
      while (currentId !== null) {
        const node = nodeById.get(currentId)
        if (node === undefined) {
          throw new Error(`broken session tree: node "${currentId}" referenced but not found`)
        }
        branch.push(node)
        currentId = node.parentId
      }
      return branch.reverse()
    },

    tree(): MessageNode[] {
      return [...nodes]
    },

    async append(input): Promise<MessageNode> {
      // build the complete node, overriding parentId with the current active parent
      const node: MessageNode = {
        id: randomUUID(),
        parentId: activeParentId,
        role: input.role,
        content: input.content,
        timestamp: Date.now(),
        // conditional spread required by exactOptionalPropertyTypes — assigning
        // undefined to an optional key is a type error under this setting
        ...(input.meta !== undefined ? { meta: input.meta } : {}),
      }
      // enqueue the disk write behind any in-flight write to prevent interleaving
      writeChain = writeChain.then(() => appendFile(filePath, JSON.stringify(node) + "\n"))
      await writeChain
      nodes.push(node)
      nodeById.set(node.id, node)
      activeParentId = node.id
      return node
    },

    branch(fromNodeId: string): void {
      if (!nodeById.has(fromNodeId)) {
        throw new Error(`node not found: ${fromNodeId}`)
      }
      activeParentId = fromNodeId
    },
  }
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
  const content = await readFile(filePath, "utf-8")
  const lines = content.split("\n")

  // line 0 is the header — required
  const firstLine = lines[0]
  if (firstLine === undefined || firstLine.trim() === "") {
    throw new Error("session file is empty")
  }

  const header = JSON.parse(firstLine) as SessionHeader
  if (header.type !== "tau-session") {
    throw new Error(`invalid session header type: "${header.type}"`)
  }
  if (header.version !== SESSION_VERSION) {
    throw new Error(`unsupported session version: ${header.version}`)
  }

  // parse remaining non-empty lines as message nodes; annotate errors with line context
  const nodes: MessageNode[] = lines
    .slice(1)
    .filter(l => l.trim() !== "")
    .map((line, i) => {
      try {
        return JSON.parse(line) as MessageNode
      } catch (err) {
        throw new Error(`session parse error on line ${i + 2}: ${(err as Error).message}`)
      }
    })

  // find the active leaf: the last node in file order that has no children.
  // file order (append order) is the authoritative recency signal — timestamps
  // can be user-supplied or skewed by clock changes, so we do not sort by them.
  const parentIds = new Set(
    nodes.map(n => n.parentId).filter((id): id is string => id !== null),
  )
  const leaves = nodes.filter(n => !parentIds.has(n.id))
  const activeLeaf = leaves[leaves.length - 1]
  const activeParentId = activeLeaf !== undefined ? activeLeaf.id : null

  return buildSession(filePath, nodes, activeParentId)
}

/**
 * creates a new empty session file at the given path, writing only the header
 * line. throws if the file already exists.
 *
 * @param filePath - absolute path where the new session file should be created
 */
export async function createSession(filePath: string): Promise<Session> {
  await mkdir(dirname(filePath), { recursive: true })

  // "ax" flag: exclusive create — throws EEXIST if file already exists
  const handle = await open(filePath, "ax")
  await handle.writeFile(JSON.stringify(createHeader()) + "\n")
  await handle.close()

  return buildSession(filePath, [], null)
}

/**
 * returns the default session file path for the current working directory,
 * based on a hash of the cwd. note: the filename is a fresh uuid on every
 * call — callers must persist the returned path to resume the same session.
 *
 * @param cwd - the working directory to derive the path from
 */
export function resolveSessionPath(cwd: string): string {
  // use the first 16 hex chars of the sha-256 of cwd as a stable directory name
  const hash = createHash("sha256").update(cwd).digest("hex").slice(0, 16)
  const filename = randomUUID()
  return join(homedir(), ".config", "tau", "sessions", hash, `${filename}.jsonl`)
}
