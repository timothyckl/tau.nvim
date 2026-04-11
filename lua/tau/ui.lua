local M = {}

local NS         = vim.api.nvim_create_namespace("tau")
local NS_PREVIEW = vim.api.nvim_create_namespace("tau_preview")
local NS_ERROR   = vim.api.nvim_create_namespace("tau_error")

local SPINNER_FRAMES         = { "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏" }
local ERROR_CLEAR_TIMEOUT_MS = 5000

local _timer      = nil
local _bufnr      = nil
local _char_count = 0
local _start_time = 0

--- Show instruction on cmdline and start spinner above start_line.
--- @param bufnr integer
--- @param start_line integer 1-indexed
--- @param instruction string
function M.start(bufnr, start_line, instruction)
  M.stop()
  vim.api.nvim_buf_clear_namespace(bufnr, NS, 0, -1)
  vim.api.nvim_buf_clear_namespace(bufnr, NS_ERROR, 0, -1)
  _char_count = 0
  _start_time = vim.uv.now()
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
      if not _timer then return end
      if not vim.api.nvim_buf_is_valid(bufnr) then
        M.stop()
        return
      end
      frame = (frame % #SPINNER_FRAMES) + 1
      local elapsed = math.floor((vim.uv.now() - _start_time) / 1000)
      local label = _char_count > 0
        and (SPINNER_FRAMES[frame] .. " tau · " .. _char_count .. " chars · " .. elapsed .. "s")
        or  (SPINNER_FRAMES[frame] .. " tau · " .. elapsed .. "s")
      local pos = vim.api.nvim_buf_get_extmark_by_id(bufnr, NS, mark_id, {})
      local row = (pos and #pos > 0) and pos[1] or (start_line - 1)
      vim.api.nvim_buf_set_extmark(bufnr, NS, row, 0, {
        id = mark_id,
        virt_lines = { { { label, "Comment" } } },
        virt_lines_above = true,
      })
    end)
  )
end

--- Update streaming char count. Called from on_token.
--- @param char_count integer
function M.update_progress(char_count)
  _char_count = char_count
end

--- Stop and clear all UI state.
function M.stop()
  if _timer then
    _timer:stop()
    _timer:close()
    _timer = nil
  end
  _char_count = 0
  _start_time = 0
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

  -- Compute width dynamically: "──<title>──" needs #title + 4;
  -- each content line needs #("+line"). Uses byte length (correct for ASCII).
  local title = " tau: " .. instruction .. " "
  local w = #title + 4
  for _, line in ipairs(new_lines) do
    w = math.max(w, #line + 1)  -- "+line"
  end

  local sep_top = "──" .. title .. string.rep("─", w - #title - 4) .. "──"
  local sep_mid = string.rep("─", w)

  local virt = { { { sep_top, "Comment" } } }

  for _, line in ipairs(new_lines) do
    table.insert(virt, { { "+", "DiffAdd" }, { line ~= "" and line or " ", "DiffAdd" } })
  end

  table.insert(virt, { { sep_mid, "Comment" } })

  -- Virtual block (header + proposed lines + separator) above the selection
  vim.api.nvim_buf_set_extmark(bufnr, NS_PREVIEW, start_line - 1, 0, {
    virt_lines       = virt,
    virt_lines_above = true,
  })

  -- Accept/reject hint as a virtual line below the selection
  vim.api.nvim_buf_set_extmark(bufnr, NS_PREVIEW, end_line - 1, 0, {
    virt_lines = {
      {
        { " ",          "Comment" },
        { "<CR>",       "Special" },
        { " accept · ", "Comment" },
        { "<Esc>",      "Special" },
        { " reject",    "Comment" },
      },
    },
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
  vim.api.nvim_buf_clear_namespace(bufnr, NS_ERROR, 0, -1)
  local id = vim.api.nvim_buf_set_extmark(bufnr, NS_ERROR, start_line - 1, 0, {
    virt_lines = { { { "✗ tau: " .. trimmed, "ErrorMsg" } } },
    virt_lines_above = true,
  })
  vim.api.nvim_echo({ { "tau: " .. trimmed, "ErrorMsg" } }, false, {})
  vim.defer_fn(function()
    if vim.api.nvim_buf_is_valid(bufnr) then
      vim.api.nvim_buf_del_extmark(bufnr, NS_ERROR, id)
    end
  end, ERROR_CLEAR_TIMEOUT_MS)
end

return M
