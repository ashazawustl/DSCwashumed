"""Parse Batch 2 Pre-Scan TXT reports and produce a CSV summary.

Writes: batch2_pre_scan_summary.csv next to this script.
"""
import re
from pathlib import Path
import csv

ROOT = Path(r"c:\Users\hanss\Downloads\DEXA Scans (1)\DEXA Scans\Batch 2\Pre-Scan")
OUT = Path(__file__).resolve().parent / "batch2_pre_scan_summary.csv"

# Fields to extract
FIELDS = [
    "filename",
    "sex",
    "reference_image",
    "sample_area_cm2",
    "bone_area_cm2",
    "total_weight_g",
    "soft_weight_g",
    "lean_weight_g",
    "fat_weight_g",
    "fat_percent",
    "BMC_g",
    "BMD_mg_per_cm2",
]

# Regex helpers
re_ref = re.compile(r"Reference Image:\s*(.+)")
re_num = lambda name: re.compile(rf"{re.escape(name)}:\s*([0-9.+-]+)")

patterns = {
    "sample_area_cm2": re.compile(r"Sample Area:\s*([0-9.]+)\s*cm\^2"),
    "bone_area_cm2": re.compile(r"Bone Area:\s*([0-9.]+)\s*cm\^2"),
    "total_weight_g": re.compile(r"Total Weight:\s*([0-9.]+)\s*g"),
    "soft_weight_g": re.compile(r"Soft Weight:\s*([0-9.]+)\s*g"),
    "lean_weight_g": re.compile(r"Lean Weight:\s*([0-9.]+)\s*g"),
    "fat_weight_g": re.compile(r"Fat Weight:\s*([0-9.]+)\s*g"),
    "fat_percent": re.compile(r"Fat Percent:\s*([0-9.]+)"),
    "BMC_g": re.compile(r"BMC:\s*([0-9.]+)\s*g"),
    "BMD_mg_per_cm2": re.compile(r"BMD:\s*([0-9.]+)\s*mg/cm\^2"),
}

rows = []

for sex_dir in [ROOT / "Male", ROOT / "Female"]:
    if not sex_dir.exists():
        continue
    for txt in sex_dir.glob("*.txt"):
        text = txt.read_text(encoding="utf-8", errors="replace")
        row = {k: "" for k in FIELDS}
        row["filename"] = txt.name
        row["sex"] = sex_dir.name
        m = re_ref.search(text)
        if m:
            row["reference_image"] = m.group(1).strip()
        for key, pat in patterns.items():
            m = pat.search(text)
            if m:
                row[key] = m.group(1)
        rows.append(row)

# Write CSV
with OUT.open("w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=FIELDS)
    w.writeheader()
    for r in rows:
        w.writerow(r)

print(f"Wrote {len(rows)} rows to: {OUT}")
