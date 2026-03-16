/**
 * StatusBar.tsx
 *
 * one-line bar at the bottom of the tui. shows token usage, key hints,
 * and any lines added by extensions via addStatusLine().
 */

import React from "react"

export type StatusBarProps = {
  tokenCount?: number
  contextLimit?: number
  /** additional status line renderers registered by extensions */
  extraLines: Array<() => string>
}

/** renders the bottom status bar */
export function StatusBar(_props: StatusBarProps): React.ReactElement {
  throw new Error("not implemented")
}
