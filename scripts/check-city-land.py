"""Read-only check of conceptual city anchors against the shipped Earth land mask.

Optional QA helper: python scripts/check-city-land.py (requires Pillow).
It does not validate exact building footprints or the higher-resolution coastline.
"""

from pathlib import Path
import re

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
city_source = (ROOT / "lib/cities.ts").read_text(encoding="utf-8")
signature_source = (ROOT / "lib/city-signatures.ts").read_text(encoding="utf-8")
mask = Image.open(ROOT / "public/textures/earth-vector-mask.png")


def land(lat: float, lon: float) -> bool:
    x = round((lon + 180) * mask.width / 360)
    y = round((90 - lat) * mask.height / 180)
    return mask.getpixel((x, y))[0] > 128


cities = re.findall(r'id: "([^"]+)".*?lat: (-?[0-9.]+), lon: (-?[0-9.]+)', city_source)
signatures = {}
for line in signature_source.splitlines():
    match = re.match(r'  ("[^"]+"|[\w-]+): \{.*?displayLat: (-?[0-9.]+), displayLon: (-?[0-9.]+)', line)
    if match:
        signatures[match.group(1).strip('"')] = float(match.group(2)), float(match.group(3))
for match in re.finditer(r'  ([\w-]+): \{ lat: (-?[0-9.]+), lon: (-?[0-9.]+) \}', signature_source):
    signatures[match.group(1)] = float(match.group(2)), float(match.group(3))

for city_id, raw_lat, raw_lon in cities:
    lat, lon = signatures.get(city_id, (float(raw_lat), float(raw_lon)))
    if not land(lat, lon):
        print(f"MASK-WATER {city_id:20} {lat:9.5f} {lon:10.5f}")

print(f"Checked {len(cities)} city anchors against {mask.width}×{mask.height} mask")
