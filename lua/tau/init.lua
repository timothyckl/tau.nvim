local context = require("tau.context")
local runner = require("tau.runner")
local ui = require("tau.ui")
local history = require("tau.history")
local picker = require("tau.picker")

local M = {}

--- @type table
local config = {}

local SIGTERM  = 15
local NS_TRACK = vim.api.nvim_create_namespace("tau_track")

--- @type { handle: vim.SystemObj|nil, bufnr: integer, cancelled: boolean, prev_esc: table, mark_start: integer, mark_end: integer } | nil
local _job = nil

--- @type { bufnr: integer, start_line: integer, end_line: integer, new_lines: string[], instruction: string } | nil
local _pending = nil

--- True while a buf-attach listener is watching for in-region edits during pending review.
local _watching = false

--- True while the instruction picker is open, to prevent stacked invocations.
local _picking = false

--- Clear preview UI unconditionally — safe to call even if _job is nil.
local function _clear_pending()
  if not _pending then return end
  ui.clear_preview(_pending.bufnr)
  pcall(vim.keymap.del, "n", "<CR>", { buffer = _pending.bufnr })
  pcall(vim.keymap.del, "n", "r",    { buffer = _pending.bufnr })
  _pending = nil
end

--- Read current selection boundaries from tracking extmarks.
--- Returns nil, nil if _job is absent or buffer is invalid.
--- @param bufnr integer
--- @return integer|nil, integer|nil  1-indexed start_line, end_line
local function get_tracked_range(bufnr)
  if not _job then return nil, nil end
  if not vim.api.nvim_buf_is_valid(bufnr) then return nil, nil end
  local s = vim.api.nvim_buf_get_extmark_by_id(bufnr, NS_TRACK, _job.mark_start, {})
  local e = vim.api.nvim_buf_get_extmark_by_id(bufnr, NS_TRACK, _job.mark_end,   {})
  if not s or #s == 0 or not e or #e == 0 then return nil, nil end
  return s[1] + 1, e[1] + 1
end

--- Tear down all in-flight state: stop UI, restore <Esc> mapping, unlock buffer.
--- @param bufnr integer
local function _cleanup(bufnr)
  -- Clear preview before the _job guard so ghost extmarks are never left behind
  -- if _job has already been set to nil (e.g. double-accept or cancel race).
  _clear_pending()
  if not _job then return end
  ui.stop()
  pcall(vim.keymap.del, "n", "<Esc>", { buffer = bufnr })
  if _job.prev_esc and _job.prev_esc.lhs and _job.prev_esc.lhs ~= "" then
    if vim.api.nvim_buf_is_valid(bufnr) then
      -- prev_esc is captured before any <Esc> mapping is installed in _execute.
      -- Do not move that capture below any vim.keymap.set call or this restore breaks.
      vim.fn.mapset("n", false, _job.prev_esc)
    end
  end
  if vim.api.nvim_buf_is_valid(bufnr) then
    vim.api.nvim_buf_clear_namespace(bufnr, NS_TRACK, 0, -1)
  end
  _watching = false
  _job = nil
end

local function _accept()
  if not _pending then return end
  local p = _pending
  -- Read extmark positions BEFORE _cleanup() clears NS_TRACK
  local cur_start, cur_end = get_tracked_range(p.bufnr)
  local final_start = cur_start or p.start_line
  local final_end   = cur_end   or p.end_line
  -- _cleanup must precede nvim_buf_set_lines: it sets _watching = false so the
  -- buf-attach watcher ignores the programmatic write and does not emit a false cancel.
  _cleanup(p.bufnr)
  if not vim.api.nvim_buf_is_valid(p.bufnr) then
    vim.api.nvim_echo({ { "tau: buffer was closed, replacement lost", "ErrorMsg" } }, false, {})
    return
  end
  local ok, err = pcall(vim.api.nvim_buf_set_lines, p.bufnr, final_start - 1, final_end, false, p.new_lines)
  if not ok then
    vim.api.nvim_echo({ { "tau: failed to apply replacement: " .. tostring(err), "ErrorMsg" } }, false, {})
  end
end

local function _reject()
  if not _pending then return end
  _cleanup(_pending.bufnr)
end

local function _regen()
  if not _pending then return end
  local p = _pending
  local cur_start, cur_end = get_tracked_range(p.bufnr)
  local final_start = cur_start or p.start_line
  local final_end   = cur_end   or p.end_line
  _cleanup(p.bufnr)
  M._execute(p.bufnr, final_start, final_end, p.instruction)
end

