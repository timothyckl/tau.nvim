/**
 * Editor.tsx
 *
 * the text input component at the bottom of the tui. handles multiline input,
 * history navigation, and submit (enter / ctrl+d).
 */

import React from "react"

export type EditorProps = {
  /** called when the user submits a message */
  onSubmit: (text: string, kind: "steering" | "followup") => void
  /** whether the agent is currently running (affects prompt indicator) */
  isRunning: boolean
  /** placeholder shown when the editor is empty */
  placeholder?: string
}

/** the interactive text editor at the bottom of the screen */
export function Editor(_props: EditorProps): React.ReactElement {
  throw new Error("not implemented")
}
