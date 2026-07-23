# NEET Prep — Data Folder Structure (Phase 2)

**Instruction to agent: check if these folders exist. If they do not exist,
create them exactly as specified below before running any ingestion script.
Do not proceed with Part A/B ingestion until this structure exists.**

## NCERT folder structure

```
data/ncert/
  Physics/
    Class11_Ch01_PhysicalWorld.pdf
    Class11_Ch02_UnitsAndMeasurement.pdf
    ...
    Class12_Ch01_ElectricCharges.pdf
    ...
  Chemistry/
    Class11_Ch01_SomeBasicConcepts.pdf
    ...
  Biology/
    Class11_Ch01_TheLivingWorld.pdf
    ...
```

**Naming pattern:** `Class{11|12}_Ch{NN}_{ChapterNameNoSpaces}.pdf`

**Extraction rule:**
- `subject` = parent folder name (`Physics` / `Chemistry` / `Biology`)
- `chapter` = filename after the `Ch{NN}_` prefix, with underscores
  replaced by spaces (e.g. `TheLivingWorld` → `The Living World`)
- Class (11/12) is available from the filename too if ever needed, but
  is not a required metadata field per the current schema.

**If a file doesn't match this pattern:** log it as a naming-convention
mismatch and skip it rather than guessing — do not silently force a
malformed filename into subject/chapter fields.

## PYQ folder structure

```
data/pyq/
  2023_Physics.pdf
  2023_Chemistry.pdf
  2023_Biology.pdf
  2022_Physics.pdf
  ...
```

**Naming pattern:** `{Year}_{Subject}.pdf`

**Extraction rule:**
- `year` = the 4-digit prefix
- `subject` = the part after the underscore, before `.pdf`

**If a file doesn't match this pattern:** log it and skip, same rule as
NCERT above.

## Setup instruction

- If `data/ncert/Physics`, `data/ncert/Chemistry`, `data/ncert/Biology`,
  or `data/pyq` do not already exist, create them now (empty is fine —
  I will drop the actual PDFs into them afterward).
- Do not create any other folders under `data/` beyond what's listed
  here unless a later spec explicitly asks for it.

## Note on syllabus exclusions (do not act on this yet)

Per Phase 2 spec: seed `syllabus_config` with `included = true` for
every chapter for now. The exact 6 excluded Biology chapters will be
provided separately later as a small follow-up update — do not run
`apply_exclusions.py` until that list is given.
