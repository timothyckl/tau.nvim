local M = {}

local NS = vim.api.nvim_create_namespace("tau_picker")
local _aug_id = 0  -- counter for unique augroup names

--- @param items string[]
--- @param prompt string
--- @param on_choice fun(choice: string|nil)
function M.open(items, prompt, on_choice)
  local sel = 1
  local filtered = {}
  local closed = false

  -- Unique augroup name per invocation to prevent collision
  _aug_id = _aug_id + 1
  local aug_name = "tau_picker_" .. _aug_id

  -- fixed at open time so the window does not resize on every keystroke
  local width     = math.max(40, math.min(70, vim.o.columns - 6))
  local max_rows  = math.min(10, #items)
  local start_row = math.floor((vim.o.lines - (max_rows + 5)) / 2)
  local start_col = math.floor((vim.o.columns - width - 2) / 2)

  -- Buffers
  local input_buf   = vim.api.nvim_create_buf(false, true)
  local results_buf = vim.api.nvim_create_buf(false, true)
  vim.bo[input_buf].bufhidden    = "wipe"
  vim.bo[results_buf].bufhidden  = "wipe"
  vim.bo[results_buf].modifiable = false

  -- Windows
  local input_win = vim.api.nvim_open_win(input_buf, true, {
    relative  = "editor",
    row       = start_row,
    col       = start_col,
    width     = width,
    height    = 1,
    border    = "rounded",
    title     = " " .. prompt .. " ",
    title_pos = "center",
    style     = "minimal",
    noautocmd = true,
  })

  local results_win = vim.api.nvim_open_win(results_buf, false, {
    relative  = "editor",
    row       = start_row + 3,  -- input content(1) + top border(1) + bottom border(1)
    col       = start_col,
    width     = width,
    height    = max_rows,
    border    = "rounded",
    title     = " History ",
    title_pos = "center",
    style     = "minimal",
    noautocmd = true,
  })
  vim.wo[results_win].wrap       = false
  vim.wo[results_win].cursorline = false

  local function refilter()
    local query = (vim.api.nvim_buf_get_lines(input_buf, 0, 1, false)[1] or ""):lower()
    filtered = {}
    for _, item in ipairs(items) do
      if query == "" or item:lower():find(query, 1, true) then
        filtered[#filtered + 1] = item
      end
    end
    sel = 1  -- reset selection on every refilter (text changed or initial open)
  end

  local function render()
    vim.bo[results_buf].modifiable = true
    local lines = {}
    for i, item in ipairs(filtered) do
      local prefix = i == sel and "→ " or "  "
      lines[#lines + 1] = (prefix .. item):sub(1, width)
    end
    while #lines < max_rows do
      lines[#lines + 1] = ""
    end
    vim.api.nvim_buf_set_lines(results_buf, 0, -1, false, lines)
    vim.bo[results_buf].modifiable = false

    vim.api.nvim_buf_clear_namespace(results_buf, NS, 0, -1)
    if #filtered > 0 then
      vim.api.nvim_buf_add_highlight(results_buf, NS, "Visual", sel - 1, 0, -1)
    end

    vim.api.nvim_win_set_config(results_win, {
      footer     = " " .. #filtered .. "/" .. #items .. " ",
      footer_pos = "right",
    })
  end

  local function close()
    if closed then return end
    closed = true
    vim.cmd("stopinsert")
    pcall(vim.api.nvim_del_augroup_by_name, aug_name)
    if vim.api.nvim_win_is_valid(results_win) then
      vim.api.nvim_win_close(results_win, true)
    end
    if vim.api.nvim_win_is_valid(input_win) then
      vim.api.nvim_win_close(input_win, true)
    end
  end

  -- forward-declare so confirm() can reference cancel() safely
  local cancel

  local function confirm()
    local choice
    if #filtered > 0 then
      choice = filtered[sel]
    else
      choice = vim.api.nvim_buf_get_lines(input_buf, 0, 1, false)[1]
      if not choice or choice == "" then
        cancel()
        return
      end
    end
    close()
    vim.schedule(function() on_choice(choice) end)
  end

  cancel = function()
    close()
    vim.schedule(function() on_choice(nil) end)
  end

  -- Keymaps — input window
  local imo = { buffer = input_buf, noremap = true, silent = true }
  vim.keymap.set("i", "<CR>",   confirm, imo)
  vim.keymap.set("i", "<Esc>",  cancel,  imo)
  vim.keymap.set("i", "<Up>",   function()
    sel = math.max(sel - 1, 1); render()
  end, imo)
  vim.keymap.set("i", "<Down>", function()
    sel = math.min(sel + 1, math.max(1, #filtered)); render()
  end, imo)
  vim.keymap.set("n", "<Esc>",  cancel, imo)
  vim.keymap.set("n", "q",      cancel, imo)

  -- Keymaps — results window (nowait to override any global j/k mappings)
  local rmo = { buffer = results_buf, noremap = true, silent = true, nowait = true }
  vim.keymap.set("n", "<CR>",  confirm, rmo)
  vim.keymap.set("n", "<Esc>", cancel,  rmo)
  vim.keymap.set("n", "q",     cancel,  rmo)
  vim.keymap.set("n", "j", function()
    sel = math.min(sel + 1, math.max(1, #filtered)); render()
  end, rmo)
  vim.keymap.set("n", "k", function()
    sel = math.max(sel - 1, 1); render()
  end, rmo)

  -- Autocmds
  local aug = vim.api.nvim_create_augroup(aug_name, { clear = true })

  vim.api.nvim_create_autocmd({ "TextChangedI", "TextChanged" }, {
    buffer   = input_buf,
    group    = aug,
    callback = function() refilter(); render() end,
  })

  -- Cancel if focus moves outside both picker windows
  vim.api.nvim_create_autocmd("WinLeave", {
    group    = aug,
    callback = function()
      vim.schedule(function()
        if closed then return end
        local cur = vim.api.nvim_get_current_win()
        if cur ~= input_win and cur ~= results_win then
          cancel()
        end
      end)
    end,
  })

  refilter()
  render()
  vim.cmd("startinsert")
end

return M
