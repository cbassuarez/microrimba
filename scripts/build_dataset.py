#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import json
import math
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import soundfile as sf
from scipy.signal import find_peaks

REPO_ROOT = Path(__file__).resolve().parents[1]
AUDIO_ROOT = REPO_ROOT / "audio"
MANIFEST_PATH = REPO_ROOT / "manifest" / "bars.csv"
INSTRUMENTS_PATH = REPO_ROOT / "data" / "instruments.json"
BARS_DIR = REPO_ROOT / "data" / "bars"
INDEX_PATH = REPO_ROOT / "data" / "index.json"
QC_PATH = REPO_ROOT / "reports" / "qc.json"
QC_README = REPO_ROOT / "reports" / "README.md"

VALID_EXTS = {".wav", ".flac", ".m4a", ".opus"}
INSTRUMENT_IDS = ["edo5", "edo7", "edo8", "edo9", "harmonic"]
AUDIO_TO_INSTRUMENT = {
    "5edo": "edo5",
    "7edo": "edo7",
    "8edo": "edo8",
    "9edo": "edo9",
    "harmonic": "harmonic",
}
WINDOW_IGNORE_S = 0.20
RMS_FRAME_S = 0.05
WINDOW_TARGET_S = 1.00
WINDOW_MIN_S = 0.40
# Marimba bars span broad ranges, but fundamentals above ~2 kHz are implausible;
# constraining the ACF search prevents the classic tiny-lag octave/alias failures.
MIN_F0_HZ = 40.0
MAX_F0_HZ = 2000.0
MAX_FFT = 262144
PROMINENCE_DB = 15.0
MAX_PEAKS = 60
SUMMARY_PEAKS = 12

CSV_HEADER = [
    "bar_id",
    "instrument_id",
    "position_index",
    "label_index_mod",
    "audio_file",
    "spectrogram_file",
    "youtube_url",
    "youtube_timecode",
    "session_id",
    "notes",
]


@dataclass(frozen=True)
class AudioEntry:
    instrument_id: str
    source_filename: str
    source_path: str
    audio_path: str
    bar_id: str


def _json_dump(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _get_git_hash() -> str:
    try:
        out = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=REPO_ROOT)
        return out.decode().strip() or "dev"
    except Exception:
        return "dev"


def _get_git_iso_date() -> str:
    try:
        out = subprocess.check_output(["git", "log", "-1", "--format=%cI"], cwd=REPO_ROOT)
        val = out.decode().strip()
        if val:
            return val
    except Exception:
        pass
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _natural_key(name: str) -> list[Any]:
    parts: list[Any] = []
    current = ""
    is_digit = None
    for ch in name.lower():
        ch_digit = ch.isdigit()
        if is_digit is None:
            current = ch
            is_digit = ch_digit
        elif ch_digit == is_digit:
            current += ch
        else:
            parts.append(int(current) if is_digit else current)
            current = ch
            is_digit = ch_digit
    if current:
        parts.append(int(current) if is_digit else current)
    return parts


def _scan_audio_entries() -> dict[str, list[AudioEntry]]:
    by_instrument: dict[str, list[AudioEntry]] = {k: [] for k in INSTRUMENT_IDS}
    if not AUDIO_ROOT.exists():
        raise FileNotFoundError("audio directory not found")

    for folder_name, instrument_id in AUDIO_TO_INSTRUMENT.items():
        folder = AUDIO_ROOT / folder_name
        if not folder.exists():
            raise FileNotFoundError(f"missing expected folder: {folder}")
        files = [p for p in folder.iterdir() if p.is_file() and not p.name.startswith('.')]
        audio_files = [p for p in files if p.suffix.lower() in VALID_EXTS]
        unsupported = sorted(p.name for p in files if p.suffix.lower() not in VALID_EXTS)
        if unsupported:
            raise ValueError(f"unsupported files in {folder}: {unsupported}")
        if not audio_files:
            raise ValueError(f"no audio files found in {folder}")
        for path in sorted(audio_files, key=lambda p: _natural_key(p.name)):
            rel = path.relative_to(REPO_ROOT).as_posix()
            fingerprint = hashlib.sha256(rel.encode("utf-8")).hexdigest()[:12]
            bar_id = f"{instrument_id}-{fingerprint}"
            by_instrument[instrument_id].append(
                AudioEntry(
                    instrument_id=instrument_id,
                    source_filename=path.name,
                    source_path=rel,
                    audio_path=rel,
                    bar_id=bar_id,
                )
            )
    return by_instrument


