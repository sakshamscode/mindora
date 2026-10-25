import os
import zlib
import struct
import math

def generate_mindora_icon(size):
    # Supersample 2x for smooth edges
    scale = 2
    w = size * scale
    h = size * scale
    
    # We will generate a rounded squircle badge in indigo/violet with a crisp modern "M" logo
    pixels = []
    
    center = w / 2.0
    radius = w * 0.44
    corner_radius = w * 0.22
    
    # Color palette
    # Background gradient: from top-left (79, 70, 229) [indigo-600] to bottom-right (147, 51, 234) [purple-600]
    # Letter / Mark: Crisp White (255, 255, 255)
    
    def in_rounded_rect(px, py, rx, ry, rw, rh, rad):
        # Check if inside rounded rectangle
        if px < rx or px > rx + rw or py < ry or py > ry + rh:
            return False
        dx = max(rx + rad - px, 0, px - (rx + rw - rad))
        dy = max(ry + rad - py, 0, py - (ry + rh - rad))
        return (dx * dx + dy * dy) <= (rad * rad)

    # Bounding box for the rounded rect
    margin = w * 0.06
    rw = w - 2 * margin
    rh = h - 2 * margin
    rx = margin
    ry = margin
    rad = w * 0.24

    for y in range(h):
        for x in range(w):
            if in_rounded_rect(x + 0.5, y + 0.5, rx, ry, rw, rh, rad):
                # Gradient interpolation
                t = ((x / w) + (y / h)) / 2.0
                r_bg = int(79 + (124 - 79) * t)
                g_bg = int(70 + (58 - 70) * t)
                b_bg = int(229 + (237 - 229) * t)
                
                # Draw the Mindora "M" emblem:
                # Two vertical pillars and a central chevron pointing down
                nx = (x - margin) / rw  # 0 to 1 inside badge
                ny = (y - margin) / rh  # 0 to 1 inside badge
                
                is_m = False
                # Left leg: nx between 0.22 and 0.35, ny between 0.25 and 0.75
                if 0.22 <= nx <= 0.34 and 0.25 <= ny <= 0.75:
                    is_m = True
                # Right leg: nx between 0.66 and 0.78, ny between 0.25 and 0.75
                elif 0.66 <= nx <= 0.78 and 0.25 <= ny <= 0.75:
                    is_m = True
                # Left diagonal: from (0.28, 0.25) to (0.50, 0.58)
                elif 0.28 <= nx <= 0.52 and 0.25 <= ny <= 0.62:
                    # Line equation: ny - 0.25 = 1.375 * (nx - 0.28)
                    target_y = 0.25 + 1.35 * (nx - 0.28)
                    if abs(ny - target_y) <= 0.08:
                        is_m = True
                # Right diagonal: from (0.72, 0.25) to (0.50, 0.58)
                elif 0.48 <= nx <= 0.72 and 0.25 <= ny <= 0.62:
                    target_y = 0.25 + 1.35 * (0.72 - nx)
                    if abs(ny - target_y) <= 0.08:
                        is_m = True
                # Central spark / diamond accent above the V: small star or dot at top center
                if 0.45 <= nx <= 0.55 and 0.68 <= ny <= 0.76:
                    # subtle spark accent
                    is_m = True

                if is_m:
                    pixels.append((255, 255, 255, 255))
                else:
                    pixels.append((r_bg, g_bg, b_bg, 255))
            else:
                pixels.append((0, 0, 0, 0)) # Transparent

    # Downsample from w*h to size*size (box filter)
    downsampled = bytearray()
    for sy in range(size):
        downsampled.append(0) # PNG filter type 0
        for sx in range(size):
            r_sum = 0
            g_sum = 0
            b_sum = 0
            a_sum = 0
            for dy in range(scale):
                for dx in range(scale):
                    px_idx = (sy * scale + dy) * w + (sx * scale + dx)
                    p = pixels[px_idx]
                    r_sum += p[0]
                    g_sum += p[1]
                    b_sum += p[2]
                    a_sum += p[3]
            count = scale * scale
            downsampled.extend((
                r_sum // count,
                g_sum // count,
                b_sum // count,
                a_sum // count
            ))

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    idat = chunk(b'IDAT', zlib.compress(bytes(downsampled)))
    iend = chunk(b'IEND', b'')
    return header + ihdr + idat + iend

os.makedirs('assets/icons', exist_ok=True)
for sz in [16, 32, 48, 128]:
    png_bytes = generate_mindora_icon(sz)
    path = f'assets/icons/icon-{sz}.png'
    with open(path, 'wb') as f:
        f.write(png_bytes)
    print(f'Generated {path} ({len(png_bytes)} bytes)')
