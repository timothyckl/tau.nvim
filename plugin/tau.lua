vim.api.nvim_create_user_command("Tau", function(opts)
  require("tau").run(opts)
end, { range = true, nargs = "?" })
