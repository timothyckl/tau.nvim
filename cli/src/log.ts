import { appendFileSync, mkdirSync } from "fs"
import { join } from "path"
import { homedir } from "os"

const debug = process.env.TAU_DEBUG === "1"

let logPath: string | undefined

function getLogPath(): string {
  if (!logPath) {
    const stateDir =
      process.env.XDG_STATE_HOME || join(homedir(), ".local", "state")
    const tauDir = join(stateDir, "tau")
    mkdirSync(tauDir, { recursive: true, mode: 0o700 })
    logPath = join(tauDir, "diag.log")
  }
  return logPath
}

export function log(msg: string): void {
  if (!debug) return
  appendFileSync(getLogPath(), `${Date.now()} ${msg}\n`)
}
