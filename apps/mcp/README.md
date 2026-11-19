# Margin MCP

Give an MCP client read-only access to your saved Margin Bible studies. The server uses local stdio, makes no network requests, and never writes to or locks your library. The client can send tool results to its model, so only register the server with clients you trust.

## Build and register

From the workspace root, using its pinned pnpm and Node 22 or later:

```sh
pnpm install --frozen-lockfile
pnpm --filter @margin/mcp build
claude mcp add margin -- node /absolute/path/to/margin/apps/mcp/dist/index.js
```

Add `--library /absolute/path/to/library` after `index.js` to choose a folder. If omitted, the server checks `MARGIN_LIBRARY_DIR`, then `libraryPath` in `~/Library/Application Support/Margin/prefs.json`, then `~/Documents/Margin`. Restart the client after changing the folder or rebuilding. Use `claude mcp remove margin` to remove the local registration.

For Claude Desktop, add this entry under `mcpServers` in `~/Library/Application Support/Claude/claude_desktop_config.json`, then restart Claude Desktop. Use the absolute Node executable path (`command -v node`) because desktop apps may not inherit your shell's `PATH`.

```json
{
	"mcpServers": {
		"margin": {
			"command": "/absolute/path/to/node",
			"args": ["/absolute/path/to/margin/apps/mcp/dist/index.js"]
		}
	}
}
```

## Tools

- `list_studies`: Find saved study IDs, scripture references and translations, and annotation counts.
- `get_study`: Read a study by `id` as Markdown and structured JSON. Pass `include_italics: false` to omit supplied-word formatting. Passages and notes follow canvas position (top to bottom, left to right). Free notes name the nearest passage by canvas position when one exists. Handwritten ink is identified, not transcribed.
- `search_studies`: Find a literal `query` in titles, typed notes, and scripture references, ignoring case.

List and search scan saved files under `studies/` rather than relying on `library.json`, which may be stale. They report unreadable files as warnings without hiding other studies. Unsaved canvas edits aren't visible to MCP.

## Make a Keynote deck

Install Apple's skill and its Python 3.13+ dependency in the agent's Python environment:

```sh
gh skill install apple/creator-studio-doc-format creator-studio-doc-format
python3.13 -m pip install creator-studio-doc-format
```

Example prompt:

> Use Margin to find my study on Amos 5 and read its outline. Use the `creator-studio-doc-format` skill to make a six-slide Keynote Interchange deck (`.keyx`) outside the Margin library. Label scripture quotations with their references and translation, use my notes for discussion prompts, and don't interpret untranscribed ink.
