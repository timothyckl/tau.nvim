local context = require("tau.context")
local runner = require("tau.runner")
local ui = require("tau.ui")

local M = {}

--- @type table
local config = {}

local SIGTERM = 15

--- @type { handle: vim.SystemObj|nil, bufnr: integer, cancelled: boolean, prev_esc: table } | nil
local _job = nil

--- Tear down all in-flight state: stop UI, restore <Esc> mapping, unlock buffer.
--- @param bufnr integer
local function _cleanup(bufnr)
  if not _job then return end
  ui.stop()
  pcall(vim.keymap.del, "n", "<Esc>", { buffer = bufnr })
  if _job.prev_esc and _job.prev_esc.lhs ~= "" then
    vim.fn.mapset("n", false, _job.prev_esc)
  end
  vim.bo[bufnr].modifiable = true
  _job = nil
end

--- Configure the plugin. Must be called before using :Tau.
--- @param opts table { api_url: string, api_key: string, model?: string, debug?: boolean, timeout_ms?: number }
function M.setup(opts)
  vim.validate({
    api_url    = { opts.api_url, "string" },
    api_key    = { opts.api_key, "string" },
    model      = { opts.model, "string", true },
    debug      = { opts.debug, "boolean", true },
    timeout_ms = { opts.timeout_ms, "number", true },
  })
  config = opts
end

--- Main entry point. Called from the :Tau command.
--- @param opts table vim command opts (line1, line2, args)
function M.run(opts)
  if not config.api_url then
    vim.api.nvim_echo({ { "tau: call require('tau').setup() first", "ErrorMsg" } }, false, {})
    return
  end

  local bufnr = vim.api.nvim_get_current_buf()

  -- Capture selection line numbers synchronously before any async call.
  -- opts.line1/line2 are authoritative when the command is called with a range.
  -- Fall back to visual marks otherwise.
  local start_line = opts.line1 or vim.fn.line("'<")
  local end_line = opts.line2 or vim.fn.line("'>")

  if start_line == 0 or end_line == 0 then
    vim.api.nvim_echo({ { "tau: no selection", "WarningMsg" } }, false, {})
    return
  end

  -- Get instruction: from command args or prompt
  local instruction = opts.args and opts.args ~= "" and opts.args or nil

  if not instruction then
    vim.ui.input({ prompt = "Instruction: " }, function(input)
      if not input or input == "" then
        return -- user cancelled
      end
      M._execute(bufnr, start_line, end_line, input)
    end)
  else
    M._execute(bufnr, start_line, end_line, instruction)
  end
end

--- Internal: execute the LLM replacement after instruction is known.
--- @param bufnr integer
--- @param start_line integer 1-indexed
--- @param end_line integer 1-indexed
--- @param instruction string
--- Detect the base indentation (leading whitespace of first non-empty selected line).
--- @param lines string[]
--- @return string
local function base_indent(lines)
  for _, line in ipairs(lines) do
    local indent = line:match("^(%s+)")
    if indent then return indent end
  end
  return ""
end

--- Re-indent output lines to match the selection's base indentation.
--- Detects the output's own common indent, strips it, and prepends the target indent.
--- @param lines string[]
--- @param target string the indentation to apply
--- @return string[]
local function reindent(lines, target)
  -- Find the minimum indentation across non-empty output lines
  local min_indent
  for _, line in ipairs(lines) do
    if line:match("%S") then
      local indent = line:match("^(%s*)") or ""
      if not min_indent or #indent < #min_indent then
        min_indent = indent
      end
    end
  end
  min_indent = min_indent or ""

  local result = {}
  for _, line in ipairs(lines) do
    if not line:match("%S") then
      result[#result + 1] = ""
    else
      result[#result + 1] = target .. line:sub(#min_indent + 1)
    end
  end
  return result
end

function M._execute(bufnr, start_line, end_line, instruction)
  if _job then
    vim.api.nvim_echo({ { "tau: request already in flight", "WarningMsg" } }, false, {})
    return
  end

  local ctx = context.get(bufnr, start_line, end_line)
  local indent = base_indent(ctx.selection.lines)

  -- Lock the buffer to prevent line number drift during async operation
  vim.bo[bufnr].modifiable = false

  -- Start UI: cmdline + spinner
  ui.start(bufnr, start_line, instruction)

  local accumulated = ""

  -- Pre-assign _job so callbacks always see a non-nil sentinel even if the
  -- process exits before vim.system returns on this tick. handle is filled in
  -- below after runner.run() returns.
  local prev_esc = vim.fn.maparg("<Esc>", "n", false, true)
  _job = { handle = nil, bufnr = bufnr, cancelled = false, prev_esc = prev_esc }

  local handle = runner.run({
    config = config,
    instruction = instruction,
    selection_text = ctx.selection.text,
    context_above = ctx.above,
    context_below = ctx.below,
    filepath = ctx.filepath,
    filetype = ctx.filetype,

    on_token = function(chunk)
      accumulated = accumulated .. chunk
    end,

    on_done = function()
      if not _job then return end
      if _job.cancelled then
        _cleanup(bufnr)
        return
      end
      _cleanup(bufnr)

      local ok, err = pcall(function()
        -- Strip markdown code fences the model may wrap output in
        local text = accumulated:gsub("^%s*```[%w]*%s*\n", ""):gsub("\n%s*```%s*$", "")
        -- Remove only trailing whitespace, preserve leading indentation
        text = text:gsub("%s+$", "")

        local new_lines = vim.split(text, "\n", { plain = true })
        new_lines = reindent(new_lines, indent)
        vim.api.nvim_buf_set_lines(bufnr, start_line - 1, end_line, false, new_lines)
      end)
      if not ok then
        vim.api.nvim_echo({ { "tau: " .. tostring(err), "ErrorMsg" } }, false, {})
      end
    end,

    on_error = function(msg)
      if not _job then return end
      local was_cancelled = _job.cancelled
      _cleanup(bufnr)

      if was_cancelled then return end

      local ok, err = pcall(function()
        ui.error(bufnr, start_line, msg)
      end)
      if not ok then
        pcall(function() vim.bo[bufnr].modifiable = true end)
        vim.api.nvim_echo({ { "tau: " .. tostring(err), "ErrorMsg" } }, false, {})
      end
    end,
  })

  _job.handle = handle

  vim.keymap.set("n", "<Esc>", function()
    require("tau").cancel()
  end, { buffer = bufnr, noremap = true, silent = true, desc = "tau: cancel request" })
end

--- Cancel the in-flight request, if any.
function M.cancel()
  if not _job then
    vim.api.nvim_echo({ { "tau: no request in flight", "Comment" } }, false, {})
    return
  end

  local j = _job
  j.cancelled = true          -- set before kill so the exit callback sees it
  if j.handle then
    j.handle:kill(SIGTERM)    -- process may exit 0 or non-zero; cancelled flag handles both
  end
  _cleanup(j.bufnr)           -- immediate UI teardown; don't wait for the callback

  vim.api.nvim_echo({ { "tau: cancelled", "Comment" } }, false, {})
end

return M
