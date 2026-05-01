-- Floating picker for selecting context files.
-- Shows open buffers + all files in cwd; toggles persist in context_files module.

local context_files = require("tau.context_files")

local M = {}

local _open = false

vim.api.nvim_set_hl(0, "TauContextCursorLine", { link = "CursorLine" })

--- Collect candidate file paths (absolute), deduplicated and sorted.
--- @return string[]
local function get_candidates()
  local seen = {}
  local candidates = {}

  -- Open buffers (listed, non-special)
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if vim.bo[buf].buflisted and vim.bo[buf].buftype == "" then
      local name = vim.api.nvim_buf_get_name(buf)
      if name ~= "" then
        local abs = vim.fn.fnamemodify(name, ":p")
        if not seen[abs] then
          seen[abs] = true
          candidates[#candidates + 1] = abs
        end
      end
    end
  end

  -- All files in the working directory
  for _, rel in ipairs(vim.fn.glob("**/*", false, true)) do
    if vim.fn.isdirectory(rel) == 0 then
      local abs = vim.fn.fnamemodify(rel, ":p")
      if not seen[abs] then
        seen[abs] = true
        candidates[#candidates + 1] = abs
      end
    end
  end

  table.sort(candidates)
  return candidates
end

--- Format a single candidate line for display.
--- @param abs_path string
--- @param current_file string|nil  always-included locked file
--- @return string
local function format_line(abs_path, current_file)
  local rel = vim.fn.fnamemodify(abs_path, ":~:.")
  if abs_path == current_file then
    return "  ◎ " .. rel
  elseif context_files.contains(abs_path) then
    return "  ● " .. rel
  else
    return "    " .. rel
  end
end

--- Build the footer with selected count (left) and hints (right), padded with ─.
--- @param width integer  inner window width
--- @param current_file string|nil  excluded from the selected count (always sent as --file)
--- @return string
local function build_footer(width, current_file)
  local count = 0
  for _, p in ipairs(context_files.get()) do
    if p ~= current_file then count = count + 1 end
  end
  local left = count > 0 and (" " .. count .. " selected ") or ""
  local right = " <Space> toggle · <Esc> close "
  local pad = width - vim.fn.strdisplaywidth(left) - vim.fn.strdisplaywidth(right)
  if pad < 1 then pad = 1 end
  return left .. string.rep("─", pad) .. right
end

--- Open the context file picker.
--- @param opts? { on_close?: fun(), current_file?: string }
function M.open(opts)
  opts = opts or {}

  if _open then
    if opts.on_close then opts.on_close() end
    return
  end
  _open = true

  local current_file = opts.current_file

  local ok, candidates = pcall(get_candidates)
  if not ok or #candidates == 0 then
    _open = false
    if not ok then
      vim.api.nvim_echo({ { "tau: failed to list files", "WarningMsg" } }, false, {})
    else
      vim.api.nvim_echo({ { "tau: no candidate files found", "WarningMsg" } }, false, {})
    end
    if opts.on_close then opts.on_close() end
    return
  end

  -- Geometry
  local width = math.max(50, math.min(80, vim.o.columns - 6))
  local height = math.min(#candidates, math.max(10, vim.o.lines - 10))
  local start_row = math.floor((vim.o.lines - height - 2) / 2)
  local start_col = math.floor((vim.o.columns - width - 2) / 2)

  -- Buffer
  local buf = vim.api.nvim_create_buf(false, true)
  vim.bo[buf].bufhidden = "wipe"
  vim.bo[buf].buftype = "nofile"

  -- Window
  local win = vim.api.nvim_open_win(buf, true, {
    relative  = "editor",
    row       = start_row,
    col       = start_col,
    width     = width,
    height    = height,
    border    = "rounded",
    title     = " Context Files ",
    title_pos = "left",
    footer     = build_footer(width, current_file),
    footer_pos = "left",
    style     = "minimal",
    noautocmd = true,
  })
  vim.wo[win].cursorline = true
  vim.wo[win].winhighlight = "CursorLine:TauContextCursorLine"

  vim.cmd("stopinsert")

  -- Render candidate lines
  local function render()
    local lines = {}
    for _, abs in ipairs(candidates) do
      lines[#lines + 1] = format_line(abs, current_file)
    end
    vim.bo[buf].modifiable = true
    vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
    vim.bo[buf].modifiable = false

    -- Update footer with current selected count
    if vim.api.nvim_win_is_valid(win) then
      vim.api.nvim_win_set_config(win, { footer = build_footer(width, current_file), footer_pos = "left" })
    end
  end

  render()

  -- Close helpers
  local closed = false

  local function close()
    if closed then return end
    closed = true
    _open = false
    if vim.api.nvim_win_is_valid(win) then
      vim.api.nvim_win_close(win, true)
    end
    if opts.on_close then
      vim.schedule(opts.on_close)
    end
  end

  -- Toggle the file under cursor
  local function toggle()
    local row = vim.api.nvim_win_get_cursor(win)[1]
    local abs = candidates[row]
    if not abs or abs == current_file then return end
    context_files.toggle(abs)
    render()
    -- Restore cursor position
    if vim.api.nvim_win_is_valid(win) then
      vim.api.nvim_win_set_cursor(win, { row, 0 })
    end
  end

  -- Keymaps
  local mo = { buffer = buf, noremap = true, silent = true }
  vim.keymap.set("n", "<Space>", toggle, mo)
  vim.keymap.set("n", "<Esc>", close,  mo)
  vim.keymap.set("n", "q",     close,  mo)

  -- Close on WinLeave
  vim.api.nvim_create_autocmd("WinLeave", {
    buffer   = buf,
    once     = true,
    callback = function()
      vim.schedule(close)
    end,
  })
end

return M
