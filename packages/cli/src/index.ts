#!/usr/bin/env node
/**
 * index.ts
 *
 * entry point. parses cli arguments and starts either the tui renderer or
 * rpc mode, wiring them to the shared agent core.
 */

import { Command } from "commander"

// ---------------------------------------------------------------------------
// cli definition
// ---------------------------------------------------------------------------

const program = new Command()

program
  .name("tau")
  .description("minimal terminal coding agent")
  .version("0.0.1")

program
  .option("--mode <mode>", "renderer mode: tui or rpc", "tui")
  .option("--session <path>", "path to the session jsonl file")
  .option("--ephemeral", "start without a session (no persistence)")
  .option("--continue", "continue the most recent session for this directory")
  .option("--provider <provider>", "provider: anthropic or ollama", "anthropic")
  .option("--model <model>", "model id to use")
  .option("--base-url <url>", "base url for openai-compat provider")
  .option("--extension <path>", "load an extension file (repeatable)", collectRepeatable, [] as string[])
  .option("--compaction-threshold <n>", "fraction of context at which to compact (0.0–1.0)", "0.80")
  .argument("[message]", "optional inline message (non-interactive)")

program.action((_message: string | undefined, _options: Record<string, unknown>) => {
  throw new Error("not implemented")
})

program.parse()

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** collects repeated option values into an array */
function collectRepeatable(value: string, previous: string[]): string[] {
  return [...previous, value]
}
