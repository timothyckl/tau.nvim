/**
 * TreeNavigator.tsx
 *
 * modal overlay rendered by the /tree command. shows the full session tree
 * and allows the user to navigate to any node (branching).
 */

import React from "react"
import type { MessageNode } from "@tau/core"

export type TreeNavigatorProps = {
  nodes: MessageNode[]
  /** called when the user selects a node to branch from */
  onBranch: (nodeId: string) => void
  /** called when the user dismisses the overlay */
  onClose: () => void
}

/** modal overlay for browsing and branching the session tree */
export function TreeNavigator(_props: TreeNavigatorProps): React.ReactElement {
  throw new Error("not implemented")
}
