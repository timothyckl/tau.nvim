local M = {}

local NS         = vim.api.nvim_create_namespace("tau")
local NS_PREVIEW = vim.api.nvim_create_namespace("tau_preview")
local SPINNER_FRAMES = { "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏" }

-- Minimum box width: cell-width of the bottom hint with no extra padding dashes.
-- "╰── "(4) + "<CR>"(4) + " accept · "(10) + "<Esc>"(5) + " reject ──╯"(11) = 34
local HINT_MIN_W = 34

local _timer = nil
local _bufnr = nil

--- Show instruction on cmdline and start spinner above start_line.
--- @param bufnr integer
--- @param start_line integer 1-indexed
--- @param instruction string
function M.start(bufnr, start_line, instruction)
  M.stop()
  vim.api.nvim_buf_clear_namespace(bufnr, NS, 0, -1)
  _bufnr = bufnr
  vim.api.nvim_echo({ { "Instruction: " .. instruction } }, false, {})

  local frame = 1

  -- Place initial extmark above the selection's first line
  local mark_id = vim.api.nvim_buf_set_extmark(bufnr, NS, start_line - 1, 0, {
    virt_lines = { { { SPINNER_FRAMES[frame] .. " tau", "Comment" } } },
    virt_lines_above = true,
  })

  _timer = vim.uv.new_timer()
  _timer:start(
    100,
    100,
    vim.schedule_wrap(function()
      if not vim.api.nvim_buf_is_valid(bufnr) then
        M.stop()
        return
      end
      frame = (frame % #SPINNER_FRAMES) + 1
      vim.api.nvim_buf_set_extmark(bufnr, NS, start_line - 1, 0, {
        id = mark_id,
        virt_lines = { { { SPINNER_FRAMES[frame] .. " tau", "Comment" } } },
        virt_lines_above = true,
      })
    end)
  )
end

--- Stop and clear all UI state.
function M.stop()
  if _timer then
    _timer:stop()
    _timer:close()
    _timer = nil
  end
  if _bufnr and vim.api.nvim_buf_is_valid(_bufnr) then
    vim.api.nvim_buf_clear_namespace(_bufnr, NS, 0, -1)
  end
  _bufnr = nil
end

--- Show inline diff: a virtual block above the selection (header + prompt + new lines + separator),
--- with the original buffer lines highlighted as deleted beneath it.
--- @param bufnr integer
--- @param start_line integer 1-indexed
--- @param end_line integer 1-indexed
--- @param new_lines string[]
--- @param instruction string
function M.show_preview(bufnr, start_line, end_line, new_lines, instruction)
  -- Per-line extmarks for original (deleted) lines
  for i = start_line - 1, end_line - 1 do
    vim.api.nvim_buf_set_extmark(bufnr, NS_PREVIEW, i, 0, {
      line_hl_group = "DiffDelete",
      virt_text     = { { "-", "DiffDelete" } },
      virt_text_pos = "inline",
    })
  end

  -- Compute box width from content (uses byte length, correct for ASCII).
  -- Top needs: "╭─" + title + at_least_one_"─" + "╮" → min w = #title + 4
  local title = " tau: " .. instruction .. " "
  local w = math.max(HINT_MIN_W, #title + 4)
  for _, line in ipairs(new_lines) do
    w = math.max(w, #line + 1 + 2)  -- "+line" between "│" borders
  end

  local inner_w = w - 2  -- cell width between the │ borders

  -- Top border: ╭─<title>──...──╮
  local sep_top = "╭─" .. title .. string.rep("─", w - 3 - #title) .. "╮"

  local virt = { { { sep_top, "Comment" } } }

  -- Content rows: │+line<pad>│
  for _, line in ipairs(new_lines) do
    local content = "+" .. (line ~= "" and line or " ")
    table.insert(virt, {
      { "│",                                             "Comment" },
      { content .. string.rep(" ", inner_w - #content), "DiffAdd" },
      { "│",                                             "Comment" },
    })
  end

  -- Bottom border: ╰── <CR> accept · <Esc> reject ──...──╯
  table.insert(virt, {
    { "╰── ",                                        "Comment" },
    { "<CR>",                                         "Special" },
    { " accept · ",                                   "Comment" },
    { "<Esc>",                                        "Special" },
    { " reject " .. string.rep("─", w - HINT_MIN_W) .. "──╯", "Comment" },
  })

  vim.api.nvim_buf_set_extmark(bufnr, NS_PREVIEW, start_line - 1, 0, {
    virt_lines       = virt,
    virt_lines_above = true,
  })
end

--- Clear all preview highlights and virtual lines.
--- @param bufnr integer
function M.clear_preview(bufnr)
  vim.api.nvim_buf_clear_namespace(bufnr, NS_PREVIEW, 0, -1)
end

--- Show an error as virtual text above the selection and on the cmdline.
--- @param bufnr integer
--- @param start_line integer 1-indexed
--- @param msg string
function M.error(bufnr, start_line, msg)
  local trimmed = vim.trim(msg)
  vim.api.nvim_buf_set_extmark(bufnr, NS, start_line - 1, 0, {
    virt_lines = { { { "✗ tau: " .. trimmed, "ErrorMsg" } } },
    virt_lines_above = true,
  })
  vim.api.nvim_echo({ { "tau: " .. trimmed, "ErrorMsg" } }, false, {})
end

return M
