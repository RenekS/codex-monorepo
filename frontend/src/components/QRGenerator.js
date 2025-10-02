// src/components/QRGenerator.js
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  TextField,
  Typography,
  Grid,
  Paper,
  CircularProgress
} from '@mui/material';

// Tři varianty: uncompressed, segmented, compressed
const VARIANTS = [
  { id: 1, name: 'Uncompressed 4Q', version: 4, ecc: 'Q', margin: 4, cyl: true },
  { id: 2, name: 'Segmented 3Q',    version: 3, ecc: 'Q', margin: 4, cyl: true },
  { id: 3, name: 'Compressed 2Q',   version: 2, ecc: 'Q', margin: 4, cyl: true }
];

const TYPES = ['svg', 'png', 'jpg'];
const PHYSICAL_WIDTH_MM = 12;
const TARGET_PX         = 300;
const PX_PER_MM         = TARGET_PX / PHYSICAL_WIDTH_MM;

/**
 * Aplikuje cylindrickou kompenzaci na rastrové QR (PNG/JPG).
 */
function CylindricalCanvas({ src, sizePx }) {
  const canvasRef = useRef();
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = sizePx, h = sizePx;
      const ctx = canvasRef.current;
      ctx.width  = w;
      ctx.height = h;
      const outCtx = ctx.getContext('2d');

      const off = document.createElement('canvas');
      off.width  = w;
      off.height = h;
      const offCtx = off.getContext('2d');
      offCtx.drawImage(img, 0, 0, w, h);
      const srcData = offCtx.getImageData(0, 0, w, h).data;
      const outImg  = outCtx.createImageData(w, h);
      const outData = outImg.data;

      // poloměr válce v px
      const radiusPx = (PHYSICAL_WIDTH_MM / (2 * Math.PI * 9)) * w;
      const cx       = w / 2;

      for (let xOut = 0; xOut < w; xOut++) {
        const norm = (xOut - cx) / radiusPx;
        if (Math.abs(norm) <= 1) {
          const theta = Math.asin(norm);
          const xInF  = radiusPx * theta + cx;
          const xIn   = Math.max(0, Math.min(w - 1, Math.round(xInF)));
          for (let y = 0; y < h; y++) {
            const dst = (y * w + xOut) * 4;
            const src = (y * w + xIn)  * 4;
            outData[dst  ] = srcData[src  ];
            outData[dst+1] = srcData[src+1];
            outData[dst+2] = srcData[src+2];
            outData[dst+3] = srcData[src+3];
          }
        }
      }
      outCtx.putImageData(outImg, 0, 0);
    };
    img.src = src;
  }, [src, sizePx]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: sizePx, height: sizePx, imageRendering: 'pixelated' }}
    />
  );
}
CylindricalCanvas.propTypes = {
  src:    PropTypes.string.isRequired,
  sizePx: PropTypes.number.isRequired
};

/**
 * Hlavní komponenta
 */
