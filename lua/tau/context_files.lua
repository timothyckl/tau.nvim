-- Session-scoped context file state.
-- Selected files persist across :Tau calls but clear when Neovim exits.

local M = {}

--- @type table<string, true>
local _files = {}

--- Normalize a path to absolute form.
--- @param path string
--- @return string
local function normalize(path)
  return vim.fn.fnamemodify(path, ":p")
end

--- Add a file to the context set.
--- @param path string
function M.add(path)
  _files[normalize(path)] = true
end

--- Remove a file from the context set.
--- @param path string
function M.remove(path)
  _files[normalize(path)] = nil
end

--- Toggle a file in/out of the context set.
--- @param path string
function M.toggle(path)
  local abs = normalize(path)
  if _files[abs] then
    _files[abs] = nil
  else
    _files[abs] = true
  end
end

--- Return sorted list of absolute paths currently in context.
--- @return string[]
function M.get()
  local paths = vim.tbl_keys(_files)
  table.sort(paths)
  return paths
end

--- Check if a file is in the context set.
--- @param path string
--- @return boolean
function M.contains(path)
  return _files[normalize(path)] ~= nil
end

--- Check if an already-normalized absolute path is in the context set.
--- @param abs string  must be a normalized absolute path
--- @return boolean
function M.contains_abs(abs)
  return _files[abs] ~= nil
end

--- Toggle an already-normalized absolute path in/out of the context set.
--- @param abs string  must be a normalized absolute path
function M.toggle_abs(abs)
  if _files[abs] then
    _files[abs] = nil
  else
    _files[abs] = true
  end
end

--- Clear all context files.
function M.clear()
  _files = {}
end

return M
