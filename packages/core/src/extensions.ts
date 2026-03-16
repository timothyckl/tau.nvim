/**
 * extensions.ts
 *
 * runtime loading and management of tau extensions. see docs/extensions.md.
 */

import type { ExtensionAPI, ExtensionFactory, Tool, CommandHandler, EventHandler, AgentEventType, SessionReader } from "./types.js"

// ---------------------------------------------------------------------------
// extension registry
// ---------------------------------------------------------------------------

/**
 * holds all state registered by loaded extensions: tools, command overrides,
 * event handlers, and slash commands.
 */
export interface ExtensionRegistry {
  /** all tools currently registered (built-ins + extension-registered) */
  readonly tools: Map<string, Tool>

  /** all slash commands registered by extensions */
  readonly commands: Map<string, CommandHandler>

  /** event handlers registered by extensions, keyed by event type */
  readonly handlers: Map<AgentEventType, EventHandler[]>
}

// ---------------------------------------------------------------------------
// loader
// ---------------------------------------------------------------------------

/**
 * options passed to the extension loader.
 */
export type LoadExtensionsOptions = {
  /** paths to extension .ts files to load, in order */
  paths: string[]
  /** the session reader exposed to extensions */
  session: SessionReader
  /** the notify function exposed to extensions */
  notify: (message: string, level?: "info" | "warn" | "error") => void
  /** if true, skip any extension that imports TuiExtensionAPI (rpc mode) */
  rejectTuiExtensions: boolean
}

/**
 * loads the given extension files in order using tsx. returns a populated
 * registry of all registered tools, commands, and event handlers.
 *
 * @param options - loader configuration and dependencies
 */
export async function loadExtensions(options: LoadExtensionsOptions): Promise<ExtensionRegistry> {
  throw new Error("not implemented")
}

/**
 * discovers extension files from the standard locations:
 * 1. ~/.config/tau/extensions/*.ts
 * 2. .tau/extensions/*.ts (project-local)
 * 3. any paths passed via --extension cli flags
 *
 * @param cwd - the current working directory (for project-local discovery)
 * @param extraPaths - additional paths from --extension flags
 */
export async function discoverExtensionPaths(
  cwd: string,
  extraPaths: string[],
): Promise<string[]> {
  throw new Error("not implemented")
}

// ---------------------------------------------------------------------------
// api builder
// ---------------------------------------------------------------------------

/**
 * builds the ExtensionAPI object passed to each extension's default export.
 * mutations accumulate into the provided registry.
 *
 * @param registry - the mutable registry to populate
 * @param session - read-only session surface
 * @param notify - renderer-specific notification callback
 */
function buildExtensionAPI(
  registry: MutableExtensionRegistry,
  session: SessionReader,
  notify: (message: string, level?: "info" | "warn" | "error") => void,
): ExtensionAPI {
  throw new Error("not implemented")
}

// ---------------------------------------------------------------------------
// internal mutable registry (not exported as part of public api)
// ---------------------------------------------------------------------------

/** mutable version of the registry, used only during loading */
interface MutableExtensionRegistry extends ExtensionRegistry {
  registerTool(tool: Tool): void
  overrideTool(name: string, tool: Tool): void
  registerCommand(name: string, handler: CommandHandler): void
  addHandler(event: AgentEventType, handler: EventHandler): void
}

/**
 * creates a new empty mutable registry, pre-populated with the given
 * built-in tools.
 *
 * @param builtins - the default tool set before extensions run
 */
export function createRegistry(builtins: Tool[]): MutableExtensionRegistry {
  throw new Error("not implemented")
}
