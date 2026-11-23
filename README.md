# Audiobookshelf Collection

Obsidian plugin that connects to an [Audiobookshelf](https://www.audiobookshelf.org/) server, fetches all series in the libraries you choose, and writes a library overview note plus one note per series, each rendered from a customizable template.

## Features

- Configure server URL and API token in settings.
- Multi-select which libraries to include.
- One command (and ribbon icon) syncs library overviews and per-series notes into the folder you configure.
- Optional vault paths for library and series templates; otherwise the built-in markdown templates bundled with the plugin are used.

## Installation

Requires Obsidian 1.4.10 or later.

### From community plugins

Once the plugin is listed in the community directory:

1. Open **Settings → Community plugins** and turn on community plugins if needed.
2. Select **Browse** and search for **Audiobookshelf Collection**.
3. Select **Install**, then **Enable**.

### From source

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

Open **Settings → Audiobookshelf Collection**. Options appear in this order:

- **Server URL** — Base URL of your Audiobookshelf server (no trailing slash), e.g. `https://abs.example.com`.
- **API token** — Bearer token from your Audiobookshelf user profile.
- **Folder location** — Vault folder where output is rooted (`/` or empty means vault root). The library overview is written relative to this folder (**Library overview path**). Each series note is written under `{folder}/{library name}/` (only characters invalid in paths are substituted).
- **Library template** — Optional vault path to a markdown file for each library rollup. Leave empty to use the built-in template.
- **Series template** — Optional vault path to a markdown file for each series note. Leave empty to use the built-in template.
- **Library overview path** — Path relative to **Folder location** for each library’s overview file. Supports nested paths with `{{libraryName}}` (a filesystem-safe segment from the Audiobookshelf library name). Default: `{{libraryName}}/All Series`. This does not change individual series filenames.
- **Libraries** — After URL and token are set, choose **Fetch libraries**, then toggle which libraries to include. At least one must stay selected for sync to run.

## Generating notes

Run **Sync library series notes** from the command palette, or click the book ribbon icon. The plugin:

1. Calls `GET /api/libraries/{id}/series` for each selected library.
2. Sorts series alphabetically.
3. Renders the **Library template** once per library (rollup context) and the **Series template** once per series (per-series context).
4. Writes the library overview (`All Series` by default) and individual series notes into the vault folder configured in settings. Existing files are overwritten.

## Modifying the template

From the vault, point **Library template** and **Series template** at your own markdown files to avoid rebuilding the plugin.

To change the defaults for everyone shipping the plugin, edit the bundled sources at [src/templates/library-note.md](src/templates/library-note.md) (library rollup) and [src/templates/series-note.md](src/templates/series-note.md) (per-series), then run `npm run build` to refresh `dist/main.js` (and copied assets).

The renderer supports a small Handlebars-flavored syntax:

- `{{var}}` interpolates a value from the current scope (or any ancestor scope).
- `{{#each list}}...{{/each}}` iterates over an array. Inside the block, properties on the current item are looked up first, then walked up the scope stack.
- `{{#if value}}...{{/if}}` renders the body only when the value is truthy.

Both **Library template** and **Series template** use the same shape for each series and its books (see [`src/seriesNote/types.ts`](src/seriesNote/types.ts)). Only the root object differs.

Shared `series` entry (in the library rollup this appears as an array element; in the series template it is the sole `series` object on the root):

```ts
{
  id: string;
  name: string;
  description: string; // series or first-available book metadata
  bookCount: number;
  finishedBookCount: number;
  totalDurationHours: string;      // 1 decimal
  progressDurationHours: string;  // 1 decimal
  books: Array<{
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    coverUrl: string; // alias of imageUrl; `{serverUrl}/api/items/{id}/cover`
    authorName: string;
    publishedYear: string;
    sequence: string;
    isFinished: boolean;
    statusIcon: string;   // luc_bookmark_plus | luc_book_open | luc_bookmark
    statusLabel: string;  // Finished | In progress | Not started
  }>;
}
```

**Library template** (one overview per synced library): root adds `libraryTitle`, `generatedAt`, `serverUrl`, `libraryCount` (selected libraries in settings), `seriesCount`, `bookCount`, `finishedBookCount`, `totalDurationHours`, and `progressDurationHours` for the whole library rollup. `series` is an array of the shape above, plus `seriesNotePath` on each item (vault path without `.md`, for wikilinks to that series note). Rollup `bookCount` / duration totals can double-count when the same title appears in more than one series.

**Series template** (one file per series): root has `libraryTitle`, `libraryFolderName` (safe folder segment from the library name), `generatedAt`, `serverUrl`, and a single `series` object using the shared shape above (no `seriesNotePath`).

Output is plain text/markdown; no HTML escaping is applied. Missing values render as the empty string.

## Development

- `npm run dev` — watch-mode build; writes to `dist/` and refreshes copied assets on each rebuild.
- `npm run build` — type-check + production bundle into `dist/` (`main.js` plus copied `manifest.json` and `styles.css`).
- `npm run lint` — run ESLint with the `obsidianmd` rules.
- `npm test` — run Vitest on pure helpers (`src/**/*.test.ts`).

## Privacy

The plugin only contacts the Audiobookshelf server you configure. It does not transmit data anywhere else. No telemetry, no analytics.

Requests include your API token and go to the server URL you enter. Use HTTPS where possible so the token is encrypted in transit.

Settings, including the API token, are stored unencrypted in `.obsidian/plugins/audiobookshelf-collection/data.json` inside your vault. If you sync, share, or commit your vault, that file may be included.