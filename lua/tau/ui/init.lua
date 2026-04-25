local M = {}

local _provider = nil
local _ui_config = nil

--- Resolve the picker provider, cache the result.
--- @return table provider module with .open(history, on_choice, opts)
local function resolve()
  if _provider then return _provider end

  local requested = (_ui_config and _ui_config.provider) or "native"

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

--- Store config and clear cached provider (called from setup).
--- @param ui_config table
function M.reset(ui_config)
  _provider = nil
  _ui_config = ui_config
end

--- Pick an instruction string.
--- @param history string[]
--- @param on_choice fun(choice: string|nil)
--- @param opts table { context_key: string, ui_config: table }
function M.pick_instruction(history, on_choice, opts)
  local provider = resolve()
  provider.open(history, on_choice, opts)
end

return M
