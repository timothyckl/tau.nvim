-- Floating picker for selecting context files.
-- Shows open buffers + all files in cwd; toggles persist in context_files module.

local context_files = require("tau.context_files")

local M = {}

local _open = false

vim.api.nvim_set_hl(0, "TauContextCursorLine", { link = "CursorLine" })

local function add_candidate(candidates, seen, path)
  local abs = vim.fn.fnamemodify(path, ":p")
  if seen[abs] or vim.fn.isdirectory(abs) ~= 0 or vim.fn.filereadable(abs) == 0 then return end

  seen[abs] = true
  candidates[#candidates + 1] = { abs = abs, rel = vim.fn.fnamemodify(abs, ":~:.") }
end

--- List cwd files, respecting git ignore rules when cwd is inside a Git repo.
--- @return string[]
local function list_cwd_files()
  local cwd = vim.loop.cwd() or vim.fn.getcwd()

  if vim.fn.executable("git") == 1 then
    local files = vim.fn.systemlist({ "git", "-C", cwd, "ls-files", "--cached", "--others", "--exclude-standard", "--", "." })
    if vim.v.shell_error == 0 then
      return files
    end
  end

  -- Fallback for non-Git directories. This does not understand .gitignore.
  return vim.fn.glob("**/*", false, true)
end

--- Collect candidate file paths, deduplicated and sorted.
--- @return {abs: string, rel: string}[]
local function get_candidates()
  local seen = {}
  local candidates = {}

  -- Open buffers (listed, non-special)
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if vim.bo[buf].buflisted and vim.bo[buf].buftype == "" then
      local name = vim.api.nvim_buf_get_name(buf)
      if name ~= "" then
        add_candidate(candidates, seen, name)
      end
    end
  end

  -- Files in cwd. In Git repos this uses `git ls-files --exclude-standard`,
  -- so .gitignore/.git/info/exclude/global excludes are honored.
  for _, rel_path in ipairs(list_cwd_files()) do
    if rel_path ~= "" then
      add_candidate(candidates, seen, rel_path)
    end
  end

  table.sort(candidates, function(a, b) return a.abs < b.abs end)
  return candidates
end

--- Format a single candidate line for display.
--- @param abs_path string
--- @param rel_path string  pre-computed display path
--- @param current_file string|nil  always-included locked file
--- @return string
local function format_line(abs_path, rel_path, current_file)
  if abs_path == current_file then
    return "  ◎ " .. rel_path
  elseif context_files.contains_abs(abs_path) then
    return "  ● " .. rel_path
  else
    return "    " .. rel_path
  end
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

  -- rel paths are captured once at open; display labels become stale if cwd changes while picker is open
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

  -- Footer helpers (right side is constant; cache its display width)
  local footer_right       = " <Space> toggle · <Esc> close "
  local footer_right_width = vim.fn.strdisplaywidth(footer_right)

  local function build_footer(count)
    local left = count > 0 and (" " .. count .. " selected ") or ""
    local pad = width - vim.fn.strdisplaywidth(left) - footer_right_width
    if pad < 1 then pad = 1 end
    return left .. string.rep("─", pad) .. footer_right
  end

  -- Track selected count locally to avoid context_files.get() on every toggle
  local selected_count = 0
  for _, p in ipairs(context_files.get()) do
    if p ~= current_file then selected_count = selected_count + 1 end
  end

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
    footer     = build_footer(selected_count),
    footer_pos = "left",
    style     = "minimal",
    noautocmd = true,
  })
  vim.wo[win].cursorline = true
  vim.wo[win].winhighlight = "CursorLine:TauContextCursorLine"

  vim.cmd("stopinsert")

  -- Full render used only on initial draw
  local function render()
    local lines = {}
    for _, c in ipairs(candidates) do
      lines[#lines + 1] = format_line(c.abs, c.rel, current_file)
    end
    vim.bo[buf].modifiable = true
    vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
    vim.bo[buf].modifiable = false

    if vim.api.nvim_win_is_valid(win) then
      vim.api.nvim_win_set_config(win, { footer = build_footer(selected_count), footer_pos = "left" })
    end
  end

  render()

  local footer_update_pending = false
  local function schedule_footer_update()
    if footer_update_pending then return end
    footer_update_pending = true
    vim.schedule(function()
      footer_update_pending = false
      if vim.api.nvim_win_is_valid(win) then
        vim.api.nvim_win_set_config(win, { footer = build_footer(selected_count), footer_pos = "left" })
      end
    end)
  end

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
    local c = candidates[row]
    if not c or c.abs == current_file then return end

    local was_selected = context_files.contains_abs(c.abs)
    context_files.toggle_abs(c.abs)
    selected_count = selected_count + (was_selected and -1 or 1)

    -- Update only the toggled line
    vim.bo[buf].modifiable = true
    vim.api.nvim_buf_set_lines(buf, row - 1, row, false, { format_line(c.abs, c.rel, current_file) })
    vim.bo[buf].modifiable = false

    if vim.api.nvim_win_is_valid(win) then
      vim.api.nvim_win_set_cursor(win, { row, 0 })
    end

    -- Deferred so the line repaint is not blocked by the window re-layout.
    -- Coalesce bursts of toggles into one footer reconfiguration per event-loop tick.
    schedule_footer_update()
  end

  -- Keymaps
  local mo = { buffer = buf, noremap = true, silent = true }
  -- Space is commonly used as <Leader>; without nowait Neovim waits for
  -- timeoutlen to see if a longer <Space> mapping follows before toggling.
  local toggle_mo = { buffer = buf, noremap = true, silent = true, nowait = true }
  vim.keymap.set("n", "<Space>", toggle, toggle_mo)
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