def _read_audio(path: Path) -> tuple[np.ndarray, int]:
    ext = path.suffix.lower()
    try:
        data, sr = sf.read(str(path), always_2d=False, dtype="float32")
    except RuntimeError:
        if ext not in {".m4a", ".opus"}:
            raise
        data, sr = _decode_with_ffmpeg(path)
    if data.ndim == 2:
        data = np.mean(data, axis=1)
    if data.size == 0:
        raise ValueError(f"empty audio: {path}")
    return data.astype(np.float32), int(sr)


def _decode_with_ffmpeg(path: Path) -> tuple[np.ndarray, int]:
    cmd = [
        "ffmpeg",
        "-v",
        "error",
        "-i",
        str(path),
        "-f",
        "f32le",
        "-ac",
        "1",
        "-acodec",
        "pcm_f32le",
        "-",
    ]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg decode failed for {path}: {proc.stderr.decode().strip()}")

    sr_cmd = ["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate", "-of", "csv=p=0", str(path)]
    sr_proc = subprocess.run(sr_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if sr_proc.returncode != 0:
        raise RuntimeError(f"ffprobe sample rate failed for {path}: {sr_proc.stderr.decode().strip()}")
    sr = int(sr_proc.stdout.decode().strip())
    data = np.frombuffer(proc.stdout, dtype=np.float32)
    return data, sr


def _pick_stable_window(x: np.ndarray, sr: int) -> tuple[int, int, str]:
    n = x.size
    start_idx = min(int(WINDOW_IGNORE_S * sr), n)
    max_win = int(WINDOW_TARGET_S * sr)
    min_win = int(WINDOW_MIN_S * sr)

    available = n - start_idx
    if available <= 0:
        return 0, n, "audio shorter than ignore lead-in; using full signal"

    win = min(max_win, available)
    if win < min_win:
        win = max(min_win, available)
    if win > available:
        win = available

    frame = max(1, int(RMS_FRAME_S * sr))
    best_start = start_idx
    best_var = None

    for s in range(start_idx, n - win + 1, frame):
        segment = x[s : s + win]
        chunks = segment[: (segment.size // frame) * frame].reshape(-1, frame)
        if chunks.size == 0:
            continue
        rms = np.sqrt(np.mean(chunks * chunks, axis=1) + 1e-12)
        variance = float(np.var(rms))
        if best_var is None or variance < best_var - 1e-12 or (abs(variance - best_var) < 1e-12 and s > best_start):
            best_var = variance
            best_start = s

    note = ""
    if n / sr < 1.2:
        note = "short audio; analysis window reduced"
    return best_start, best_start + win, note


def _estimate_f0_acf_with_meta(
    x: np.ndarray,
    sr: int,
    min_hz: float = MIN_F0_HZ,
    max_hz: float = MAX_F0_HZ,
    context: str | None = None,
) -> tuple[np.ndarray, np.ndarray, dict[str, Any]]:
    frame_size = max(1024, int(0.046 * sr))
    hop = max(256, frame_size // 4)
    lmin = max(1, int(math.floor(sr / max_hz)))
    lmax = min(frame_size - 1, int(math.ceil(sr / min_hz)))

    if lmax <= lmin:
        label = f" ({context})" if context else ""
        raise ValueError(
            f"invalid f0 lag search window{label}: lmin={lmin}, lmax={lmax}, frame_size={frame_size}, sr={sr}, min_hz={min_hz}, max_hz={max_hz}"
        )

    notes: list[str] = []
    if x.size < frame_size:
        x = np.pad(x, (0, frame_size - x.size))
        notes.append("short audio; frame was zero-padded for f0 tracking")

    f0s: list[float] = []
    confs: list[float] = []
    lags: list[int] = []
    window = np.hanning(frame_size)

    for s in range(0, x.size - frame_size + 1, hop):
        frame = x[s : s + frame_size] * window
        frame = frame - np.mean(frame)
        ac = np.correlate(frame, frame, mode="full")[frame_size - 1 :]
        if ac[0] <= 0:
            continue
        ac = ac / (ac[0] + 1e-12)
        search = ac[lmin:lmax]
        if search.size == 0:
            continue
        lag = int(np.argmax(search)) + lmin
        peak = float(ac[lag])
        f0 = sr / lag
        lags.append(lag)
        f0s.append(float(f0))
        confs.append(float(np.clip(peak, 0.0, 1.0)))

    if not f0s:
        label = f" ({context})" if context else ""
        raise ValueError(f"unable to estimate f0 from audio{label}")
    meta = {
        "lmin": int(lmin),
        "lmax": int(lmax),
        "frame_size": int(frame_size),
        "hop": int(hop),
        "median_lag": int(np.median(np.array(lags, dtype=int))),
        "notes": notes,
    }
    return np.array(f0s, dtype=float), np.array(confs, dtype=float), meta


def _estimate_f0_acf(x: np.ndarray, sr: int, min_hz: float = MIN_F0_HZ, max_hz: float = MAX_F0_HZ) -> tuple[np.ndarray, np.ndarray]:
    f0s, confs, _meta = _estimate_f0_acf_with_meta(x, sr, min_hz=min_hz, max_hz=max_hz)
    return f0s, confs


def _harmonic_grid_fit_score(summary_peaks: list[dict[str, Any]], f0_hz: float, tol: float = 0.03, k_max: int = SUMMARY_PEAKS) -> float:
    if not summary_peaks or f0_hz <= 0:
        return 0.0
    k = min(k_max, len(summary_peaks))
    aligned = 0
    for peak in summary_peaks[:k]:
        peak_hz = float(peak.get("hz", 0.0))
        harmonic_idx = int(round(peak_hz / f0_hz))
        if harmonic_idx < 1:
            continue
        target = harmonic_idx * f0_hz
        rel_err = abs(peak_hz - target) / max(target, 1e-9)
        if rel_err <= tol:
            aligned += 1
    return aligned / max(k, 1)


def _correct_octave_by_harmonic_fit(preliminary_f0_hz: float, summary_peaks: list[dict[str, Any]]) -> tuple[float, float, dict[str, Any] | None, bool]:
    candidates = [preliminary_f0_hz, preliminary_f0_hz / 2.0, preliminary_f0_hz * 2.0]
    scored: list[tuple[float, float, float, bool]] = []
    for cand in candidates:
        fit = _harmonic_grid_fit_score(summary_peaks, cand)
        cents_shift = abs(1200.0 * math.log2(max(cand, 1e-9) / max(preliminary_f0_hz, 1e-9)))
        in_range = MIN_F0_HZ <= cand <= MAX_F0_HZ
        scored.append((cand, fit, cents_shift, in_range))

    scored.sort(key=lambda x: (x[1], x[3], -x[2]), reverse=True)
    best_f0, best_fit, _best_shift, _best_in_range = scored[0]
    before_fit = _harmonic_grid_fit_score(summary_peaks, preliminary_f0_hz)
    ratio = max(best_f0, 1e-9) / max(preliminary_f0_hz, 1e-9)
    is_octave = abs(math.log2(ratio)) > 0.9 and abs(math.log2(ratio)) < 1.1
    improved = best_fit - before_fit
    accepted = is_octave and improved >= 0.15 and MIN_F0_HZ <= best_f0 <= MAX_F0_HZ
    correction = None
    if accepted:
        correction = {
            "original_f0_hz": float(preliminary_f0_hz),
            "corrected_f0_hz": float(best_f0),
            "harmonic_fit_before": float(before_fit),
            "harmonic_fit_after": float(best_fit),
        }
    return (float(best_f0 if accepted else preliminary_f0_hz), float(best_fit if accepted else before_fit), correction, accepted)


def _analyze_partials(x: np.ndarray, sr: int, f0_hz: float) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    n = x.size
    fft_n = 1 << int(math.ceil(math.log2(max(2, n))))
    fft_n = min(fft_n, MAX_FFT)
    if n < fft_n:
        x = np.pad(x, (0, fft_n - n))
    else:
        x = x[:fft_n]

    win = np.hanning(x.size)
    spec = np.fft.rfft(x * win)
    mag = np.abs(spec)
    freqs = np.fft.rfftfreq(x.size, d=1.0 / sr)

    valid = freqs >= 20.0
    mag_valid = mag[valid]
    freqs_valid = freqs[valid]
    if mag_valid.size == 0:
        return [], []

    mag_db = 20.0 * np.log10(np.maximum(mag_valid, 1e-12))
    prominence = PROMINENCE_DB
    peaks_idx, props = find_peaks(mag_db, prominence=prominence)

    if peaks_idx.size == 0:
        # fallback top bins excluding DC
        peaks_idx = np.argsort(mag_valid)[-min(MAX_PEAKS, mag_valid.size) :]
        prominences = np.ones_like(peaks_idx, dtype=float) * 1.0
    else:
        prominences = props["prominences"]

    amp_max = float(np.max(mag_db))
    order = np.argsort(mag_db[peaks_idx])[::-1][:MAX_PEAKS]
    entries: list[dict[str, Any]] = []
    for k in order:
        idx = peaks_idx[k]
        hz = float(freqs_valid[idx])
        rel_db = float(mag_db[idx] - amp_max)
        harmonic_ratio = hz / max(f0_hz, 1e-6)
        harmonic_index = int(round(harmonic_ratio))
        if harmonic_index < 1 or abs(harmonic_ratio - harmonic_index) / harmonic_index > 0.03:
            harmonic_guess = None
        else:
            harmonic_guess = harmonic_index
        prom = float(prominences[k] if k < len(prominences) else 1.0)
        peak_conf = float(np.clip(prom / (PROMINENCE_DB * 2.0), 0.0, 1.0))
        entries.append(
            {
                "hz": hz,
                "rel_amp_db": rel_db,
                "peak_confidence": peak_conf,
                "harmonic_index_guess": harmonic_guess,
            }
        )

    summary = entries[:SUMMARY_PEAKS]
    return entries, summary


def _prime_factors(n: int) -> list[int]:
    x = n
    factors: list[int] = []
    d = 2
    while d * d <= x:
        while x % d == 0:
            factors.append(d)
            x //= d
        d += 1
    if x > 1:
        factors.append(x)
    return factors


def _generate_ji_candidates(ratio: float) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    seen: set[tuple[int, int, int]] = set()
    for prime_limit in (5, 7, 11, 13):
        for p in range(1, 257):
            pf = _prime_factors(p)
            if pf and max(pf) > prime_limit:
                continue
            for q in range(1, 257):
                qf = _prime_factors(q)
                if qf and max(qf) > prime_limit:
                    continue
                g = math.gcd(p, q)
                pp, qq = p // g, q // g
                key = (pp, qq, prime_limit)
                if key in seen:
                    continue
                seen.add(key)
                rr = pp / qq
                cents_error = 1200.0 * math.log2(rr / ratio)
                complexity = math.log2(pp * qq)
                total = abs(cents_error) + 6.0 * complexity + 2.0 * (prime_limit - 5)
                candidates.append(
                    {
                        "p": pp,
                        "q": qq,
                        "cents_error": cents_error,
                        "prime_limit": prime_limit,
                        "complexity_score": complexity,
                        "label": f"{pp}/{qq}",
                        "_total": total,
                    }
                )
    candidates.sort(key=lambda c: (c["_total"], abs(c["cents_error"]), c["complexity_score"], c["p"], c["q"]))
    top = candidates[:10]
    for c in top:
        c.pop("_total", None)
    return top


def _make_instruments_file() -> dict[str, Any]:
    defaults: dict[str, Any] = {}
    for iid in INSTRUMENT_IDS:
        edo = None
        if iid.startswith("edo"):
            edo = int(iid.replace("edo", ""))
        defaults[iid] = {
            "id": iid,
            "metadata": {
                "maker": "",
                "range": "",
                "physical_notes": "",
                "provenance": "",
            },
            "tuning_intent": "",
            "edo": edo,
        }
    if not INSTRUMENTS_PATH.exists():
        _json_dump(INSTRUMENTS_PATH, defaults)
        return defaults
    existing = json.loads(INSTRUMENTS_PATH.read_text(encoding="utf-8"))
    for iid, payload in defaults.items():
        if iid not in existing:
            existing[iid] = payload
    _json_dump(INSTRUMENTS_PATH, existing)
    return existing


def _load_or_create_manifest(entries: dict[str, list[AudioEntry]]) -> dict[str, dict[str, str]]:
    rows: dict[str, dict[str, str]] = {}
    ordered = [e for iid in INSTRUMENT_IDS for e in entries[iid]]
    if not MANIFEST_PATH.exists():
        MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
        with MANIFEST_PATH.open("w", encoding="utf-8", newline="") as fh:
            writer = csv.DictWriter(fh, fieldnames=CSV_HEADER)
            writer.writeheader()
            for e in ordered:
                writer.writerow(
                    {
                        "bar_id": e.bar_id,
                        "instrument_id": e.instrument_id,
                        "position_index": "",
                        "label_index_mod": "",
                        "audio_file": e.audio_path,
                        "spectrogram_file": "",
                        "youtube_url": "",
                        "youtube_timecode": "",
                        "session_id": "",
                        "notes": "",
                    }
                )

    with MANIFEST_PATH.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        if reader.fieldnames != CSV_HEADER:
            raise ValueError(f"manifest header mismatch. expected {CSV_HEADER} got {reader.fieldnames}")
        for row in reader:
            bar_id = row["bar_id"].strip()
            if not bar_id:
                raise ValueError("manifest contains empty bar_id")
            rows[bar_id] = row

    for e in ordered:
        if e.bar_id not in rows:
            rows[e.bar_id] = {
                "bar_id": e.bar_id,
                "instrument_id": e.instrument_id,
                "position_index": "",
                "label_index_mod": "",
                "audio_file": e.audio_path,
                "spectrogram_file": "",
                "youtube_url": "",
                "youtube_timecode": "",
                "session_id": "",
                "notes": "",
            }

    # rewrite deterministically
    with MANIFEST_PATH.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_HEADER)
        writer.writeheader()
        for e in ordered:
            row = rows[e.bar_id]
            row["instrument_id"] = e.instrument_id
            row["audio_file"] = e.audio_path
            writer.writerow({k: row.get(k, "") for k in CSV_HEADER})
    return rows


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def build_dataset() -> None:
    method_version = _get_git_hash()
    generated_at = _get_git_iso_date()

    entries = _scan_audio_entries()
    manifest_rows = _load_or_create_manifest(entries)
    instruments = _make_instruments_file()

    bars: list[dict[str, Any]] = []
    qc_entries: list[dict[str, Any]] = []
    warnings: list[str] = []

    for instrument_id in INSTRUMENT_IDS:
        instrument_entries = entries[instrument_id]
        for default_pos, entry in enumerate(instrument_entries, start=1):
            row = manifest_rows.get(entry.bar_id, {})
            pos_raw = (row.get("position_index") or "").strip()
            if pos_raw:
                position_index = int(pos_raw)
                pos_note = "from manifest"
            else:
                position_index = default_pos
                pos_note = "derived from natural filename order"

            audio_abs = REPO_ROOT / entry.audio_path
            audio_sha = _sha256_file(audio_abs)
            y, sr = _read_audio(audio_abs)
            s_idx, e_idx, window_note = _pick_stable_window(y, sr)
            seg = y[s_idx:e_idx]
            f0_frames, conf_frames, f0_meta = _estimate_f0_acf_with_meta(seg, sr, context=entry.bar_id)
            f0_prelim_hz = float(np.median(f0_frames))
            q1, q3 = np.quantile(f0_frames, [0.25, 0.75])
            iqr = float(q3 - q1)
            f0_conf = float(np.clip(0.5 * float(np.mean(conf_frames)) + 0.5 * (1.0 / (1.0 + (np.var(f0_frames) / max(f0_prelim_hz, 1e-6)))), 0.0, 1.0))

            _peaks_prelim, summary_prelim = _analyze_partials(seg, sr, f0_prelim_hz)
            f0_hz, harmonic_fit, f0_correction, corrected = _correct_octave_by_harmonic_fit(f0_prelim_hz, summary_prelim)
            peaks, summary = _analyze_partials(seg, sr, f0_hz)

            bar = {
                "bar_id": entry.bar_id,
                "instrument_id": instrument_id,
                "position_index": position_index,
                "label_index_mod": int(row["label_index_mod"]) if (row.get("label_index_mod") or "").strip() else None,
                "source_filename": entry.source_filename,
                "source_path": entry.source_path,
                "media": {
                    "audio_path": entry.audio_path,
                    "youtube_url": (row.get("youtube_url") or "").strip() or None,
                    "spectrogram_path": (row.get("spectrogram_file") or "").strip() or None,
                    "checksums": {
                        "audio_sha256": audio_sha,
                    },
                },
                "measurements": {
                    "sample_rate_hz": sr,
                    "f0": {
                        "f0_hz": f0_hz,
                        "f0_method": "acf_median_tracker_v1",
                        "f0_confidence": f0_conf,
                        "f0_confidence_notes": "; ".join(
                            [
                                n
                                for n in [
                                    window_note,
                                    pos_note,
                                    *f0_meta.get("notes", []),
                                    (
                                        f"octave-corrected: {f0_prelim_hz:.3f}->{f0_hz:.3f} "
                                        f"(harmonic fit {f0_correction['harmonic_fit_before']:.2f}->{f0_correction['harmonic_fit_after']:.2f})"
                                        if f0_correction
                                        else ""
                                    ),
                                ]
                                if n
                            ]
                        ),
                        "f0_search": {
                            "min_hz": MIN_F0_HZ,
                            "max_hz": MAX_F0_HZ,
                            "lmin": f0_meta["lmin"],
                            "lmax": f0_meta["lmax"],
                            "frame_size": f0_meta["frame_size"],
                            "median_lag": f0_meta["median_lag"],
                        },
                        "f0_corrections": f0_correction,
                        "harmonic_grid_fit": harmonic_fit,
                        "f0_window": {
                            "start_s": s_idx / sr,
                            "end_s": e_idx / sr,
                        },
                        "f0_distribution": {
                            "median_hz": f0_hz,
                            "iqr_hz": iqr,
                            "min_hz": float(np.min(f0_frames)),
                            "max_hz": float(np.max(f0_frames)),
                            "n_frames": int(f0_frames.size),
                        },
                    },
                    "partials": {
                        "analysis_window": {
                            "start_s": s_idx / sr,
                            "end_s": e_idx / sr,
                        },
                        "peaks": peaks,
                        "summary_peaks": summary,
                    },
                },
                "register": {
                    "octave_abs": 0,
                    "within_octave_ratio": 1.0,
                },
                "edo_interpretation": None,
                "ji": {
                    "ji_candidates": [],
                    "ji_primary": None,
                },
                "global_order_index": 0,
                "provenance": {
                    "measured_by": "",
                    "measured_at": "",
                    "room": "",
                    "mic": "",
                    "mallet": "",
                    "notes": (row.get("notes") or "").strip(),
                    "method_version": method_version,
                },
                "revision_history": [
                    {
                        "date": generated_at,
                        "by": "build_dataset.py",
                        "change": "initial record creation",
                    }
                ],
                "license": {
                    "audio": "TBD",
                    "spectrogram": "TBD",
                    "metadata": "TBD",
                },
            }
            bars.append(bar)

    bars_sorted = sorted(
        bars,
        key=lambda b: (
            b["measurements"]["f0"]["f0_hz"],
            b["instrument_id"],
            b["position_index"],
        ),
    )

    f_ref_bar = bars_sorted[0]
    f_ref = f_ref_bar["measurements"]["f0"]["f0_hz"]

    for idx, bar in enumerate(bars_sorted, start=1):
        f0 = bar["measurements"]["f0"]["f0_hz"]
        octave_abs = math.floor(math.log2(f0 / f_ref))
        within = f0 / (f_ref * (2 ** octave_abs))
        bar["register"] = {"octave_abs": int(octave_abs), "within_octave_ratio": float(within)}
        bar["global_order_index"] = idx

        if bar["instrument_id"].startswith("edo"):
            edo = int(bar["instrument_id"].replace("edo", ""))
            step = int(round(edo * math.log2(within)))
            target_ratio = 2 ** (step / edo)
            cents_error = 1200.0 * math.log2(within / target_ratio)
            bar["edo_interpretation"] = {
                "edo": edo,
                "step": step,
                "octave": int(octave_abs),
                "target_ratio": float(target_ratio),
                "cents_error_from_target": float(cents_error),
            }
        else:
            bar["edo_interpretation"] = None

        ji_candidates = _generate_ji_candidates(f0 / f_ref)
        primary = ji_candidates[0]
        bar["ji"] = {
            "ji_candidates": ji_candidates,
            "ji_primary": {
                **primary,
                "why": (
                    f"closest weighted JI fit with {primary['label']} at "
                    f"{primary['cents_error']:.3f} cents error, complexity {primary['complexity_score']:.3f}, "
                    f"prime limit {primary['prime_limit']}"
                ),
            },
        }

        f0_conf = bar["measurements"]["f0"]["f0_confidence"]
        f0_payload = bar["measurements"]["f0"]
        dist = f0_payload["f0_distribution"]
        unstable = dist["iqr_hz"] / max(dist["median_hz"], 1e-6) > 0.01
        summary_peaks = bar["measurements"]["partials"]["summary_peaks"]
        too_few = len(summary_peaks) < 5

        fit_now = _harmonic_grid_fit_score(summary_peaks, f0)
        fit_half = _harmonic_grid_fit_score(summary_peaks, f0 / 2.0)
        fit_double = _harmonic_grid_fit_score(summary_peaks, f0 * 2.0)
        suspicious = (
            (f0_payload.get("f0_corrections") is not None)
            or (fit_now < 0.45 and max(fit_half, fit_double) - fit_now >= 0.15)
            or (max(fit_half, fit_double) - fit_now >= 0.20)
        )

        highest_peak = summary_peaks[0] if summary_peaks else None
        high_peak_not_near_harmonic = False
        if highest_peak is not None:
            hp_hz = float(highest_peak.get("hz", 0.0))
            k = int(round(hp_hz / max(f0, 1e-9)))
            if k < 1:
                high_peak_not_near_harmonic = True
            else:
                target = k * f0
                high_peak_not_near_harmonic = abs(hp_hz - target) / max(target, 1e-9) > 0.03

        search = f0_payload.get("f0_search", {})
        median_lag = int(search.get("median_lag", -1))
        lmin = int(search.get("lmin", -1))
        lmax = int(search.get("lmax", -1))
        lag_near_boundary = (lmin > 0 and median_lag <= lmin + 1) or (lmax > 0 and median_lag >= lmax - 1)
        hz_near_boundary = (
            abs(f0 - MIN_F0_HZ) / MIN_F0_HZ <= 0.02
            or abs(f0 - MAX_F0_HZ) / MAX_F0_HZ <= 0.02
        )
        f0_at_range_boundary = hz_near_boundary or lag_near_boundary
        harmonic_grid_mismatch = fit_now < 0.45

        notes = []
        if unstable:
            notes.append("high relative f0 IQR")
        if too_few:
            notes.append("low partial count")
        if f0_at_range_boundary:
            notes.append("f0 near configured range boundary")
        if harmonic_grid_mismatch:
            notes.append("weak harmonic grid alignment")
        qc_entries.append(
            {
                "bar_id": bar["bar_id"],
                "low_confidence": f0_conf < 0.6,
                "unstable_f0": unstable,
                "suspicious_octave": suspicious,
                "too_few_peaks": too_few,
                "f0_at_range_boundary": f0_at_range_boundary,
                "harmonic_grid_mismatch": harmonic_grid_mismatch,
                "high_peak_not_near_harmonic": high_peak_not_near_harmonic,
                "notes": "; ".join(notes),
            }
        )

    # Write bar files sorted by global order
    BARS_DIR.mkdir(parents=True, exist_ok=True)
    for bar in bars_sorted:
        _json_dump(BARS_DIR / f"{bar['bar_id']}.json", bar)

    index_payload = {
        "generated_at": generated_at,
        "method_version": method_version,
        "f_ref": {
            "bar_id": f_ref_bar["bar_id"],
            "f_ref_hz_measured": f_ref,
        },
        "bars": [
            {
                "bar_id": b["bar_id"],
                "instrument_id": b["instrument_id"],
                "position_index": b["position_index"],
                "f0_hz": b["measurements"]["f0"]["f0_hz"],
                "global_order_index": b["global_order_index"],
            }
            for b in bars_sorted
        ],
        "instruments": instruments,
        "build_stats": {
            "n_bars": len(bars_sorted),
            "n_instruments": len(INSTRUMENT_IDS),
            "total_duration_s": float(
                sum((b["measurements"]["f0"]["f0_window"]["end_s"] - b["measurements"]["f0"]["f0_window"]["start_s"]) for b in bars_sorted)
            ),
            "warnings": warnings,
        },
    }
    _json_dump(INDEX_PATH, index_payload)
    _json_dump(QC_PATH, {"generated_at": generated_at, "method_version": method_version, "bars": qc_entries})

    QC_README.parent.mkdir(parents=True, exist_ok=True)
    QC_README.write_text(
        "# QC report\n\n"
        "`reports/qc.json` contains per-bar flags:\n\n"
        "- `low_confidence`: f0 confidence < 0.6\n"
        "- `unstable_f0`: f0 IQR / median > 0.01\n"
        "- `suspicious_octave`: harmonic-grid checks suggest likely octave confusion\n"
        "- `too_few_peaks`: fewer than 5 summary spectral peaks\n"
        "- `f0_at_range_boundary`: corrected f0 or median ACF lag is near configured bounds\n"
        "- `harmonic_grid_mismatch`: harmonic-grid fit score for corrected f0 is below 0.45\n"
        "- `high_peak_not_near_harmonic`: strongest summary peak is not within 3% of a harmonic\n\n"
        "## Re-run\n\n"
        "```bash\npython scripts/build_dataset.py\n```\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    build_dataset()
