# microrimba

Archival of a set of 5 microtonal and harmonic marimbas that were given to CalArts this year.

## How to regenerate data

```bash
npm install
npm run build:data
```

The data build validates every CSV in `manifest/`, normalizes rows to canonical bar objects, and writes deterministic JSON artifacts to `data/bars/`.

## How to run the site

```bash
npm install
npm run dev
```

For a production build (including fresh data generation), run:

```bash
npm run build
```

This builds the React/Vite static site and copies generated JSON artifacts into `dist/data/bars` for static hosting.

## Development

```bash
npm install
npm run dev
```

## Build data

The app consumes static JSON in `/data/*.json` generated from `/manifest/*.csv`.

```bash
npm run data:build
```

To enforce all audio file paths exist during data generation:

```bash
STRICT_AUDIO=1 npm run data:build
```

## Deploy to GitHub Pages

The Vite base path is configured for project pages (`/microrimba/`).
A production build always regenerates JSON data first:

```bash
npm run build
npm run preview
```

## Home UX

- **Grouping modes**: The home Pitch Index supports **Unique** (cluster representative rows) and **All bars** (every bar in Hz order). Unique mode can expand to show member bars.
- **Tolerance presets**: Unique clustering uses presets of **±5c**, **±15c**, or **±30c** from `pitch_index.json`.
- **Hz formatting rule**: Hz values are formatted adaptively as `<100 => 3 decimals`, `100-999.999 => 2 decimals`, `>=1000 => 1 decimal`; the prefix `≈` appears only when rounding changed the stored value.
- **Composite behavior**: In Instrument Pads, selecting **Composite** plays representative bars and shows `×N` for grouped member counts when applicable.

### GitHub Pages SPA fallback verification

After `npm run build`, confirm the generated fallback page exists:

```bash
test -f dist/404.html
```

After deploying to GitHub Pages, verify deep-link fallback behavior:

- Open `https://cbassuarez.github.io/microrimba/scale/9edo` directly.
- Refresh that page.
- Confirm the app route loads (not a GitHub hard 404).
- Confirm `view-source:` shows built assets (not `/src/main.tsx`).
