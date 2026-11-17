"""Build a compact, offline globe mask from Natural Earth's public-domain land data.

The source archive is the 1:50m physical land shapefile from naturalearthdata.com.
Only geometry is read; the shipped PNG has land in R and shorelines in G.
"""

from pathlib import Path
import struct
import zipfile

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "textures" / "ne_50m_land.zip"
TARGET = ROOT / "public" / "textures" / "earth-vector-mask.png"
WIDTH = 4096
HEIGHT = 2048


def project(lon, lat):
    return ((lon + 180.0) * WIDTH / 360.0, (90.0 - lat) * HEIGHT / 180.0)


def main():
    land = Image.new("L", (WIDTH, HEIGHT), 0)
    coast = Image.new("L", (WIDTH, HEIGHT), 0)
    land_draw = ImageDraw.Draw(land)
    coast_draw = ImageDraw.Draw(coast)
    rings = 0
    with zipfile.ZipFile(SOURCE) as archive:
        shp_name = next(name for name in archive.namelist() if name.endswith(".shp"))
        shape_bytes = archive.read(shp_name)
    offset = 100
    while offset < len(shape_bytes):
        content_words = struct.unpack_from(">I", shape_bytes, offset + 4)[0]
        record = memoryview(shape_bytes)[offset + 8 : offset + 8 + content_words * 2]
        shape_type = struct.unpack_from("<I", record, 0)[0]
        offset += 8 + content_words * 2
        if shape_type == 0:
            continue
        if shape_type != 5:
            raise ValueError(f"Expected polygon shapefile, got shape type {shape_type}")
        part_count, point_count = struct.unpack_from("<II", record, 36)
        parts = list(struct.unpack_from(f"<{part_count}I", record, 44)) + [point_count]
        points_offset = 44 + part_count * 4
        for index in range(part_count):
            coordinates = [
                struct.unpack_from("<dd", record, points_offset + point_index * 16)
                for point_index in range(parts[index], parts[index + 1])
            ]
            if len(coordinates) < 3:
                continue
            # Unwrap each successive point so dateline edges stay short. Entire
            # Eurasian rings legitimately span both hemispheres, so shifting
            # every negative longitude would fill wide horizontal bands.
            unwrapped = [coordinates[0]]
            for lon, lat in coordinates[1:]:
                previous_lon = unwrapped[-1][0]
                lon += round((previous_lon - lon) / 360.0) * 360.0
                unwrapped.append((lon, lat))
            projected = [project(lon, lat) for lon, lat in unwrapped]
            for shift in (-WIDTH, 0, WIDTH):
                shifted = [(x + shift, y) for x, y in projected]
                land_draw.polygon(shifted, fill=255)
                coast_draw.line(shifted, fill=220, width=2, joint="curve")
            rings += 1
    red = land
    green = coast
    blue = Image.new("L", (WIDTH, HEIGHT), 0)
    Image.merge("RGB", (red, green, blue)).save(TARGET, optimize=True)
    print(f"Wrote {TARGET} from {rings} polygon rings")


if __name__ == "__main__":
    main()
