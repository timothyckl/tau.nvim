import { describe, it, expect } from "vitest"
import { createQueue } from "../queue.js"
import type { QueuedMessage } from "../types.js"

describe("createQueue", () => {
  it("drains a steering message and returns empty on second drain", () => {
    const queue = createQueue()
    const msg: QueuedMessage = { kind: "steering", text: "redirect" }
    queue.enqueue(msg)
    expect(queue.drainSteering()).toEqual([msg])
    expect(queue.drainSteering()).toEqual([])
  })

  it("drains a followup message and returns empty on second drain", () => {
    const queue = createQueue()
    const msg: QueuedMessage = { kind: "followup", text: "also do this" }
    queue.enqueue(msg)
    expect(queue.drainFollowup()).toEqual([msg])
    expect(queue.drainFollowup()).toEqual([])
  })

  it("drainSteering does not touch followup messages", () => {
    const queue = createQueue()
    const s: QueuedMessage = { kind: "steering", text: "steer" }
    const f: QueuedMessage = { kind: "followup", text: "follow" }
    queue.enqueue(s)
    queue.enqueue(f)
    expect(queue.drainSteering()).toEqual([s])
    expect(queue.drainFollowup()).toEqual([f])
  })

  it("drainFollowup does not touch steering messages", () => {
    const queue = createQueue()
    const s: QueuedMessage = { kind: "steering", text: "steer" }
    const f: QueuedMessage = { kind: "followup", text: "follow" }
    queue.enqueue(s)
    queue.enqueue(f)
    expect(queue.drainFollowup()).toEqual([f])
    expect(queue.drainSteering()).toEqual([s])
  })

  it("hasPending returns false on empty queue", () => {
    const queue = createQueue()
    expect(queue.hasPending()).toBe(false)
  })

  it("hasPending returns true after enqueue, false after full drain", () => {
    const queue = createQueue()
    queue.enqueue({ kind: "steering", text: "go" })
    expect(queue.hasPending()).toBe(true)
    queue.drainSteering()
    expect(queue.hasPending()).toBe(false)
  })

  it("hasPending remains true if only one kind is drained", () => {
    const queue = createQueue()
    queue.enqueue({ kind: "steering", text: "s" })
    queue.enqueue({ kind: "followup", text: "f" })
    queue.drainSteering()
    expect(queue.hasPending()).toBe(true)
  })

  it("clear empties both kinds; subsequent drains return empty arrays", () => {
    const queue = createQueue()
    queue.enqueue({ kind: "steering", text: "s" })
    queue.enqueue({ kind: "followup", text: "f" })
    queue.clear()
    expect(queue.hasPending()).toBe(false)
    expect(queue.drainSteering()).toEqual([])
    expect(queue.drainFollowup()).toEqual([])
  })

  it("drains multiple messages in enqueue order", () => {
    const queue = createQueue()
    const msgs: QueuedMessage[] = [
      { kind: "steering", text: "first" },
      { kind: "steering", text: "second" },
      { kind: "steering", text: "third" },
    ]
    for (const m of msgs) queue.enqueue(m)
    expect(queue.drainSteering()).toEqual(msgs)
  })

  it("drains multiple followup messages in enqueue order", () => {
    const queue = createQueue()
    const msgs: QueuedMessage[] = [
      { kind: "followup", text: "one" },
      { kind: "followup", text: "two" },
    ]
    for (const m of msgs) queue.enqueue(m)
    expect(queue.drainFollowup()).toEqual(msgs)
  })
})
