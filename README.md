# tau.nvim

AI-powered inline code editing for Neovim. Select code, describe what you want, and the selection is replaced in-place by an LLM.

Works with any OpenAI-compatible API — LM Studio, Ollama, OpenAI, and others.

## Requirements

- Neovim 0.10+
- [Bun](https://bun.sh)
- An OpenAI-compatible API endpoint

## Installation

Using [lazy.nvim](https://github.com/folke/lazy.nvim):

```lua
{
  "yourname/tau.nvim",
  build = "cd cli && bun build --compile src/index.ts --outfile tau",
  config = function()
    require("tau").setup({
      api_url = "http://localhost:1234/v1",
      api_key = "your-api-key",
      model = "your-model-name",
    })
  end,
  keys = {
    { "<leader>t", ":Tau ", mode = "v", desc = "Tau: LLM edit selection" },
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

## Usage

1. Visually select code in Neovim
2. Run `:Tau <instruction>` or press your keymap (e.g. `<leader>t`)
3. Type your instruction (e.g. "add error handling", "convert to async")
4. The selection is replaced with the LLM's output

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
