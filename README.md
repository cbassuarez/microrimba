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
