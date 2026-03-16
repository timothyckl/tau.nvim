import { describe, it, expect, afterEach } from "vitest"
import { writeFile, unlink, mkdir } from "node:fs/promises"
import { tmpdir, homedir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import {
  createHeader,
  createSession,
  loadSession,
  resolveSessionPath,
  SESSION_VERSION,
} from "../session.js"
import type { MessageNode } from "../types.js"

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** returns a unique temp file path that does not yet exist */
function tempPath(): string {
  return join(tmpdir(), `tau-test-${randomUUID()}.jsonl`)
}

/** writes raw content to a temp path, returns the path */
async function writeTempFile(content: string): Promise<string> {
  const p = tempPath()
  await writeFile(p, content, "utf-8")
  return p
}

// track all temp paths created per test for cleanup
const tempPaths: string[] = []

afterEach(async () => {
  // clean up temp files; ignore errors for files that don't exist
  await Promise.all(
    tempPaths.splice(0).map(p => unlink(p).catch(() => undefined)),
  )
})

/** registers a path for cleanup and returns it */
function track(p: string): string {
  tempPaths.push(p)
  return p
}

// ---------------------------------------------------------------------------
// createHeader
// ---------------------------------------------------------------------------

describe("createHeader", () => {
  it("returns the correct header shape", () => {
    expect(createHeader()).toEqual({ type: "tau-session", version: 1 })
  })
})

// ---------------------------------------------------------------------------
// resolveSessionPath
// ---------------------------------------------------------------------------

describe("resolveSessionPath", () => {
  it("path ends in .jsonl", () => {
    expect(resolveSessionPath("/some/cwd")).toMatch(/\.jsonl$/)
  })

  it("path is under ~/.config/tau/sessions/", () => {
    const p = resolveSessionPath("/some/cwd")
    expect(p.startsWith(join(homedir(), ".config", "tau", "sessions"))).toBe(true)
  })

  it("dir segment is exactly 16 hex characters", () => {
    const p = resolveSessionPath("/some/cwd")
    const parts = p.split("/")
    // dir segment is two levels up from the filename
    const dir = parts[parts.length - 2]
    expect(dir).toMatch(/^[0-9a-f]{16}$/)
  })

  it("same cwd produces same dir segment but different filenames", () => {
    const p1 = resolveSessionPath("/my/project")
    const p2 = resolveSessionPath("/my/project")

    const dir1 = p1.split("/").at(-2)
    const dir2 = p2.split("/").at(-2)
    expect(dir1).toBe(dir2)

    const file1 = p1.split("/").at(-1)
    const file2 = p2.split("/").at(-1)
    expect(file1).not.toBe(file2)
  })

  it("different cwds produce different dir segments", () => {
    const dir1 = resolveSessionPath("/project/a").split("/").at(-2)
    const dir2 = resolveSessionPath("/project/b").split("/").at(-2)
    expect(dir1).not.toBe(dir2)
  })
})

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------

describe("createSession", () => {
  it("creates a file with exactly one line (the header)", async () => {
    const p = track(tempPath())
    await createSession(p)
    const { readFile } = await import("node:fs/promises")
    const content = await readFile(p, "utf-8")
    const lines = content.split("\n").filter(l => l.trim() !== "")
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0]!)).toEqual({ type: "tau-session", version: SESSION_VERSION })
  })

  it("tree() returns empty array on fresh session", async () => {
    const p = track(tempPath())
    const session = await createSession(p)
    expect(session.tree()).toEqual([])
  })

  it("activeBranch() returns empty array on fresh session", async () => {
    const p = track(tempPath())
    const session = await createSession(p)
    expect(session.activeBranch()).toEqual([])
  })

  it("throws if the file already exists", async () => {
    const p = track(tempPath())
    await createSession(p)
    await expect(createSession(p)).rejects.toThrow()
  })

  it("creates parent directories recursively", async () => {
    const p = track(join(tmpdir(), `tau-test-${randomUUID()}`, "nested", "session.jsonl"))
    // note: intermediate directories under tmpdir() are intentionally not cleaned up;
    // they are harmless on a developer machine and do not affect test correctness
    await createSession(p)
    const { readFile } = await import("node:fs/promises")
    const content = await readFile(p, "utf-8")
    expect(content.trim()).not.toBe("")
  })
})

// ---------------------------------------------------------------------------
// loadSession — spec fixture
// ---------------------------------------------------------------------------

