# QC report

`reports/qc.json` contains per-bar flags:

- `low_confidence`: f0 confidence < 0.6
- `unstable_f0`: f0 IQR / median > 0.01
- `suspicious_octave`: octave-shift heuristic indicates likely octave error
- `too_few_peaks`: fewer than 5 summary spectral peaks

## Re-run

```bash
python scripts/build_dataset.py
```
