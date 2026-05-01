vim.api.nvim_create_user_command("Tau", function(opts)
  require("tau").run(opts)
end, { range = true, nargs = "?" })

vim.api.nvim_create_user_command("TauCancel", function()
  require("tau").cancel()
end, { desc = "Cancel the in-flight :Tau request" })

vim.api.nvim_create_user_command("TauContext", function()
  require("tau.context_picker").open()
end, { desc = "Open tau context file picker" })