export default function QRGenerator({ className = '' }) {
  const [url,     setUrl]     = useState('');
  const [workUrl, setWorkUrl] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Generování QR po změně workUrl
  useEffect(() => {
    if (!workUrl) return;
    setLoading(true);

    (async () => {
      const entries = [];

      for (const v of VARIANTS) {
        const entry = { variant: v, svg: null, svgUrl: null, png: null, jpg: null, err: null };

        // spočítáme rozměry
        const modules      = 4 * v.version + 17;
        const totalModules = modules + 2 * v.margin;
        const scale        = Math.floor(TARGET_PX / totalModules);
        const sizePx       = totalModules * scale;

        // připravíme payload
        let payload;
        if (v.id === 2) {
          // segmentace alfanum + numeric
          const m = workUrl.match(/^(https?:\/\/[^\/]+\/01\/)(\d+)$/);
          if (m) {
            payload = {
              segments: [
                { mode: 'alphanumeric', data: m[1] },
                { mode: 'numeric',      data: m[2] }
              ]
            };
          } else {
            payload = { data: workUrl };
          }
        } else {
          // u id=3 přidáme compress: true, u id=1 jen data
          payload = { data: workUrl };
          if (v.id === 3) payload.compress = true;
        }

        try {
          for (const type of TYPES) {
            const resp = await fetch(
              `${process.env.REACT_APP_API_URL}/qrcode`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...payload,
                  type,
                  version: v.version.toString(),
                  ecc:     v.ecc,
                  margin:  v.margin.toString(),
                  scale:   scale.toString()
                })
              }
            );
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

            if (type === 'svg') {
              const raw = await resp.text();
              entry.svg    = raw;
              entry.svgUrl = URL.createObjectURL(
                new Blob([raw], { type: 'image/svg+xml' })
              );
            } else {
              const blob   = await resp.blob();
              entry[type] = { url: URL.createObjectURL(blob), sizePx };
            }
          }
        } catch (e) {
          entry.err = e.message;
        }

        entries.push(entry);
      }

      setResults(entries);
      setLoading(false);
    })();

    // cleanup blob URLs
    return () => {
      results.forEach(e => {
        if (e.svgUrl) URL.revokeObjectURL(e.svgUrl);
        if (e.png)    URL.revokeObjectURL(e.png.url);
        if (e.jpg)    URL.revokeObjectURL(e.jpg.url);
      });
    };
  }, [workUrl]);

  const handleGenerate = () => {
    if (!url.trim()) return;
    setResults([]);
    setWorkUrl(url.trim());
  };
  const handleReset = () => {
    setUrl('');
    setWorkUrl(null);
    setResults([]);
  };

  return (
    <Box className={className} sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        QR Generator – 3 varianty (4Q, 3H-segment, 2Q-compressed)
      </Typography>

      <Box sx={{ display: 'flex', mb: 2, gap: 1 }}>
        <TextField
          fullWidth
          label="Zadejte jednu GS1 URL"
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={loading}
        />
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={loading || !url.trim()}
        >
          {loading ? <CircularProgress size={24}/> : 'Generate'}
        </Button>
        <Button
          variant="outlined"
          onClick={handleReset}
          disabled={loading && !!workUrl}
        >
          Reset
        </Button>
      </Box>

      {workUrl && (
        <Typography variant="body2" gutterBottom>
          Generuji pro URL: <strong>{workUrl}</strong>
        </Typography>
      )}

      <Grid container spacing={2}>
        {results.map(({ variant: v, svg, svgUrl, png, jpg, err }) => (
          <Grid item xs={12} md={6} key={v.id}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {v.name} – verze {v.version}, ECC {v.ecc}, margin {v.margin}
              </Typography>

              {err
                ? <Typography color="error">Chyba: {err}</Typography>
                : (
                  <Grid container spacing={1}>
                    {/* SVG vektor */}
                    <Grid item xs={12}>
                      <Typography variant="caption">SVG (vektor)</Typography>
                      <object
                        data={svgUrl}
                        type="image/svg+xml"
                        width="100%"
                        height="auto"
                      />
                      <Button
                        size="small"
                        href={svgUrl}
                        download={`qr_v${v.id}.svg`}
                        sx={{ mt: 1 }}
                      >
                        Stáhnout SVG
                      </Button>
                    </Grid>

                    {/* PNG */}
                    <Grid item xs={6}>
                      <Typography variant="caption">
                        PNG {v.cyl ? '(warped)' : '(planar)'}
                      </Typography>
                      {v.cyl
                        ? <CylindricalCanvas src={png.url} sizePx={png.sizePx}/>
                        : <img
                            src={png.url}
                            alt=""
                            width={png.sizePx}
                            height={png.sizePx}
                            style={{ imageRendering: 'pixelated' }}
                          />
                      }
                      <Button
                        size="small"
                        href={png.url}
                        download={`qr_v${v.id}.png`}
                        sx={{ mt: 1 }}
                      >
                        Stáhnout PNG
                      </Button>
                    </Grid>

                    {/* JPG */}
                    <Grid item xs={6}>
                      <Typography variant="caption">
                        JPG {v.cyl ? '(warped)' : '(planar)'}
                      </Typography>
                      {v.cyl
                        ? <CylindricalCanvas src={jpg.url} sizePx={jpg.sizePx}/>
                        : <img
                            src={jpg.url}
                            alt=""
                            width={jpg.sizePx}
                            height={jpg.sizePx}
                            style={{ imageRendering: 'pixelated' }}
                          />
                      }
                      <Button
                        size="small"
                        href={jpg.url}
                        download={`qr_v${v.id}.jpg`}
                        sx={{ mt: 1 }}
                      >
                        Stáhnout JPG
                      </Button>
                    </Grid>
                  </Grid>
                )
              }
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

QRGenerator.propTypes = {
  className: PropTypes.string
};
