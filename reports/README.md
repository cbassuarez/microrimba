# QC report

`reports/qc.json` contains per-bar flags:

- `low_confidence`: f0 confidence < 0.6
- `unstable_f0`: f0 IQR / median > 0.01
- `suspicious_octave`: harmonic-grid checks suggest likely octave confusion
- `too_few_peaks`: fewer than 5 summary spectral peaks
- `f0_at_range_boundary`: corrected f0 or median ACF lag is near configured bounds
- `harmonic_grid_mismatch`: harmonic-grid fit score for corrected f0 is below 0.45
- `high_peak_not_near_harmonic`: strongest summary peak is not within 3% of a harmonic

## Re-run

```bash
python scripts/build_dataset.py
```
