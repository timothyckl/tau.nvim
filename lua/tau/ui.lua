local M = {}

local NS = vim.api.nvim_create_namespace("tau")
local SPINNER_FRAMES = { "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏" }

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
