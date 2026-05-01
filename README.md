# Audiobookshelf Collection

Obsidian plugin that connects to an [Audiobookshelf](https://www.audiobookshelf.org/) server, fetches all series in the libraries you choose, and writes them into a single markdown note rendered from a customizable template.

## Features

- Configure server URL and API token in settings.
- Multi-select which libraries to include.
- One command (and ribbon icon) generates the note in the currently active folder.
- The note is rendered from a plain markdown template kept in the repo, so it's easy to modify.

## Setup

1. Install build dependencies and build the plugin:
   ```bash
   npm install
   npm run build
   ```
2. Copy everything from the `dist/` folder (`main.js`, `manifest.json`, `styles.css`) into your vault at:
   ```
   <Vault>/.obsidian/plugins/audiobookshelf-collection/
   ```
3. In Obsidian, enable **Audiobookshelf Collection** under **Settings → Community plugins**.

## Configuration

Open **Settings → Audiobookshelf Collection** and fill in:

- **Server URL** — the base URL of your Audiobookshelf server (no trailing slash), e.g. `https://abs.example.com`.
- **API token** — copy this from your Audiobookshelf user profile.
- **Output file name** — file name template for generated notes (supports `{{libraryName}}`; default is `{{libraryName}} Series`).
- **Libraries** — click **Fetch libraries** to load them from the server, then toggle the ones you want.

## Generating the note

Run **Generate series note** from the command palette, or click the book ribbon icon. The plugin:

1. Calls `GET /api/libraries/{id}/series` for each selected library.
2. Sorts series alphabetically.
3. Renders the template with the resulting context.
4. Writes the file into the parent folder of the currently open note (or the vault root if no note is open). If the file already exists it is overwritten.

## Modifying the template

The template lives at [src/templates/series-note.md](src/templates/series-note.md). Edit it and run `npm run build` to refresh `dist/main.js` (and copied assets).

The renderer supports a small Handlebars-flavored syntax:

- `{{var}}` interpolates a value from the current scope (or any ancestor scope).
- `{{#each list}}...{{/each}}` iterates over an array. Inside the block, properties on the current item are looked up first, then walked up the scope stack.
- `{{#if value}}...{{/if}}` renders the body only when the value is truthy.

The template context provided by the command is:

```ts
{
  generatedAt: string;        // local timestamp at run time
  serverUrl: string;
  libraryCount: number;
  seriesCount: number;
  series: Array<{
    id: string;
    name: string;
    bookCount: number;
    finishedBookCount: number;
    totalDurationHours: string;  // 1 decimal
    progressDurationHours: string; // 1 decimal
    books: Array<{
      title: string;
      authorName: string;
      publishedYear: string;
      sequence: string;          // numeric position when available
      isFinished: boolean;       // true when user finished the book
      statusIcon: string;        // "bookmark-check" or "bookmark"
    }>;
  }>;
}
```

Output is plain text/markdown; no HTML escaping is applied. Missing values render as the empty string.

## Development

- `npm run dev` — watch-mode build; writes to `dist/` and refreshes copied assets on each rebuild.
- `npm run build` — type-check + production bundle into `dist/` (`main.js` plus copied `manifest.json` and `styles.css`).
- `npm run lint` — run ESLint with the `obsidianmd` rules.

Source layout:

```
src/
  main.ts                       Plugin lifecycle, command + ribbon registration
  settings.ts                   Settings interface and defaults
  ui/settingsTab.ts             Settings tab UI
  api/client.ts                 Audiobookshelf HTTP client (requestUrl)
  api/types.ts                  Minimal API response types
  template/render.ts            Mustache/handlebars-flavored renderer
  templates/series-note.md      Default note template (bundled by esbuild)
  commands/generateSeriesNote.ts Command implementation
```

## Privacy

The plugin only contacts the Audiobookshelf server you configure. It does not transmit data anywhere else. No telemetry, no analytics.