--- Configure the plugin. Must be called before using :Tau.
--- @param opts table { api_url: string, api_key: string, model?: string, debug?: boolean, timeout_ms?: number }
function M.setup(opts)
  vim.validate({
    api_url    = { opts.api_url, "string" },
    api_key    = { opts.api_key, "string" },
    model      = { opts.model, "string", true },
    debug      = { opts.debug, "boolean", true },
    timeout_ms      = { opts.timeout_ms, "number", true },
    context_window  = { opts.context_window, "number", true },
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

  if _job or _picking then
    vim.api.nvim_echo({ { "tau: request already in flight — use :TauCancel first", "WarningMsg" } }, false, {})
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

  -- Get instruction: from command args or history picker
  local instruction = opts.args and opts.args ~= "" and opts.args or nil
  local hist = history.list()

  if instruction then
    M._execute(bufnr, start_line, end_line, instruction)
  else
    _picking = true
    picker.open(hist, "Instruction:", function(choice)
      _picking = false
      if not choice then return end
      M._execute(bufnr, start_line, end_line, choice)
    end)
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

  -- Place tracking extmarks to follow selection boundaries as user edits outside the region
  local mark_start = vim.api.nvim_buf_set_extmark(bufnr, NS_TRACK, start_line - 1, 0, {
    right_gravity = false,
  })
  local mark_end = vim.api.nvim_buf_set_extmark(bufnr, NS_TRACK, end_line - 1, 0, {
    right_gravity = true,
  })

  -- Start UI: spinner
  ui.start(bufnr, start_line)

  local accumulated = ""

  -- Pre-assign _job so callbacks always see a non-nil sentinel even if the
  -- process exits before vim.system returns on this tick. handle is filled in
  -- below after runner.run() returns.
  local prev_esc = vim.fn.maparg("<Esc>", "n", false, true)
  _job = { handle = nil, bufnr = bufnr, cancelled = false, prev_esc = prev_esc,
           mark_start = mark_start, mark_end = mark_end }

  local handle = runner.run({
    config = config,
    instruction = instruction,
    selection_text = ctx.selection.text,
    context_above = ctx.above,
    context_below = ctx.below,
    filepath = ctx.filepath,
    filetype = ctx.filetype,

    on_meta = function(meta)
      ui.update_meta(meta)
      if meta.warning then
        vim.api.nvim_echo({ { "tau: " .. meta.warning, "WarningMsg" } }, false, {})
      end
    end,

    on_token = function(chunk)
      accumulated = accumulated .. chunk
      vim.schedule(function()
        ui.update_progress(#accumulated)
      end)
    end,

    on_done = function()
      if not _job then return end
      if _job.cancelled then
        _cleanup(bufnr)
        return
      end

      history.add(instruction)

      -- Stop spinner; defer full cleanup until accept/reject
      ui.stop()

      local ok, err = pcall(function()
        -- Strip markdown code fences the model may wrap output in
        local text = accumulated:gsub("^%s*```[%w]*%s*\n", ""):gsub("\n%s*```%s*$", "")
        -- Remove only trailing whitespace, preserve leading indentation
        text = text:gsub("%s+$", "")

        local new_lines = reindent(vim.split(text, "\n", { plain = true }), indent)

        local cur_start, cur_end = get_tracked_range(bufnr)
        local final_start = cur_start or start_line
        local final_end   = cur_end   or end_line

        _pending = { bufnr = bufnr, start_line = final_start, end_line = final_end, new_lines = new_lines, instruction = instruction }

        -- Close over stable mark IDs so the callback has no dependency on _job,
        -- which may be nil if _cleanup races with a scheduled on_lines delivery.
        local watch_mark_start = _job.mark_start
        local watch_mark_end   = _job.mark_end
        _watching = vim.api.nvim_buf_attach(bufnr, false, {
          on_lines = function(_, _, _, firstline, lastline)
            if not _watching then return true end  -- detach
            local s = vim.api.nvim_buf_get_extmark_by_id(bufnr, NS_TRACK, watch_mark_start, {})
            local e = vim.api.nvim_buf_get_extmark_by_id(bufnr, NS_TRACK, watch_mark_end,   {})
            if not s or #s == 0 or not e or #e == 0 then return true end
            -- extmark rows are 0-indexed; convert to half-open [sel_start, sel_end) to match on_lines ranges
            local sel_start = s[1]
            local sel_end   = e[1] + 1  -- mark_end sits on last selected row; +1 makes upper bound exclusive
            -- [firstline, lastline) ∩ [sel_start, sel_end) ≠ ∅  ↔  firstline < sel_end and lastline > sel_start
            if firstline < sel_end and lastline > sel_start then
              vim.schedule(function()
                if not _pending then return end
                _cleanup(bufnr)
                vim.api.nvim_echo(
                  { { "tau: selection modified — review cancelled", "WarningMsg" } },
                  false, {}
                )
              end)
              return true  -- detach
            end
          end,
        })

        ui.show_preview(bufnr, final_start, final_end, new_lines, instruction)

        -- <Esc> now rejects instead of cancels; <CR> accepts
        vim.keymap.set("n", "<Esc>", _reject,
          { buffer = bufnr, noremap = true, silent = true, desc = "tau: reject replacement" })
        vim.keymap.set("n", "<CR>", _accept,
          { buffer = bufnr, noremap = true, silent = true, desc = "tau: accept replacement" })
        vim.keymap.set("n", "r", _regen,
          { buffer = bufnr, noremap = true, silent = true, desc = "tau: regen replacement" })
      end)
      if not ok then
        _cleanup(bufnr)
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
