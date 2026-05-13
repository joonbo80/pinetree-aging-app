import json
import sys
import contextlib
import io
from pathlib import Path

sys.path.insert(0, str(Path.cwd() / "pydeps2"))
import xlrd  # type: ignore


def cell_value(book, cell):
    value = cell.value
    if cell.ctype == xlrd.XL_CELL_DATE:
        try:
            return xlrd.xldate_as_datetime(value, book.datemode).strftime("%Y-%m-%d")
        except Exception:
            return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if value == "":
        return None
    return value


def extract(path):
    with contextlib.redirect_stdout(io.StringIO()):
        book = xlrd.open_workbook(path, formatting_info=False)
    sheets = []
    for sheet in book.sheets():
        rows = []
        for r in range(sheet.nrows):
            rows.append([cell_value(book, sheet.cell(r, c)) for c in range(sheet.ncols)])
        sheets.append({"name": sheet.name, "columnCount": sheet.ncols, "rows": rows})
    return {"name": Path(path).name, "sheets": sheets}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: extract_workbook.py [--output out.json] <file.xls> [<file2.xls>...]", file=sys.stderr)
        sys.exit(2)
    args = sys.argv[1:]
    output = None
    if args[:2] and args[0] == "--output":
        output = args[1]
        args = args[2:]
    text = json.dumps([extract(path) for path in args], ensure_ascii=False)
    if output:
        Path(output).write_text(text, encoding="utf-8")
    else:
        print(text)
