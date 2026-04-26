import { buildSystemPrompt } from "./prompt"
import { buildUserMessage } from "./context"
import { streamDirect } from "./llm"
import { estimatePrompt } from "./tokens"
import { log } from "./log"

function usage(): never {
  process.stderr.write(
    "Usage: tau <instruction> [--context-above <text>] [--context-below <text>] [--file <path>] [--filetype <lang>] [--context-file <path>]...\n"
  )
  process.exit(1)
}

function parseArgs(argv: string[]): {
  instruction: string
  contextAbove?: string
  contextBelow?: string
  filename?: string
  filetype?: string
  contextFiles: string[]
} {
  const args = argv.slice(2)
  if (args.length === 0) usage()

  let instruction = ""
  let contextAbove: string | undefined
  let contextBelow: string | undefined
  let filename: string | undefined
  let filetype: string | undefined
  const contextFiles: string[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--context-above") {
      contextAbove = args[++i]
    } else if (arg === "--context-below") {
      contextBelow = args[++i]
    } else if (arg === "--file") {
      filename = args[++i]
    } else if (arg === "--filetype") {
      filetype = args[++i]
    } else if (arg === "--context-file") {
      contextFiles.push(args[++i])
    } else if (arg.startsWith("--")) {
      process.stderr.write(`tau: unknown flag ${arg}\n`)
      ++i // skip the next token (assumed value)
    } else {
      instruction = arg
    }
  }

  if (!instruction) usage()

  return { instruction, contextAbove, contextBelow, filename, filetype, contextFiles }
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = []
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString("utf-8")
}

function parseEnvFloat(name: string): number | undefined {
  const raw = process.env[name]
  if (!raw) return undefined
  const val = parseFloat(raw)
  if (isNaN(val)) {
    process.stderr.write(`tau: invalid value for ${name}: ${raw}\n`)
    process.exit(1)
  }
  return val
}

function parseEnvInt(name: string): number | undefined {
  const raw = process.env[name]
  if (!raw) return undefined
  const val = parseInt(raw, 10)
  if (isNaN(val)) {
    process.stderr.write(`tau: invalid value for ${name}: ${raw}\n`)
    process.exit(1)
  }
  return val
}

async function main() {
  const opts = parseArgs(process.argv)

  const selection = await readStdin()

  const apiUrl = process.env.TAU_API_URL
  const apiKey = process.env.TAU_API_KEY
  const model = process.env.TAU_MODEL ?? "gpt-4o"
  const temperature = parseEnvFloat("TAU_TEMPERATURE")
  const maxTokens = parseEnvInt("TAU_MAX_TOKENS")
  const topP = parseEnvFloat("TAU_TOP_P")

  if (!apiUrl) {
    process.stderr.write("tau: TAU_API_URL is not set\n")
    process.exit(1)
  }
  if (!apiKey) {
    process.stderr.write("tau: TAU_API_KEY is not set\n")
    process.exit(1)
  }

  const hasContextFiles = opts.contextFiles.length > 0
  const systemPrompt = buildSystemPrompt({ filename: opts.filename, filetype: opts.filetype, selectionEmpty: !selection.trim(), hasContextFiles })
  const userMessage = buildUserMessage({
    selection,
    instruction: opts.instruction,
    contextAbove: opts.contextAbove,
    contextBelow: opts.contextBelow,
    contextFiles: opts.contextFiles,
  })

  const rawWindow = process.env.TAU_CONTEXT_WINDOW
  const parsedWindow = rawWindow ? parseInt(rawWindow, 10) : NaN
  const contextWindow = parsedWindow > 0 ? parsedWindow : undefined
  const estimate = estimatePrompt(systemPrompt, userMessage, contextWindow)
  process.stderr.write(`TAU_META:${JSON.stringify(estimate)}\n`)
  log("token-estimate: " + JSON.stringify(estimate))

  log("stream-start")
  try {
    await streamDirect(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      { apiUrl, apiKey, model, temperature, maxTokens, topP },
      (token) => process.stdout.write(token)
    )
    log("stream-done")
  } catch (err) {
    log("stream-error: " + String(err))
    process.stderr.write(`tau: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  }
}

main().then(() => {
  log("main-resolved, calling exit")
  process.exit(0)
})
