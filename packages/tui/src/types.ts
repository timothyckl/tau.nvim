/**
 * types.ts
 *
 * tui-specific extension types. kept separate from @tau/core to avoid pulling
 * react into the core package.
 */

import type { ComponentType } from "react"
import type { ExtensionAPI } from "@tau/core"

/**
 * tui-only extension of the base api. extensions that import this type are
 * explicitly tui-only and will not be loaded in rpc mode.
 */
export type TuiExtensionAPI = ExtensionAPI & {
  /** add a persistent widget above the message list */
  addWidget(component: ComponentType): void

  /** temporarily replace the editor input with a custom component */
  replaceEditor(component: ComponentType): void

  /** add a line to the status bar */
  addStatusLine(render: () => string): void
}
