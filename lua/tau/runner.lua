local M = {}

local plugin_dir = vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":h:h:h")
local bin = plugin_dir .. "/cli/tau"

--- Spawn the tau CLI and stream its output.
--- @param opts table
---   - instruction string
---   - selection_text string
---   - context_above string
---   - context_below string
---   - filepath string
---   - filetype string
---   - context_files string[]?  absolute paths of session-scoped context files
---   - on_meta fun(meta: table)?  called with token estimation metadata
---   - on_token fun(chunk: string)
---   - on_done fun()
---   - on_error fun(msg: string)
---   - config table  (from setup())
function M.run(opts)
  local cfg = opts.config or {}

  -- Copy current environment and overlay plugin config
  local env = vim.fn.environ()
  if cfg.api_url then env.TAU_API_URL = cfg.api_url end
  if cfg.api_key then env.TAU_API_KEY = cfg.api_key end
  if cfg.model then env.TAU_MODEL = cfg.model end
  if cfg.debug then env.TAU_DEBUG = "1" end
  if cfg.timeout_ms then env.TAU_TIMEOUT_MS = tostring(cfg.timeout_ms) end
  if cfg.context_window then env.TAU_CONTEXT_WINDOW = tostring(cfg.context_window) end
  if cfg.temperature then env.TAU_TEMPERATURE = tostring(cfg.temperature) end
  if cfg.max_tokens then env.TAU_MAX_TOKENS = tostring(cfg.max_tokens) end
  if cfg.top_p then env.TAU_TOP_P = tostring(cfg.top_p) end

  local cmd = { bin, opts.instruction }

  if opts.context_above and opts.context_above ~= "" then
    vim.list_extend(cmd, { "--context-above", opts.context_above })
  end
  if opts.context_below and opts.context_below ~= "" then
    vim.list_extend(cmd, { "--context-below", opts.context_below })
  end
  if opts.filepath and opts.filepath ~= "" then
    vim.list_extend(cmd, { "--file", opts.filepath })
  end
  if opts.filetype and opts.filetype ~= "" then
    vim.list_extend(cmd, { "--filetype", opts.filetype })
  end
  if opts.context_files then
    for _, path in ipairs(opts.context_files) do
      vim.list_extend(cmd, { "--context-file", path })
    end
  end

  local stderr_buf = ""

  local handle = vim.system(cmd, {
    env = env,
    stdin = opts.selection_text,
    stdout = function(_, chunk)
      if chunk then
        opts.on_token(chunk)
      end
    end,
    stderr = function(_, chunk)
      if not chunk then return end
      stderr_buf = stderr_buf .. chunk
      -- Parse and consume complete TAU_META lines eagerly so the UI can show fill % during streaming
      stderr_buf = stderr_buf:gsub("([^\n]*)\n", function(line)
        local json_str = line:match("^TAU_META:(.+)$")
        if json_str and opts.on_meta then
          local ok, meta = pcall(vim.json.decode, json_str)
          if ok then
            vim.schedule(function() opts.on_meta(meta) end)
          end
        end
        return ""
      end)
    end,
  }, function(obj)
    vim.schedule(function()
      -- Strip TAU_META lines from stderr so they don't appear in error messages
      local remaining = {}
      for line in stderr_buf:gmatch("[^\n]+") do
        if not line:match("^TAU_META:") then
          table.insert(remaining, line)
        end
      end

      if obj.code == 0 then
        opts.on_done()
      else
        local err_msg = table.concat(remaining, "\n")
        local msg = err_msg ~= "" and err_msg or ("exit code " .. obj.code)
        opts.on_error(msg)
      end
    end)
  end)
  return handle
end

return M
