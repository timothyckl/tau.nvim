local M = {}

local MAX_HISTORY = 50
local _history = {}

function M.add(instruction)
  if not instruction or instruction == "" then return end
  for i = #_history, 1, -1 do
    if _history[i] == instruction then table.remove(_history, i) end
  end
  table.insert(_history, 1, instruction)
  if #_history > MAX_HISTORY then table.remove(_history) end
end

function M.list()
  local copy = {}
  for i, v in ipairs(_history) do copy[i] = v end
  return copy
end

return M
