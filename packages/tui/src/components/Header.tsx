/**
 * Header.tsx
 *
 * displays the model name, provider, and session path at the top of the tui.
 */

import React from "react"

export type HeaderProps = {
  model: string
  provider: string
  sessionPath: string
}

/** renders the top header bar */
export function Header(_props: HeaderProps): React.ReactElement {
  throw new Error("not implemented")
}
