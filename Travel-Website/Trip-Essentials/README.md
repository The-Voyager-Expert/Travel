# Trips — Workshop Folder

Self-contained workspace for the Trips system. Open, edit, rebuild — everything you need is right here.

All files live in `Travel/Trip Essentials/`. If one wanders out, the folder name is the home — restore it here. (The owner-name prefix `the owner Hubby Trips - ` was dropped from every filename on 2026-05-14; pre-rename copies are in `Travel/archive/the owner_Hubby_Trips_pre-rename-20260514/`.)

## What's in this folder

| File | What it is |
|------|------------|
| **`Trips.html`** | **Primary edit target for trip data.** Per-trip rows, TOP/BOTTOM layout (Hubby writes top, owner writes below). Claude edits this file. Read directly with the Read tool. |
| **`Trips - Rules.md`** | Structural and content decisions for `Trips.html` — trip order, archive-vs-past-trips boundaries, badge usage, formatting conventions. Read this before editing `Trips.html`. |
| **`Archive 2026 Jan-Apr.html`** | **Read-only historical archive.** Completed trips from January–April 2026, separated from the live `Trips.html` for clarity. Never edited. |
| **`README.md`** | This file. (Was `the owner Hubby Trips - README.md` pre-2026-05-14.) |

*Retired 2026-05-18 (no longer in this folder; archived to `Travel/archive/` per the dated retirement entry there): `Specs.html`, `_style.css`, `trips_validator.py`, `trips_fixer.py`. The spec and validators have been consolidated into `Trips - Rules.md` and the regular guide validators.*

## Three separate systems in this workspace

This folder is the **third** of three independent systems:

1. **Core rules** — `Brain/CORE RULES/` + `Universal Formatting Rules/` — rules for building city guides
2. **Guide** — `Guides/guide-style.css` + `Guides/` — the rendered city guide deliverable
3. **Trips** — *this folder* — the per-trip data sheet

## The HTML workflow

### Trip data
**Claude edits `Trips.html`** whenever a booking lands, a flight date changes, or any trip data updates. HTML is the source of truth — read directly with the Read tool. Read `Trips - Rules.md` first for the structural conventions.

