import csv
import html
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_csv_rows(csv_path):
    with csv_path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.reader(handle))


def column_name(index):
    name = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        name = chr(65 + remainder) + name
    return name


def sheet_xml(rows):
    row_xml = []
    for row_index, row in enumerate(rows, start=1):
        cells = []
        for col_index, value in enumerate(row, start=1):
            cell_ref = f"{column_name(col_index)}{row_index}"
            safe_value = html.escape(str(value))
            cells.append(f'<c r="{cell_ref}" t="inlineStr"><is><t>{safe_value}</t></is></c>')
        row_xml.append(f'<row r="{row_index}">{"".join(cells)}</row>')

    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    {"".join(row_xml)}
  </sheetData>
</worksheet>'''


def write_xlsx(csv_name, xlsx_name):
    rows = read_csv_rows(ROOT / "data" / csv_name)
    destination = ROOT / "data" / xlsx_name
    files = {
        "[Content_Types].xml": '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>''',
        "_rels/.rels": '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>''',
        "xl/workbook.xml": '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>''',
        "xl/_rels/workbook.xml.rels": '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>''',
        "xl/worksheets/sheet1.xml": sheet_xml(rows),
    }

    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for internal_path, content in files.items():
            archive.writestr(internal_path, content)


write_xlsx("credentials.csv", "credentials.xlsx")
write_xlsx("degrees.csv", "degrees.xlsx")
write_xlsx("default_subjects.csv", "default_subjects.xlsx")
print("Created data/credentials.xlsx, data/degrees.xlsx, and data/default_subjects.xlsx")
