local M = {}

--- Open instruction picker via Telescope.
--- @param history string[]  ordered newest-first
--- @param on_choice fun(choice: string|nil)
--- @param opts? table { ui_config?: table }
function M.open(history, on_choice, opts)
  local pickers      = require("telescope.pickers")
  local finders      = require("telescope.finders")
  local conf         = require("telescope.config").values
  local actions      = require("telescope.actions")
  local action_state = require("telescope.actions.state")

  local ui_config = opts and opts.ui_config or {}
  local tel_opts = (ui_config.telescope and ui_config.telescope.instruction_picker) or {}

  local theme_name = tel_opts.theme
  local stripped = vim.tbl_extend("force", tel_opts, {})
  stripped.theme = nil
  local theme_fn = theme_name and require("telescope.themes")["get_" .. theme_name]
  local picker_opts = theme_fn and theme_fn(stripped) or stripped

  local function cancel(prompt_bufnr)
    actions.close(prompt_bufnr)
    vim.schedule(function() on_choice(nil) end)
  end

  pickers.new(picker_opts, {
    prompt_title = "Instruction",
    finder = finders.new_table({ results = history }),
    sorter = conf.generic_sorter(picker_opts),
    attach_mappings = function(prompt_bufnr, map)
      actions.select_default:replace(function()
        local selection = action_state.get_selected_entry()
        local input = action_state.get_current_line()
        actions.close(prompt_bufnr)

        local choice = (input and input ~= "") and input or (selection and selection[1])
        if choice and choice ~= "" then
          vim.schedule(function() on_choice(choice) end)
        else
          vim.schedule(function() on_choice(nil) end)
        end
      end)

      map("i", "<Esc>", function() cancel(prompt_bufnr) end)
      map("n", "<Esc>", function() cancel(prompt_bufnr) end)

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
