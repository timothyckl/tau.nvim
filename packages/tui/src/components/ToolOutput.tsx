/**
 * ToolOutput.tsx
 *
 * renders a single tool call and its result as a collapsible block.
 */

import React from "react"

export type ToolOutputProps = {
  name: string
  id: string
  input: unknown
  result?: string // undefined while the call is still in progress
}

/** renders a tool_call_start / tool_call_end pair */
export function ToolOutput(_props: ToolOutputProps): React.ReactElement {
  throw new Error("not implemented")
}
