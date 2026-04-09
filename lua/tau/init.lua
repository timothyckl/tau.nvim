local context = require("tau.context")
local runner = require("tau.runner")
local ui = require("tau.ui")

local M = {}

--- @type table
local config = {}

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
  local ctx = context.get(bufnr, start_line, end_line)
  local indent = base_indent(ctx.selection.lines)

  -- Lock the buffer to prevent line number drift during async operation
  vim.bo[bufnr].modifiable = false

  -- Start UI: cmdline + spinner
  ui.start(bufnr, start_line, instruction)

  local accumulated = ""

  runner.run({
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
      ui.stop()
      vim.bo[bufnr].modifiable = true

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
      local ok, err = pcall(function()
        ui.stop()
        vim.bo[bufnr].modifiable = true
        ui.error(bufnr, start_line, msg)
      end)
      if not ok then
        pcall(function() vim.bo[bufnr].modifiable = true end)
        vim.api.nvim_echo({ { "tau: " .. tostring(err), "ErrorMsg" } }, false, {})
      end
    end,
  })
end

return M
