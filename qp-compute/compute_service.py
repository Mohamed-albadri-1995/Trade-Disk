"""
qp-compute — a thin HTTP service over the REAL qp library.

It does no market math of its own and fetches no data: the caller (Trade-Disk)
POSTs OHLCV bars + a list of indicator specs, and this returns the exact series
your `qp.primitives` produce — the SAME code your Python algo imports. One
implementation for the chart, the backtest and live trading, so a backtest can
never disagree with the strategy that runs.

The `qp/` package here is a byte-for-byte copy of Tade-desk-server's qp library,
pinned to the sha in QP_SOURCE_SHA.txt. The algo must import the same qp version;
re-sync by re-copying qp/ + approvals/ from that repo and bumping the sha.

Endpoints (all JSON):
  GET  /health      → { ok, primitives }
  GET  /primitives  → the full catalog (name, group, params, inputs, outputs,
                      compute_tf, approval) — what the UI's picker reads
  POST /compute     → { bars:[{t,o,h,l,c,v}], overlays:[{id?,key,source?,params?}] }
                      → { series:[ {id,key,values:[..|null]} | {id,key,lines:{..}} | {id,key,error} ] }

Optional shared-secret: set QP_COMPUTE_TOKEN; callers send it as X-QP-Token.
"""
from __future__ import annotations

import os

import numpy as np
import pandas as pd
from fastapi import Body, FastAPI, Header, HTTPException

import qp.primitives  # noqa: F401  — importing triggers every @primitive registration
from qp.registry import REGISTRY, get_approval
from qp.primitives.bars import Bars

TOKEN = os.environ.get("QP_COMPUTE_TOKEN", "")
ET = "America/New_York"

app = FastAPI(title="qp-compute", version="1.0")

# short name ('sma') → full key ('ma.sma'); keys are globally unique by short name.
_NAME_TO_KEY = {m.name: k for k, m in REGISTRY.items()}


def _resolve(key: str):
    """A spec may name a primitive by full key ('ma.sma') or short name ('sma')."""
    if not key:
        return None
    if key in REGISTRY:
        return REGISTRY[key]
    if key in _NAME_TO_KEY:
        return REGISTRY[_NAME_TO_KEY[key]]
    return None


def _source_series(df: pd.DataFrame, name: str) -> np.ndarray:
    if name == "close":  return df["close"].to_numpy(dtype=float)
    if name == "open":   return df["open"].to_numpy(dtype=float)
    if name == "high":   return df["high"].to_numpy(dtype=float)
    if name == "low":    return df["low"].to_numpy(dtype=float)
    if name == "volume": return df["volume"].to_numpy(dtype=float)
    if name == "hl2":    return ((df["high"] + df["low"]) / 2.0).to_numpy(dtype=float)
    if name == "hlc3":   return ((df["high"] + df["low"] + df["close"]) / 3.0).to_numpy(dtype=float)
    if name == "ohlc4":  return ((df["open"] + df["high"] + df["low"] + df["close"]) / 4.0).to_numpy(dtype=float)
    if name == "body_high": return np.maximum(df["open"].to_numpy(dtype=float), df["close"].to_numpy(dtype=float))
    if name == "body_low":  return np.minimum(df["open"].to_numpy(dtype=float), df["close"].to_numpy(dtype=float))
    raise ValueError(f"unknown source {name!r}")


def _call_primitive(m, frame: pd.DataFrame, source: str, kwargs: dict):
    if list(m.inputs) == ["bars"]:
        return m.fn(Bars.from_frame(frame), **kwargs)
    if list(m.inputs) == ["source"]:
        return m.fn(_source_series(frame, source), **kwargs)
    raise ValueError(f"unsupported inputs {m.inputs!r} on {m.key}")


def _coerce_params(m, given: dict) -> dict:
    """Cast each declared param to its kind + clamp to min/max, defaulting
    anything the caller omitted — exactly as the library expects."""
    out = {}
    for p in m.params:
        v = given.get(p.name)
        if v is None:
            v = p.default
        try:
            if p.kind == "int":
                v = int(round(float(v)))
            elif p.kind == "float":
                v = float(v)
            elif p.kind == "bool":
                v = bool(v)
            elif p.kind == "str":
                v = str(v)
        except (TypeError, ValueError):
            v = p.default
        if p.min is not None and v is not None and v < p.min:
            v = p.min
        if p.max is not None and v is not None and v > p.max:
            v = p.max
        out[p.name] = v
    return out


def _frame(bars: list) -> pd.DataFrame:
    """Build the tz-aware (ET) OHLCV DataFrame the primitives require."""
    idx = pd.to_datetime([int(b["t"]) for b in bars], unit="s", utc=True).tz_convert(ET)
    df = pd.DataFrame(
        {
            "open":   [float(b["o"]) for b in bars],
            "high":   [float(b["h"]) for b in bars],
            "low":    [float(b["l"]) for b in bars],
            "close":  [float(b["c"]) for b in bars],
            "volume": [float(b.get("v") or 0.0) for b in bars],
        },
        index=idx,
    )
    if not df.index.is_monotonic_increasing:
        df = df.sort_index()
    return df


def _safe(arr) -> list:
    out = []
    for v in np.asarray(arr, dtype=float):
        out.append(None if (v is None or np.isnan(v) or np.isinf(v)) else float(v))
    return out


def _auth(tok: str):
    if TOKEN and tok != TOKEN:
        raise HTTPException(status_code=401, detail="bad or missing X-QP-Token")


@app.get("/health")
def health():
    return {"ok": True, "primitives": len(REGISTRY), "source_sha": _sha()}


def _sha() -> str:
    try:
        with open(os.path.join(os.path.dirname(__file__), "QP_SOURCE_SHA.txt")) as f:
            return f.read().strip()
    except Exception:
        return ""


@app.get("/primitives")
def primitives(x_qp_token: str = Header(default="")):
    _auth(x_qp_token)
    out = []
    for key in sorted(REGISTRY):
        m = REGISTRY[key]
        appr = get_approval(key)
        out.append({
            "key": m.key, "name": m.name, "group": m.group, "description": m.description,
            "params": [{"name": p.name, "kind": p.kind, "default": p.default, "min": p.min, "max": p.max, "description": p.description} for p in m.params],
            "inputs": list(m.inputs), "outputs": list(m.outputs),
            "compute_tf": m.compute_tf, "approved": appr is not None,
        })
    return {"primitives": out, "count": len(out), "source_sha": _sha()}


@app.post("/compute")
def compute(payload: dict = Body(...), x_qp_token: str = Header(default="")):
    _auth(x_qp_token)
    bars = payload.get("bars") or []
    overlays = payload.get("overlays") or []
    if not bars:
        return {"series": [], "n": 0}
    df = _frame(bars)
    series = []
    for ov in overlays:
        oid = ov.get("id")
        key = ov.get("key") or ov.get("name")
        m = _resolve(key)
        if m is None:
            series.append({"id": oid, "key": key, "error": "unknown primitive", "values": []})
            continue
        try:
            kwargs = _coerce_params(m, dict(ov.get("params") or {}))
            res = _call_primitive(m, df, ov.get("source") or "close", kwargs)
        except Exception as e:  # one bad overlay must not fail the whole request
            series.append({"id": oid, "key": m.key, "error": str(e), "values": []})
            continue
        if isinstance(res, dict):
            series.append({"id": oid, "key": m.key, "lines": {k: _safe(v) for k, v in res.items()}, "outputs": list(m.outputs)})
        else:
            series.append({"id": oid, "key": m.key, "values": _safe(res)})
    return {"series": series, "n": len(bars)}
