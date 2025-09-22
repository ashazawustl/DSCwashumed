#!/usr/bin/env python3
"""
Boilerplate Python code for data parsing.
Supports CSV, JSON, and plain text formats.
"""

import argparse
import csv
import json
import sys
from typing import List, Dict, Any


def parse_csv(filepath: str) -> List[Dict[str, Any]]:
    """Parse a CSV file into a list of dictionaries."""
    try:
        with open(filepath, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            return list(reader)
    except Exception as e:
        sys.exit(f"Error parsing CSV: {e}")


def parse_json(filepath: str) -> Any:
    """Parse a JSON file into Python objects."""
    try:
        with open(filepath, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        sys.exit(f"Error parsing JSON: {e}")


def parse_text(filepath: str) -> List[str]:
    """Parse a plain text file line by line."""
    try:
        with open(filepath, encoding="utf-8") as f:
            return [line.strip() for line in f if line.strip()]
    except Exception as e:
        sys.exit(f"Error parsing text file: {e}")


def main():
    parser = argparse.ArgumentParser(description="Generic data parser.")
    parser.add_argument("filepath", help="Path to the data file")
    parser.add_argument(
        "--format",
        choices=["csv", "json", "text"],
        required=True,
        help="File format to parse",
    )
    args = parser.parse_args()

    if args.format == "csv":
        data = parse_csv(args.filepath)
    elif args.format == "json":
        data = parse_json(args.filepath)
    elif args.format == "text":
        data = parse_text(args.filepath)
    else:
        sys.exit("Unsupported format.")

    print("Parsed data:")
    print(data)


if __name__ == "__main__":
    main()
