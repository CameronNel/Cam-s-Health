"""Build the public food module from the pinned USDA SR Legacy ASCII archive."""
import csv
import hashlib
import io
import json
from pathlib import Path
import sys
import zipfile

archive = Path(sys.argv[1]).read_bytes()
expected = "79705f75a7306d0910ad16dd4d66a5caf602dad528b99b77c7a510bfaf3d6e14"
if hashlib.sha256(archive).hexdigest() != expected:
    raise SystemExit("Archive does not match the documented SR Legacy snapshot.")
with zipfile.ZipFile(io.BytesIO(archive)) as source:
    def rows(name):
        return csv.reader(io.StringIO(source.read(name).decode("latin-1")), delimiter="^", quotechar="~")
    foods = list(rows("FOOD_DES.txt"))
    if len(foods) != 7793:
        raise SystemExit("Unexpected USDA food record count.")
    nutrients = {f[0]: {} for f in foods}
    portions = {}
    for row in rows("NUT_DATA.txt"):
        if row[1] in ["208", "203", "205", "204"]:
            nutrients[row[0]][row[1]] = float(row[2])
    for row in rows("WEIGHT.txt"):
        if float(row[2]) > 0 and float(row[4]) > 0:
            portions.setdefault(row[0], []).append([float(row[2]), row[3], float(row[4])])
    result = [[f[0], f[2], *[nutrients[f[0]].get(n) for n in ["208", "203", "205", "204"]], portions.get(f[0], [])] for f in foods]
module = "// USDA SR Legacy (2018), CC0. See docs/FOOD-LOOKUP.md for provenance.\nexport const FOOD_CATALOG=" + json.dumps(result, ensure_ascii=False, separators=(",", ":")) + ";\n"
Path("dist/food-catalog.js").write_text(module, encoding="utf-8")
print("Built the public USDA catalog:", len(result), "foods.")
