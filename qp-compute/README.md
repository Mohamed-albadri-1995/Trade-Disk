# qp-compute

A thin HTTP service over the **real qp library** (`qp/primitives`), the single
source of truth for indicator math shared by the Trade-Disk chart, the backtest,
and the live Python algo — so a backtest can never disagree with what trades.

- `qp/` + `approvals/` are a **byte-for-byte copy** of `Tade-desk-server/quant-platform`,
  pinned to the sha in `QP_SOURCE_SHA.txt`. Do not edit here. Re-sync by re-copying
  `qp/` and `approvals/` from that repo and bumping the sha. The algo must import the
  same qp version.
- No feeds, no auth, no DB: the caller POSTs bars; this returns the exact series.

## Endpoints
- `GET  /health`      → `{ ok, primitives }`
- `GET  /primitives`  → the full catalog (name, group, params, inputs, outputs, compute_tf)
- `POST /compute`     → `{ bars:[{t,o,h,l,c,v}], overlays:[{id?,key,source?,params?}] }`
                        → `{ series:[ {id,key,values:[..|null]} | {id,key,lines:{..}} | {id,key,error} ] }`

Optional shared secret: set `QP_COMPUTE_TOKEN`; callers send `X-QP-Token`.

## Run (Railway: Nixpacks detects Python via requirements.txt)
`uvicorn compute_service:app --host 0.0.0.0 --port $PORT`
