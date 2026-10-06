# qp library: the code

The verified primitive library, copied from `Tade-desk-server`
(`quant-platform/qp/` and `quant-platform/approvals/`), so a rebuild can
start from market math that has already been checked against TradingView.

What it is, how a primitive is defined and verified, and the deliberate
differences from Pine: [LIBRARY.md](../LIBRARY.md). Every primitive:
[CATALOG.md](../CATALOG.md).

## Contents

| Path | |
|---|---|
| `qp/__init__.py` | exports `REGISTRY`, `Bars`, `Param`, `PrimitiveMeta`, `approved_primitives`, `is_approved`, `get_approval` |
| `qp/registry.py` | the `@primitive` decorator, the registry, approvals reading and writing |
| `qp/primitives/` | the 71 primitives in 11 groups (each file is discovered automatically); `_session.py` holds shared session helpers and registers nothing; `bars.py` is the validated OHLCV container |
| `approvals/approvals.json` | one record per approved primitive: who, when, the commit approved |
| `tools/gen_catalog.py` | regenerates the catalogue from the registry (writes `docs/CATALOG.md` beside it) |

## Use

Python 3.9+, with `numpy` and `pandas`.

```sh
pip install numpy pandas
cd qp/library
python3 -c "import qp; print(len(qp.REGISTRY), len(qp.approved_primitives()))"
# 71 71
```

```python
import numpy as np, qp
close = np.arange(1, 21, dtype=float)
qp.REGISTRY['ma.sma'].fn(close, length=5)[-1]        # 18.0
qp.REGISTRY['vwap.session'].fn(qp.Bars.from_frame(df))  # df: UTC-indexed OHLCV
```

Checked when copied (2026-10-06): imports on its own, registers 71
primitives, all 71 approved, and `tools/gen_catalog.py` regenerates a
catalogue identical to [CATALOG.md](../CATALOG.md).

The verification page (`tools/compare_server.py`) and the bar loaders it uses
stay in the code repository; they need API keys and a running server.