describe("loadSession — spec fixture", () => {
  const FIXTURE = [
    `{"type":"tau-session","version":1}`,
    `{"id":"a1","parentId":null,"role":"user","content":{"type":"text","text":"list files"},"timestamp":1700000000000}`,
    `{"id":"a2","parentId":"a1","role":"assistant","content":{"type":"tool_call","name":"bash","id":"t1","input":{"command":"ls"}},"timestamp":1700000001000}`,
    `{"id":"a3","parentId":"a2","role":"tool_result","content":{"type":"tool_result","toolCallId":"t1","result":"src/ package.json"},"timestamp":1700000002000}`,
    `{"id":"a4","parentId":"a3","role":"assistant","content":{"type":"text","text":"The directory contains src/ and package.json."},"timestamp":1700000003000}`,
    `{"id":"b1","parentId":"a3","role":"user","content":{"type":"text","text":"what is in src?"},"timestamp":1700000010000}`,
  ].join("\n") + "\n"

  it("tree() returns all 5 nodes in file order", async () => {
    const p = track(await writeTempFile(FIXTURE))
    const session = await loadSession(p)
    const ids = session.tree().map(n => n.id)
    expect(ids).toEqual(["a1", "a2", "a3", "a4", "b1"])
  })

  it("activeBranch() returns [a1, a2, a3, b1] — last leaf wins", async () => {
    const p = track(await writeTempFile(FIXTURE))
    const session = await loadSession(p)
    const ids = session.activeBranch().map(n => n.id)
    expect(ids).toEqual(["a1", "a2", "a3", "b1"])
  })
})

// ---------------------------------------------------------------------------
// loadSession — validation
// ---------------------------------------------------------------------------

