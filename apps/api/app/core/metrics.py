"""In-process Prometheus-compatible metrics (no external dependency)."""
from __future__ import annotations

import threading
import time
from collections import defaultdict
from typing import Any

_lock = threading.Lock()

_counters: dict[str, float] = defaultdict(float)
_histograms: dict[str, list[float]] = defaultdict(list)
_gauges: dict[str, float] = defaultdict(float)

# Cap histogram samples per metric to bound memory under load.
_HISTOGRAM_MAX_SAMPLES = 10_000


def inc(name: str, value: float = 1.0, labels: dict[str, str] | None = None) -> None:
    key = _key(name, labels)
    with _lock:
        _counters[key] += value


def observe(name: str, value: float, labels: dict[str, str] | None = None) -> None:
    key = _key(name, labels)
    with _lock:
        bucket = _histograms[key]
        bucket.append(value)
        if len(bucket) > _HISTOGRAM_MAX_SAMPLES:
            del bucket[: len(bucket) - _HISTOGRAM_MAX_SAMPLES]


def set_gauge(name: str, value: float, labels: dict[str, str] | None = None) -> None:
    key = _key(name, labels)
    with _lock:
        _gauges[key] = value


def _key(name: str, labels: dict[str, str] | None) -> str:
    if not labels:
        return name
    parts = ",".join(f'{k}="{v}"' for k, v in sorted(labels.items()))
    return f"{name}{{{parts}}}"


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    idx = int(len(sorted_vals) * pct / 100)
    idx = min(idx, len(sorted_vals) - 1)
    return sorted_vals[idx]


def render_prometheus() -> str:
    """Render metrics in Prometheus text exposition format."""
    lines: list[str] = []
    with _lock:
        counter_snap = dict(_counters)
        gauge_snap = dict(_gauges)
        hist_snap = {k: list(v) for k, v in _histograms.items()}

    for key, value in sorted(counter_snap.items()):
        base = key.split("{")[0]
        lines.append(f"# TYPE {base} counter")
        lines.append(f"{key} {value}")

    for key, value in sorted(gauge_snap.items()):
        base = key.split("{")[0]
        lines.append(f"# TYPE {base} gauge")
        lines.append(f"{key} {value}")

    for key, values in sorted(hist_snap.items()):
        base = key.split("{")[0]
        lines.append(f"# TYPE {base}_seconds summary")
        if values:
            lines.append(f'{key}_count {len(values)}')
            lines.append(f'{key}_sum {sum(values):.6f}')
            for pct in (50, 90, 95, 99):
                lines.append(f'{key}{{quantile="{pct / 100:.2f}"}} {_percentile(values, pct):.6f}')

    lines.append(f"# TYPE process_uptime_seconds gauge")
    lines.append(f"process_uptime_seconds {time.time() - _start_time:.3f}")
    return "\n".join(lines) + "\n"


_start_time = time.time()
