-- Native instruction picker — compact single-box layout.
-- NOTE: When the Telescope UI provider (#45) is implemented, it must replicate
-- this layout spec: title top-left, single-line input, inline history cycling,
-- and keybinding hints in the bottom-right border.

local M = {}

local _aug_id = 0

--- @param history string[]  ordered newest-first
--- @param on_choice fun(choice: string|nil)
--- @param opts? { context_key?: string }
function M.open(history, on_choice, opts)
  local context_key = opts and opts.context_key or "<leader>tc"
  local closed = false
  local cycling = false
  local context_open = false

  _aug_id = _aug_id + 1
  local aug_name = "tau_picker_" .. _aug_id

  -- Geometry
  local width     = math.max(40, math.min(70, vim.o.columns - 6))
  local height    = 1
  local start_row = math.floor((vim.o.lines - height - 2) / 2)
  local start_col = math.floor((vim.o.columns - width - 2) / 2)

  -- Buffer
  local buf = vim.api.nvim_create_buf(false, true)
  vim.bo[buf].bufhidden = "wipe"
  vim.bo[buf].buftype   = "nofile"

  -- Window
  local footer = " ⇅ reuse "
  local win = vim.api.nvim_open_win(buf, true, {
    relative  = "editor",
    row       = start_row,
    col       = start_col,
    width     = width,
    height    = height,
    border    = "rounded",
    title     = " Instruction ",
    title_pos = "left",
    footer     = footer,
    footer_pos = "right",
    style     = "minimal",
    noautocmd = true,
  })

  -- History cycling state
  local hist_index  = 0
  local saved_input = ""

  local function get_input()
    return vim.api.nvim_buf_get_lines(buf, 0, 1, false)[1] or ""
  end

  local function set_input(text)
    cycling = true
    vim.api.nvim_buf_set_lines(buf, 0, 1, false, { text })
    vim.api.nvim_win_set_cursor(win, { 1, #text })
    cycling = false
  end

  local function hist_prev()
    if #history == 0 then return end
    if hist_index == 0 then
      saved_input = get_input()
    end
    hist_index = math.min(hist_index + 1, #history)
    set_input(history[hist_index])
  end

  local function hist_next()
    if hist_index == 0 then return end
    hist_index = math.max(hist_index - 1, 0)
    if hist_index == 0 then
      set_input(saved_input)
    else
      set_input(history[hist_index])
    end
  end

  -- Close / confirm / cancel
  local function close()
    if closed then return end
    closed = true
    vim.cmd("stopinsert")
    pcall(vim.api.nvim_del_augroup_by_name, aug_name)
    if vim.api.nvim_win_is_valid(win) then
      vim.api.nvim_win_close(win, true)
    end
  end

  local function cancel()
    close()
    vim.schedule(function() on_choice(nil) end)
  end

  local function confirm()
    local text = get_input()
    if not text or text == "" then return end
    close()
    vim.schedule(function() on_choice(text) end)
  end

  -- Keymaps
  local mo = { buffer = buf, noremap = true, silent = true }

  vim.keymap.set("i", "<CR>",   confirm,   mo)
  vim.keymap.set("i", "<Esc>",  cancel,    mo)
  vim.keymap.set("i", "<Up>",   hist_prev, mo)
  vim.keymap.set("i", "<Down>", hist_next, mo)

  vim.keymap.set("n", "<CR>",  confirm,   mo)
  vim.keymap.set("n", "<Esc>", cancel,    mo)
  vim.keymap.set("n", "q",     cancel,    mo)
  vim.keymap.set("n", "k",     hist_prev, mo)
  vim.keymap.set("n", "j",     hist_next, mo)

  local function open_context()
    context_open = true
    require("tau.context_picker").open({
      on_close = function()
        context_open = false
        if not closed and vim.api.nvim_win_is_valid(win) then
          vim.api.nvim_set_current_win(win)
          vim.cmd("startinsert")
        end
      end,
    })
  end
  vim.keymap.set("i", context_key, open_context, mo)
  vim.keymap.set("n", context_key, open_context, mo)

  -- Autocmds
  local aug = vim.api.nvim_create_augroup(aug_name, { clear = true })

  -- Collapse to single line if user inserts a newline, and reset history index on manual edits
  vim.api.nvim_create_autocmd({ "TextChangedI", "TextChanged" }, {
    buffer   = buf,
    group    = aug,
    callback = function()
      local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
      if #lines > 1 then
        local input = table.concat(lines, "")
        cycling = true
        vim.api.nvim_buf_set_lines(buf, 0, -1, false, { input })
        vim.api.nvim_win_set_cursor(win, { 1, #input })
        cycling = false
      end
      if not cycling then
        hist_index = 0
      end
    end,
  })

  -- Cancel if focus leaves the picker window
  vim.api.nvim_create_autocmd("WinLeave", {
    group    = aug,
    callback = function()
      vim.schedule(function()
        if closed then return end
        local cur = vim.api.nvim_get_current_win()
        if cur ~= win and not context_open then cancel() end
      end)
    end,
  })

  vim.cmd("startinsert")
end

return M
