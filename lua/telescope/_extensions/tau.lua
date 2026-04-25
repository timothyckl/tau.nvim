return require("telescope").register_extension({
  exports = {
    instruction = require("tau.ui.telescope.instruction").telescope_picker,
  },
})
