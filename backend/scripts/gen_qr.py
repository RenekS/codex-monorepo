#!/usr/bin/env python3
"""
scripts/gen_qr.py

Generuje QR kód s jedním pozičním argumentem a explicitním mode,
fallback na vyšší verzi, bez multiple-values chyb.
"""

import sys, io, re
import segno
from segno import DataOverflowError
from PIL import Image

# 1. Rozdělení CLI
argv    = sys.argv[1:]
opt_idx = next((i for i,a in enumerate(argv) if a.startswith('--')), len(argv))
data    = argv[0] if argv else ''
opts    = argv[1:] if opt_idx>0 else []

if not data:
    sys.stderr.write("ERROR: Zadejte parametr data\n")
    sys.exit(1)

def flag(name, default=None, cast=str):
    return cast(opts[opts.index(name)+1]) if name in opts else default

# 2. Načtení voleb
fmt    = flag('--format',  'png')     # png|svg|jpg
errlev = flag('--error',   'q').lower()# l|m|q|h
ver_in = flag('--version', 3, int)    # chceme verzi 3
border = flag('--border',  4, int)
scale  = flag('--scale',   1, int)

# 3. Vytvoří QR, Segno samo rozdělí režimy
def make_qr(version):
    return segno.make(
        data,
        mode        = ['alphanumeric','numeric'],
        error       = errlev,
        version     = (version or None),
        boost_error = False   # bez skrytého navyšování ECC
    )

# 4. Fallback na vyšší verzi
try:
    qr = make_qr(ver_in)
except DataOverflowError as e:
    m = re.search(r'Proposal: version\s*(\d+)', str(e))
    if not m:
        raise
    qr = make_qr(int(m.group(1)))

# 5. Výstup
buf = io.BytesIO()
if fmt == 'svg':
    qr.save(buf, kind='svg', border=border)
    sys.stdout.buffer.write(buf.getvalue())
else:
    qr.save(buf, kind='png', scale=scale, border=border)
    buf.seek(0)
    if fmt == 'png':
        sys.stdout.buffer.write(buf.getvalue())
    else:
        img = Image.open(buf).convert('RGB')
        out = io.BytesIO()
        img.save(out, 'JPEG', quality=95)
        sys.stdout.buffer.write(out.getvalue())
