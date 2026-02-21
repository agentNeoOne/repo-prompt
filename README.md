# repo-prompt

Generate LLM-ready prompts from your codebase. Stop manually copying files into ChatGPT/Claude.

## Features

- 📁 **Glob patterns** - Select files with familiar syntax (`src/**/*.ts`)
- 🌳 **Directory tree** - Auto-generated project structure
- 📋 **Clipboard** - Automatically copies output
- 🚫 **Smart ignores** - Respects `.gitignore`, skips binaries
- 📏 **Size limits** - Skip huge files automatically
- 🏷️ **XML mode** - For Claude's XML-aware formatting

## Install

```bash
npm install -g repo-prompt
```

## Usage

```bash
# All code files in current directory
repo-prompt

# Specific patterns
repo-prompt "src/**/*.ts" "*.json"

# Just the source folder
repo-prompt "src/**/*"

# With a task prompt
repo-prompt -p "Review this code for security issues:"

# XML format (better for Claude)
repo-prompt -x

# Output to file instead of clipboard
repo-prompt -o prompt.md

# Exclude tests
repo-prompt -e "**/*.test.ts" "**/__tests__/**"
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --output <file>` | Write to file | (clipboard) |
| `-c, --clipboard` | Copy to clipboard | `true` |
| `-i, --include <patterns>` | Additional includes | - |
| `-e, --exclude <patterns>` | Additional excludes | - |
| `-m, --max-size <size>` | Max file size | `100k` |
| `-t, --tree` | Include directory tree | `true` |
| `-p, --prompt <text>` | Add task prompt | - |
| `-x, --xml` | Use XML file blocks | `false` |

## Auto-Ignored

- `node_modules`, `.git`, `dist`, `build`, `.next`
- Binary files (images, video, fonts, etc.)
- Lock files, `.env`, logs
- Everything in your `.gitignore`

## Examples

### Code review prompt
```bash
repo-prompt src/**/*.ts -p "Review this TypeScript code for:
- Potential bugs
- Performance issues  
- Best practices violations"
```

### Documentation generation
```bash
repo-prompt src/**/*.ts README.md -p "Generate API documentation for this project"
```

### Bug fix context
```bash
repo-prompt src/auth/**/* -p "There's a bug where users can't log in after password reset. Find and fix it."
```

## License

MIT
