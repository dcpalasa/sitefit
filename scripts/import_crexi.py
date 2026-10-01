#!/usr/bin/env python3
"""
Convert a CREXi Excel export into the private JSON format used by SiteFit.

No third-party packages are required. The script reads the .xlsx ZIP/XML
structure directly, which keeps setup simple on a fresh clone.

Usage:
    python scripts/import_crexi.py path/to/Sales_Export.xlsx
    python scripts/import_crexi.py path/to/Sales_Export.xlsx --output data/private/properties.json
"""
from __future__ import annotations

import argparse
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

CITY_ALIASES = {
    "RALEIGH": "Raleigh",
    "raleigh": "Raleigh",
    "FUQUAY-VARINA": "Fuquay-Varina",
    "FUQUAY VARINA": "Fuquay-Varina",
    "Fuquay Varina": "Fuquay-Varina",
    "WENDELL": "Wendell",
    "KNIGHTDALE": "Knightdale",
    "ZEBULON": "Zebulon",
    "CLAYTON": "Clayton",
    "HOLLY SPRINGS": "Holly Springs",
    "APEX": "Apex",
}

HEADERS = [
    "Property Link", "Property Name", "Property Status", "Type", "Property Subtype",
    "Address", "City", "State", "Zip", "County", "Tenant(s)", "SqFt", "Year Built",
    "Lot Size", "Price/Unit", "NOI", "Cap Rate", "Asking Price", "Price/SqFt",
    "Price/Acre", "Days on Market", "Longitude", "Latitude"
]


def column_index(cell_ref: str) -> int:
    letters = re.match(r"[A-Z]+", cell_ref).group(0)
    value = 0
    for ch in letters:
        value = value * 26 + (ord(ch) - 64)
    return value - 1


def read_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    name = "xl/sharedStrings.xml"
    if name not in zf.namelist():
        return []
    root = ET.fromstring(zf.read(name))
    out = []
    for si in root.findall("m:si", NS):
        out.append("".join(t.text or "" for t in si.findall(".//m:t", NS)))
    return out


def first_worksheet_path(zf: zipfile.ZipFile) -> str:
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rel_ns = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
    relation_map = {r.attrib["Id"]: r.attrib["Target"] for r in rels.findall("r:Relationship", rel_ns)}

    sheet = workbook.find("m:sheets/m:sheet", NS)
    rel_id = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
    target = relation_map[rel_id]
    if target.startswith("/"):
        return target.lstrip("/")
    return "xl/" + target.lstrip("./")


def cell_value(cell: ET.Element, shared: list[str]):
    cell_type = cell.attrib.get("t")
    value = cell.find("m:v", NS)
    inline = cell.find("m:is", NS)

    if cell_type == "inlineStr" and inline is not None:
        return "".join(t.text or "" for t in inline.findall(".//m:t", NS))
    if value is None:
        return None

    raw = value.text
    if cell_type == "s":
        return shared[int(raw)]
    if cell_type in {"str", "e"}:
        return raw

    try:
        number = float(raw)
        return int(number) if number.is_integer() else number
    except (TypeError, ValueError):
        return raw


def read_rows(path: Path) -> list[list]:
    with zipfile.ZipFile(path) as zf:
        shared = read_shared_strings(zf)
        sheet_path = first_worksheet_path(zf)
        root = ET.fromstring(zf.read(sheet_path))

        rows = []
        for row_el in root.findall(".//m:sheetData/m:row", NS):
            values = [None] * 23
            for cell in row_el.findall("m:c", NS):
                idx = column_index(cell.attrib["r"])
                if idx < len(values):
                    values[idx] = cell_value(cell, shared)
            rows.append(values)
        return rows


def clean_string(value):
    if value is None:
        return None
    text = str(value).strip()
    return None if not text or text.upper() == "N/A" else text


def as_number(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).replace("$", "").replace(",", "").replace("%", "").strip()
    if not text or text.upper() == "N/A":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def as_int(value):
    value = as_number(value)
    return int(round(value)) if value is not None else None


def normalize_city(value, zip_code=None):
    if value is None:
        return None
    text = str(value).strip()

    # One malformed city value was present in the 2026-10-01 export:
    # 6724 Wimberly Road had "95056" in City, while ZIP 27592 is Willow Spring.
    if text == "95056" and str(zip_code).startswith("27592"):
        return "Willow Spring"

    if text in CITY_ALIASES:
        return CITY_ALIASES[text]
    if text.isupper():
        return text.title()
    return text


def convert(rows: list[list]) -> list[dict]:
    header_row = None
    for i, row in enumerate(rows):
        if row and row[0] == "Property Link":
            header_row = i
            break
    if header_row is None:
        raise ValueError("Could not find the CREXi header row.")

    headers = rows[header_row]
    index = {name: i for i, name in enumerate(headers) if name}
    missing = [h for h in HEADERS if h not in index]
    if missing:
        raise ValueError(f"Missing expected columns: {missing}")

    properties = []
    for row_num, row in enumerate(rows[header_row + 1 :], start=1):
        if not any(v is not None for v in row):
            continue

        link = clean_string(row[index["Property Link"]])
        match = re.search(r"/properties/(\d+)", link or "")
        prop_id = match.group(1) if match else str(row_num)
        zip_raw = row[index["Zip"]]

        zip_code = str(int(zip_raw)) if isinstance(zip_raw, (int, float)) else clean_string(zip_raw)
        prop = {
            "id": prop_id,
            "name": clean_string(row[index["Property Name"]]) or f"Property {prop_id}",
            "status": clean_string(row[index["Property Status"]]) or "Unknown",
            "type": clean_string(row[index["Type"]]) or "Other",
            "subtype": clean_string(row[index["Property Subtype"]]),
            "address": clean_string(row[index["Address"]]),
            "city": normalize_city(row[index["City"]], zip_raw),
            "state": clean_string(row[index["State"]]) or "NC",
            "zip": zip_code,
            "county": clean_string(row[index["County"]]),
            "tenants": clean_string(row[index["Tenant(s)"]]),
            "sqft": as_int(row[index["SqFt"]]),
            "yearBuilt": as_int(row[index["Year Built"]]),
            "lotAcres": as_number(row[index["Lot Size"]]),
            "noi": as_number(row[index["NOI"]]),
            "capRate": as_number(row[index["Cap Rate"]]),
            "askingPrice": as_number(row[index["Asking Price"]]),
            "pricePerSqft": as_number(row[index["Price/SqFt"]]),
            "pricePerAcre": as_number(row[index["Price/Acre"]]),
            "daysOnMarket": as_int(row[index["Days on Market"]]),
            "longitude": as_number(row[index["Longitude"]]),
            "latitude": as_number(row[index["Latitude"]]),
            "sourceUrl": link,
        }
        properties.append(prop)
    return properties


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path, help="CREXi .xlsx export")
    parser.add_argument("--output", type=Path, default=Path("data/private/properties.json"))
    args = parser.parse_args()

    rows = read_rows(args.input)
    properties = convert(rows)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(properties, indent=2), encoding="utf-8")
    print(f"Wrote {len(properties)} properties to {args.output}")


if __name__ == "__main__":
    main()
