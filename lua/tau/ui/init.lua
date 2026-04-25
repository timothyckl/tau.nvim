local M = {}

local _provider = nil

--- Resolve the picker provider, cache the result.
--- @param ui_config table
--- @return table provider module with .open(history, on_choice, opts)
local function resolve(ui_config)
  if _provider then return _provider end

  local requested = ui_config.provider or "native"

  if requested == "telescope" then
    local has_telescope = pcall(require, "telescope")
    if has_telescope then
      _provider = require("tau.ui.telescope.instruction")
    else
      vim.notify("tau: telescope not found, falling back to native picker", vim.log.levels.WARN)
      _provider = require("tau.ui.native.picker")
    end
  else
    _provider = require("tau.ui.native.picker")
  end

  return _provider
end

--- Clear cached provider (called on re-setup).
function M.reset()
  _provider = nil
end

--- Pick an instruction string.
--- @param history string[]
--- @param on_choice fun(choice: string|nil)
--- @param opts table { context_key: string, ui_config: table }
function M.pick_instruction(history, on_choice, opts)
  local provider = resolve(opts.ui_config)
  provider.open(history, on_choice, opts)
end

return M
