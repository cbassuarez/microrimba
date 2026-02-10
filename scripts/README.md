# Dataset build scripts

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

If `.m4a` or `.opus` files are present, install `ffmpeg` and `ffprobe`.

## Run

```bash
python scripts/build_dataset.py
```

## Outputs

- `manifest/bars.csv`
- `data/instruments.json`
- `data/bars/*.json`
- `data/index.json`
- `reports/qc.json`
- `reports/README.md`

## Troubleshooting

- Decoder errors: ensure `libsndfile` is available and `ffmpeg` is installed for compressed formats.
- Determinism checks: run the command twice and compare checksums of generated JSON files.
