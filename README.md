# tau.nvim

A minimal Neovim plugin for applying LLM edits to a visual selection or range.

Tau sends your instruction, selected code, nearby context, and optional context files to an OpenAI-compatible `/chat/completions` API, then streams the proposed edit back into Neovim for review.

<img width="4108" height="2392" alt="image" src="https://github.com/user-attachments/assets/83c013fc-b5d3-46bf-ad74-ea5b6f2f2632" />

## Install

Requirements: Neovim 0.10+, [Bun](https://bun.sh), and an OpenAI-compatible API endpoint.

Using [lazy.nvim](https://github.com/folke/lazy.nvim):

```lua
{
  "timothyckl/tau.nvim",
  lazy = false,
  build = "cd cli && bun run build",
  config = function()
    require("tau").setup({
      api_url = "https://api.openai.com/v1", -- Tau appends /chat/completions
      api_key = vim.env.OPENAI_API_KEY,
      model = "gpt-4o",
    })
  end,
  keys = {
    { "<leader>t", ":Tau<CR>", mode = "v", desc = "Tau: edit selection" },
    { "<C-t>", ":TauContext<CR>", mode = "n", desc = "Tau: context files" },
  },
}
```

For Ollama-compatible local servers:

```lua
require("tau").setup({
  api_url = "http://localhost:11434/v1",
  api_key = "ollama",
  model = "qwen2.5-coder:7b",
})
```

## Usage

Select code in visual mode, then run:

```vim
:Tau rewrite this to be simpler
```

Or run `:Tau` without an instruction to open the instruction picker. While reviewing a streamed proposal:

| Key | Action |
| --- | --- |
| `<CR>` | Accept edit |
| `<Esc>` | Reject edit |
| `r` | Regenerate edit |

Tau automatically includes nearby lines from the active file. To add more files as context, press `<C-t>` in the instruction picker or run `:TauContext`.

In the context picker:

| Key / Symbol | Meaning |
| --- | --- |
| `<Space>` | Toggle file under cursor |
| `<Esc>` / `q` | Close picker |
| `◎` | Active file, always included |
| `●` | Selected context file |

Selected context files persist for the current Neovim session.

## Configuration

```lua
require("tau").setup({
  api_url = "https://api.openai.com/v1",
  api_key = vim.env.OPENAI_API_KEY,
  model = "gpt-4o",

  -- optional
  context_lines = 30,
  timeout_ms = 60000,
  context_window = 128000,
  temperature = 0.2,
  max_tokens = 4096,
  top_p = 1,
  debug = false,
  keys = { context = "<C-t>" },
})
```

| Option | Default | Description |
| --- | --- | --- |
| `api_url` | required | OpenAI-compatible API base URL |
| `api_key` | required | API key; prefer environment variables |
| `model` | `gpt-4o` | Model name |
| `context_lines` | `30` | Lines above and below the selection to include |
| `timeout_ms` | `60000` | Request timeout in milliseconds |
| `context_window` | unset | Model context window, used for token estimates |
| `temperature` | unset | Sampling temperature, `0` to `2` |
| `max_tokens` | unset | Maximum response tokens |
| `top_p` | unset | Nucleus sampling value, `0` to `1` |
| `debug` | `false` | Write diagnostics to `~/.local/state/tau/diag.log` |
| `keys.context` | `<C-t>` | Open context picker from the instruction picker |

Commands: `:Tau [instruction]`, `:TauCancel`, `:TauContext`.

## License

MIT