describe("loadSession — validation", () => {
  it("throws on missing file", async () => {
    await expect(loadSession("/nonexistent/path/file.jsonl")).rejects.toThrow()
  })

  it("throws with message containing the version number on unknown version", async () => {
    const content = `{"type":"tau-session","version":99}\n`
    const p = track(await writeTempFile(content))
    await expect(loadSession(p)).rejects.toThrow("99")
  })

  it("throws on malformed JSON in the header line", async () => {
    const p = track(await writeTempFile("not-valid-json\n"))
    await expect(loadSession(p)).rejects.toThrow()
  })

  it("throws on empty file", async () => {
    const p = track(await writeTempFile(""))
    await expect(loadSession(p)).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// append
// ---------------------------------------------------------------------------

describe("append", () => {
  it("first node gets parentId: null", async () => {
    const p = track(tempPath())
    const session = await createSession(p)
    const node = await session.append({
      parentId: null,
      role: "user",
      content: { type: "text", text: "hello" },
    })
    expect(node.parentId).toBeNull()
  })

  it("returned node has a valid UUID id and a sane timestamp", async () => {
    const p = track(tempPath())
    const session = await createSession(p)
    const before = Date.now()
    const node = await session.append({
      parentId: null,
      role: "user",
      content: { type: "text", text: "hi" },
    })
    const after = Date.now()
    expect(node.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(node.timestamp).toBeGreaterThanOrEqual(before)
    expect(node.timestamp).toBeLessThanOrEqual(after)
  })

  it("caller-supplied parentId is overridden by the active parent", async () => {
    const p = track(tempPath())
    const session = await createSession(p)
    // active parent is null; even if caller passes a bogus parentId it is overridden
    const node = await session.append({
      parentId: "should-be-ignored",
      role: "user",
      content: { type: "text", text: "test" },
    })
    expect(node.parentId).toBeNull()
  })

  it("appended nodes persist after reload", async () => {
    const p = track(tempPath())
    const session = await createSession(p)
    const appended = await session.append({
      parentId: null,
      role: "user",
      content: { type: "text", text: "persisted?" },
    })

    const reloaded = await loadSession(p)
    const nodes = reloaded.tree()
    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.id).toBe(appended.id)
  })

  it("activeBranch() reflects appended nodes", async () => {
    const p = track(tempPath())
    const session = await createSession(p)
    const n1 = await session.append({ parentId: null, role: "user", content: { type: "text", text: "a" } })
    const n2 = await session.append({ parentId: null, role: "assistant", content: { type: "text", text: "b" } })
    const ids = session.activeBranch().map(n => n.id)
    expect(ids).toEqual([n1.id, n2.id])
  })
})

// ---------------------------------------------------------------------------
// branch
// ---------------------------------------------------------------------------

describe("branch", () => {
  it("next append after branch() gets the correct parentId", async () => {
    const p = track(tempPath())
    const session = await createSession(p)
    await session.append({ parentId: null, role: "user", content: { type: "text", text: "a1" } })
    const a2 = await session.append({ parentId: null, role: "assistant", content: { type: "text", text: "a2" } })
    const a3 = await session.append({ parentId: null, role: "user", content: { type: "text", text: "a3" } })

    session.branch(a2.id)
    const b1 = await session.append({ parentId: null, role: "user", content: { type: "text", text: "branch" } })
    expect(b1.parentId).toBe(a2.id)
    // a3 is not a child of b1, so it should still be in tree
    expect(session.tree()).toHaveLength(4)
  })

  it("throws when branching from an unknown node id", async () => {
    const p = track(tempPath())
    const session = await createSession(p)
    expect(() => session.branch("nonexistent-id")).toThrow("nonexistent-id")
  })

  it("activeBranch() reflects the new branch path", async () => {
    const p = track(tempPath())
    const session = await createSession(p)
    const a1 = await session.append({ parentId: null, role: "user", content: { type: "text", text: "a1" } })
    const a2 = await session.append({ parentId: null, role: "assistant", content: { type: "text", text: "a2" } })
    // branch back to a1 and append
    session.branch(a1.id)
    const b1 = await session.append({ parentId: null, role: "user", content: { type: "text", text: "b1" } })

    const ids = session.activeBranch().map(n => n.id)
    expect(ids).toEqual([a1.id, b1.id])
    // a2 is still in tree
    expect(session.tree().map(n => n.id)).toContain(a2.id)
  })
})

// ---------------------------------------------------------------------------
// edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("single-node session: tree has 1 node, activeBranch has 1 node", async () => {
    const p = track(tempPath())
    const session = await createSession(p)
    const n = await session.append({ parentId: null, role: "user", content: { type: "text", text: "solo" } })
    expect(session.tree()).toHaveLength(1)
    expect(session.activeBranch().map(x => x.id)).toEqual([n.id])
  })

  it("last node in file order wins as active leaf even with higher timestamps earlier", async () => {
    // write a fixture where the last node has a lower timestamp than an earlier node
    const content = [
      `{"type":"tau-session","version":1}`,
      `{"id":"root","parentId":null,"role":"user","content":{"type":"text","text":"root"},"timestamp":1000}`,
      `{"id":"hi-ts","parentId":"root","role":"assistant","content":{"type":"text","text":"high"},"timestamp":9999}`,
      `{"id":"lo-ts","parentId":"root","role":"user","content":{"type":"text","text":"low"},"timestamp":1}`,
    ].join("\n") + "\n"
    const p = track(await writeTempFile(content))
    const session = await loadSession(p)
    // lo-ts is the last leaf in file order, so it should be the active leaf
    const ids = session.activeBranch().map(n => n.id)
    expect(ids).toEqual(["root", "lo-ts"])
  })

  it("empty session (no nodes after header) has empty tree and activeBranch", async () => {
    const content = `{"type":"tau-session","version":1}\n`
    const p = track(await writeTempFile(content))
    const session = await loadSession(p)
    expect(session.tree()).toEqual([])
    expect(session.activeBranch()).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// round-trip
// ---------------------------------------------------------------------------

describe("round-trip", () => {
  it("create, append 3 nodes, reload — tree() and activeBranch() are identical", async () => {
    const p = track(tempPath())
    const session = await createSession(p)

    const n1 = await session.append({ parentId: null, role: "user", content: { type: "text", text: "msg 1" } })
    const n2 = await session.append({ parentId: null, role: "assistant", content: { type: "text", text: "msg 2" } })
    const n3 = await session.append({ parentId: null, role: "user", content: { type: "text", text: "msg 3" } })

    const originalTree = session.tree().map(n => n.id)
    const originalBranch = session.activeBranch().map(n => n.id)

    const reloaded = await loadSession(p)
    expect(reloaded.tree().map(n => n.id)).toEqual(originalTree)
    expect(reloaded.activeBranch().map(n => n.id)).toEqual(originalBranch)
    expect(originalBranch).toEqual([n1.id, n2.id, n3.id])
  })
})
