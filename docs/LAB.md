# Lab — scored network & evidence inspector (3 Aug 2026)

**Audience:** CrowdLab / delivery only (not residents).  
**URL:** `/lab`  
**Resident product:** `/` — walk planning story of record.

## Purpose (reframed)

The lab is a **scored-network and evidence-layer inspector**:

- See Casey T1EAM segments with Day / Night / Accessibility scores  
- Dig into **why** a corridor looks the way it does (input layers under the score)  
- Spot-check trip geometries against the same hybrid stack the resident app uses  

It **may evolve** toward a Council dashboard later. Treat that as a horizon, not current scope — no stakeholder chrome, no grant-facing claims from `/lab` yet.

| Surface | Job |
|---------|-----|
| **`/` resident** | Tell us about your walk — prefs, A→B / Around here, match ranking |
| **`/lab`** | Verify scores + evidence layers; thin trip check |
| **`pipeline/viewer`** | Local ingestion QA map (flags, raw layers before / beside scoring) |

## What stays / what changes

### Bake-off panel — **minimise, don’t delete yet**

Hybrid routing is locked (ADR-001). The large OD bake-off UI earned that lock; it is no longer the lab’s centrepiece.

**Lean:** Collapse to a small **“OD regression”** drawer (load fixture OD, paint Mapbox vs challenger). Keep until a few more Casey starts look solid in resident, then retire if unused.

### Pipeline QA viewer — **keep for now**

`pipeline/viewer` + `build_viewer_layers.py` remain useful for **ingestion QA** (qa_flag, per-dataset GeoJSON, visual check after ingest). Lab supersedes it for **scored** inspection, not for raw “did this download look right?”

**Lean:** Do not delete the pipeline viewer yet. When lab has solid dataset toggles + QA-flag overlay, mark the pipeline viewer **optional / archive candidate** in `pipeline/README.md` and stop investing in new viewer features.

### Thin prefs / match in lab

Only as needed so trip verification doesn’t silently diverge from resident ranking (importance + prefer shared paths). Not a full Around-here / Loop clone unless a bug requires it.

## Build sequence (lab vNext)

1. ✅ Resident slice committed (duration slider, prefer shared paths, Day/Night → edit) — 3 Aug  
2. **Dataset toggles** on lab map — lighting first (AusNet/UE street lights + park/reserve lights), then other index inputs as needed  
3. Align lab trip plan with shared resident libs (hybrid + optional prefs/match)  
4. Collapse bake-off to OD regression drawer  
5. Later: Council-dashboard horizon (auth, curated layers, export) — separate decision  

## Relationship to methodology

- Index maths stay in **`docs/VULNERABILITY_INDEX.md` v1.1** and `pipeline/yourwalk_pipeline/scoring.py`  
- Lab shows **evidence and scores**; it does not invent new index weights  
- Overlays that are out of index (toilets, dog bags, etc.) may still appear as toggles for context  

## Trace

Resident UX: [`RESIDENT_UX_NEXT.md`](RESIDENT_UX_NEXT.md) · Routing ADR: [`DECISIONS.md`](DECISIONS.md) · Pipeline QA viewer: [`pipeline/README.md`](../pipeline/README.md) (Local QA map viewer)
