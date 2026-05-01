local function fail(message)
  error(message, 2)
end

local function assert_equal(actual, expected, message)
  if not vim.deep_equal(actual, expected) then
    fail(string.format("%s\nexpected: %s\nactual:   %s", message or "values differ", vim.inspect(expected), vim.inspect(actual)))
  end
end

local function assert_truthy(value, message)
  if not value then
    fail(message or "expected truthy value")
  end
end

local function footer_text(win)
  local footer = vim.api.nvim_win_get_config(win).footer
  if type(footer) == "string" then return footer end
  if type(footer) ~= "table" then return "" end

  local parts = {}
  for _, item in ipairs(footer) do
    if type(item) == "table" then
      parts[#parts + 1] = tostring(item[1] or "")
    else
      parts[#parts + 1] = tostring(item)
    end
  end
  return table.concat(parts, "")
end

local function find_map(buf, lhs)
  for _, map in ipairs(vim.api.nvim_buf_get_keymap(buf, "n")) do
    if map.lhs == lhs then return map end
  end
  return nil
end

local start_dir = vim.loop.cwd()
local temp_dir = vim.fn.tempname()
vim.fn.mkdir(temp_dir, "p")
vim.fn.writefile({ "alpha" }, temp_dir .. "/a.txt")
vim.fn.writefile({ "bravo" }, temp_dir .. "/b.txt")

local ok, err = xpcall(function()
  vim.cmd("cd " .. vim.fn.fnameescape(temp_dir))

  local context_files = require("tau.context_files")
  context_files.clear()

  local current_file = vim.fn.fnamemodify("b.txt", ":p")
  require("tau.context_picker").open({ current_file = current_file })

  local win = vim.api.nvim_get_current_win()
  local buf = vim.api.nvim_get_current_buf()
  local a_file = vim.fn.fnamemodify("a.txt", ":p")

  local space_map = find_map(buf, " ")
  assert_truthy(space_map, "expected buffer-local <Space> mapping")
  assert_equal(space_map.nowait, 1, "expected <Space> mapping to bypass leader timeout")
  assert_equal(type(space_map.callback), "function", "expected <Space> mapping to use a Lua callback")

  assert_equal(vim.api.nvim_buf_get_lines(buf, 0, 2, false), {
    "    a.txt",
    "  ◎ b.txt",
  }, "expected initial picker lines")

  vim.api.nvim_win_set_cursor(win, { 1, 0 })
  space_map.callback()

  assert_truthy(context_files.contains_abs(a_file), "expected <Space> to add selected file to context")
  assert_equal(vim.api.nvim_buf_get_lines(buf, 0, 1, false)[1], "  ● a.txt", "expected toggled row to repaint immediately")
  assert_equal(vim.api.nvim_win_get_cursor(win), { 1, 0 }, "expected toggle to preserve cursor row")

  local footer_updated = vim.wait(1000, function()
    return footer_text(win):find("1 selected", 1, true) ~= nil
  end, 10)
  assert_truthy(footer_updated, "expected deferred footer update to show selected count")

  vim.api.nvim_win_set_cursor(win, { 2, 0 })
  space_map.callback()

  assert_truthy(not context_files.contains_abs(current_file), "expected locked current file not to be toggled into context")
  assert_equal(vim.api.nvim_buf_get_lines(buf, 1, 2, false)[1], "  ◎ b.txt", "expected locked current-file row to remain unchanged")
end, debug.traceback)

vim.cmd("cd " .. vim.fn.fnameescape(start_dir))
vim.fn.delete(temp_dir, "rf")

if not ok then
  error(err, 0)
end
