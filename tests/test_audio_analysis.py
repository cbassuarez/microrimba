from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

sys.path.append(str(Path(__file__).resolve().parents[1] / "scripts"))
import build_dataset as bd  # noqa: E402


def synth_tone(freq: float = 440.0, sr: int = 48000, dur: float = 1.2) -> np.ndarray:
    t = np.arange(int(sr * dur), dtype=np.float32) / sr
    y = 0.8 * np.sin(2 * np.pi * freq * t)
    y += 0.2 * np.sin(2 * np.pi * freq * 2 * t)
    y += 0.1 * np.sin(2 * np.pi * freq * 3 * t)
    return y.astype(np.float32)


def test_f0_estimator_close_to_tone() -> None:
    sr = 48000
    y = synth_tone(freq=330.0, sr=sr)
    s, e, _ = bd._pick_stable_window(y, sr)
    f0_frames, conf = bd._estimate_f0_acf(y[s:e], sr)
    est = float(np.median(f0_frames))
    assert abs(est - 330.0) < 3.0
    assert 0.0 <= float(np.mean(conf)) <= 1.0


def test_peak_picker_finds_harmonics() -> None:
    sr = 48000
    y = synth_tone(freq=220.0, sr=sr)
    peaks, summary = bd._analyze_partials(y, sr, 220.0)
    assert len(peaks) >= 3
    freqs = [p["hz"] for p in summary]
    assert any(abs(f - 220.0) < 10.0 for f in freqs)
    assert any(abs(f - 440.0) < 20.0 for f in freqs)


def test_analysis_deterministic() -> None:
    sr = 48000
    y = synth_tone(freq=261.63, sr=sr)
    s, e, _ = bd._pick_stable_window(y, sr)

    f0_a, conf_a = bd._estimate_f0_acf(y[s:e], sr)
    f0_b, conf_b = bd._estimate_f0_acf(y[s:e], sr)
    assert np.array_equal(f0_a, f0_b)
    assert np.array_equal(conf_a, conf_b)

    peaks_a, summary_a = bd._analyze_partials(y[s:e], sr, float(np.median(f0_a)))
    peaks_b, summary_b = bd._analyze_partials(y[s:e], sr, float(np.median(f0_b)))
    assert peaks_a == peaks_b
    assert summary_a == summary_b


def test_ji_candidates_sorted() -> None:
    cands = bd._generate_ji_candidates(3 / 2)
    assert len(cands) == 10
    first = cands[0]
    assert first["p"] > 0 and first["q"] > 0
    # ensure the best candidate should be close to ratio itself
    cents = 1200 * math.log2((first["p"] / first["q"]) / (3 / 2))
    assert abs(cents) < 5
