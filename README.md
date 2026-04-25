# tau.nvim

The simplest way to do inline code edits with an LLM in Neovim.

## Requirements

- Neovim 0.10+
- [Bun](https://bun.sh)
- An OpenAI-compatible API endpoint

## Installation

Using [lazy.nvim](https://github.com/folke/lazy.nvim):

```lua
{
  "timothyckl/tau.nvim",
  lazy = false,
  build = "cd cli && bun build --compile src/index.ts --outfile tau",
  config = function()
    require("tau").setup({
      api_url = "http://localhost:1234/v1",
      api_key = "your-api-key",
      model = "your-model-name",
    })
  end,
  keys = {
    { "<leader>t", ":Tau<CR>", mode = "v", desc = "Tau: LLM edit selection" },
  },
}
```

> The `build` step compiles the CLI binary automatically on install and update.

## Setup

`require("tau").setup()` accepts the following options:

| Option | Type | Required | Description |
|---|---|---|---|
| `api_url` | string | yes | Base URL of your OpenAI-compatible API |
| `api_key` | string | yes | API key |
| `model` | string | no | Model name (default: `gpt-4o`) |
| `debug` | boolean | no | Enable diagnostic logging to `~/.local/state/tau/diag.log` |
| `timeout_ms` | number | no | Request timeout in milliseconds (default: `60000`) |
| `context_lines` | number | no | Number of lines above/below selection sent as context (default: `30`) |
| `ui` | table | no | UI provider settings (see [Telescope integration](#telescope-integration)) |

## Usage

1. Visually select code in Neovim
2. Run `:Tau <instruction>` or press your keymap (e.g. `<leader>t`)
3. Type your instruction (e.g. "add error handling", "convert to async")
4. The selection is replaced with the LLM's output

## Telescope integration

tau.nvim supports [Telescope](https://github.com/nvim-telescope/telescope.nvim) as an optional picker backend. When enabled, the instruction picker uses Telescope's fuzzy matching, theming, and layout. Telescope is **not required** — the native picker is used by default.

```lua
require("tau").setup({
  api_url = "http://localhost:1234/v1",
  api_key = "your-api-key",
  ui = {
    provider = "telescope", -- "native" (default) or "telescope"
    telescope = {
      instruction_picker = { theme = "ivy" }, -- any Telescope theme/opts
    },
  },
})
```

If `provider` is set to `"telescope"` but Telescope is not installed, tau falls back to the native picker with a warning.

Pickers are also registered as a Telescope extension:

```vim
:Telescope tau instruction
```

## Provider examples

### Ollama

```lua
require("tau").setup({
  api_url = "http://localhost:11434/v1",
  api_key = "ollama",
  model = "qwen2.5-coder:7b",
})
```

### OpenAI

```lua
require("tau").setup({
  api_url = "https://api.openai.com/v1",
  api_key = os.getenv("OPENAI_API_KEY"),
  model = "gpt-4o",
})
```

## License

MIT
