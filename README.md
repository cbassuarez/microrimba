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
