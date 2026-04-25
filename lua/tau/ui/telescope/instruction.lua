local M = {}

--- Open instruction picker via Telescope — mirrors the native compact single-box layout.
--- Single-line prompt with inline history cycling, no visible results list.
--- @param history string[]  ordered newest-first
--- @param on_choice fun(choice: string|nil)
--- @param opts? table { context_key?: string, ui_config?: table }
function M.open(history, on_choice, opts)
  local pickers      = require("telescope.pickers")
  local finders      = require("telescope.finders")
  local sorters      = require("telescope.sorters")
  local actions      = require("telescope.actions")
  local action_state = require("telescope.actions.state")

  local context_key = opts and opts.context_key or "<leader>tc"
  local ui_config = opts and opts.ui_config or {}
  local tel_opts = (ui_config.telescope and ui_config.telescope.instruction_picker) or {}

  local theme_name = tel_opts.theme
  -- shallow copy then remove theme key (vim.tbl_extend does not remove keys via nil)
  local stripped = vim.tbl_extend("force", tel_opts, {})
  stripped.theme = nil

  local base_opts = vim.tbl_deep_extend("force", {
    layout_strategy = "center",
    layout_config = {
      width = function(_, max_cols)
        return math.max(40, math.min(70, max_cols - 6))
      end,
      height = 1,
      preview_cutoff = 999,
    },
    prompt_prefix = "",
    results_title = false,
    sorting_strategy = "ascending",
    borderchars = {
      prompt  = { "─", "│", "─", "│", "╭", "╮", "╯", "╰" },
      results = { " ", " ", " ", " ", " ", " ", " ", " " },
    },
  }, stripped)

  local theme_fn = theme_name and require("telescope.themes")["get_" .. theme_name]
  local picker_opts = theme_fn and theme_fn(base_opts) or base_opts

  -- History cycling state ��� cycling_gen guards against async TextChanged resets
  local hist_index = 0
  local saved_input = ""
  local cycling_gen = 0
  local closed = false

  pickers.new(picker_opts, {
    prompt_title = "Instruction",
    finder = finders.new_table({ results = {} }),
    sorter = sorters.empty(),
    attach_mappings = function(prompt_bufnr, map)

      local function set_prompt(text)
        local picker = action_state.get_current_picker(prompt_bufnr)
        if not picker then return end
        local gen = cycling_gen + 1
        cycling_gen = gen
        picker:set_prompt(text)
        vim.schedule(function()
          if cycling_gen == gen then cycling_gen = 0 end
        end)
      end

      local function hist_prev()
        if #history == 0 then return end
        if hist_index == 0 then
          saved_input = action_state.get_current_line()
        end
        hist_index = math.min(hist_index + 1, #history)
        set_prompt(history[hist_index])
      end

      local function hist_next()
        if hist_index == 0 then return end
        hist_index = math.max(hist_index - 1, 0)
        if hist_index == 0 then
          set_prompt(saved_input)
        else
          set_prompt(history[hist_index])
        end
      end

      local function confirm()
        local text = action_state.get_current_line()
        text = text and vim.trim(text) or ""
        if text == "" then return end
        closed = true
        actions.close(prompt_bufnr)
        vim.schedule(function() on_choice(text) end)
      end

      local function cancel()
        if closed then return end
        closed = true
        actions.close(prompt_bufnr)
        vim.schedule(function() on_choice(nil) end)
      end

      local function open_context()
        if vim.fn.exists(":TauContext") == 0 then
          vim.api.nvim_echo({ { "tau: context management not yet implemented", "WarningMsg" } }, false, {})
          return
        end
        vim.cmd("TauContext")
      end

      local aug = vim.api.nvim_create_augroup("tau_telescope_picker_" .. prompt_bufnr, { clear = true })

      -- Reset history index on manual edits
      vim.api.nvim_create_autocmd({ "TextChangedI", "TextChanged" }, {
        buffer = prompt_bufnr,
        group  = aug,
        callback = function()
          if cycling_gen == 0 then
            hist_index = 0
          end
        end,
      })

      -- Cancel if buffer is closed without confirm (e.g. :q, <C-w>q)
      vim.api.nvim_create_autocmd({ "BufWipeout", "BufUnload" }, {
        buffer   = prompt_bufnr,
        group    = aug,
        once     = true,
        callback = function()
          vim.schedule(function() cancel() end)
        end,
      })

      -- Confirm / cancel
      map("i", "<CR>", confirm)
      map("n", "<CR>", confirm)
      map("i", "<Esc>", cancel)
      map("n", "<Esc>", cancel)
      map("n", "q", cancel)

      -- History cycling
      map("i", "<Up>", hist_prev)
      map("i", "<Down>", hist_next)
      map("n", "k", hist_prev)
      map("n", "j", hist_next)

      -- Context key (normal mode only — leader sequences are unreliable in Telescope insert mode)
      map("n", context_key, open_context)

      return true
    end,
  }):find()
end

--- Entry point for :Telescope tau instruction.
--- @param opts? table  telescope opts
function M.telescope_picker(opts)
  local history = require("tau.history").list()
  M.open(history, function(choice)
    if choice then
      vim.api.nvim_cmd({ cmd = "Tau", args = { choice } }, {})
    end
  end, { ui_config = { telescope = { instruction_picker = opts or {} } } })
end

return M
