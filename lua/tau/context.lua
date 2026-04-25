local M = {}

local CONTEXT_LINES = 30

--- Get full-line selection from the buffer.
--- Columns are intentionally discarded — selection is always treated as full lines.
--- @param bufnr integer
--- @param start_line integer 1-indexed
--- @param end_line integer 1-indexed, inclusive
--- @return string[] lines
function M.get_selection(bufnr, start_line, end_line)
  -- nvim_buf_get_lines is 0-indexed, end is exclusive
  return vim.api.nvim_buf_get_lines(bufnr, start_line - 1, end_line, false)
end

--- Get N lines above and below the selection.
--- @param bufnr integer
--- @param start_line integer 1-indexed
--- @param end_line integer 1-indexed
--- @param context_lines? integer override for number of surrounding lines (default 30)
--- @return string above, string below
function M.get_surrounding(bufnr, start_line, end_line, context_lines)
  context_lines = context_lines or CONTEXT_LINES
  local line_count = vim.api.nvim_buf_line_count(bufnr)

  local above_start = math.max(1, start_line - context_lines)
  local above_lines = vim.api.nvim_buf_get_lines(bufnr, above_start - 1, start_line - 1, false)

  local below_end = math.min(line_count, end_line + context_lines)
  local below_lines = vim.api.nvim_buf_get_lines(bufnr, end_line, below_end, false)

  return table.concat(above_lines, "\n"), table.concat(below_lines, "\n")
end

--- Build full context table for a given selection range.
--- @param bufnr integer
--- @param start_line integer 1-indexed (from opts.line1 or mark)
--- @param end_line integer 1-indexed (from opts.line2 or mark)
--- @param context_lines? integer override for number of surrounding lines (default 30)
--- @return table
function M.get(bufnr, start_line, end_line, context_lines)
  local selection_lines = M.get_selection(bufnr, start_line, end_line)
  local above, below = M.get_surrounding(bufnr, start_line, end_line, context_lines)

  return {
    selection = {
      lines = selection_lines,
      text = table.concat(selection_lines, "\n"),
      start_line = start_line,
      end_line = end_line,
    },
    above = above,
    below = below,
    filepath = vim.api.nvim_buf_get_name(bufnr),
    filetype = vim.bo[bufnr].filetype,
  }
end

return M
