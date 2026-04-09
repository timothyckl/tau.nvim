# Contributing to tau.nvim

Thanks for your interest in contributing!

## Getting Started

1. Fork the repo and clone your fork
2. Ensure you have [Neovim 0.10+](https://neovim.io) and [Bun](https://bun.sh) installed
3. Build the CLI: `cd cli && bun build --compile src/index.ts --outfile tau`

## Making Changes

1. Create a branch from `main`
2. Make your changes
3. Test manually in Neovim to verify behavior
4. Open a pull request against `main`

## Commit Conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/). Prefix your commit messages with a type:

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation changes
- `chore:` — maintenance tasks (CI, dependencies, etc.)
- `refactor:` — code changes that neither fix a bug nor add a feature

Example: `feat: add support for streaming responses`

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Write a clear description of what changed and why
- Ensure existing functionality isn't broken

## Reporting Issues

Open an issue with:

- Neovim version (`nvim --version`)
- Steps to reproduce
- Expected vs actual behavior

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
