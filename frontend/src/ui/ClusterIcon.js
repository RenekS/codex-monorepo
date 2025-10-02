// src/ui/ClusterIcon.js
import L from 'leaflet';

/**
 * Vytvoří factory pro iconCreateFunction markerClusteru.
 * Použití:
 *   L.markerClusterGroup({ iconCreateFunction: makeClusterIconFactory({ size: 40 }) })
 */
export function makeClusterIconFactory({
  size = 40,
  colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'], // 4 kvadranty
  centerFill = '#ffffff',
  centerStroke = '#e5e7eb',
  centerRatio = 0.5, // r/2
  opacity = 0.6,
} = {}) {
  const r = size / 2;

  return function iconCreateFunction(cluster) {
    // rychlejší než getAllChildMarkers().length
    const totals = cluster.getChildCount();

    // 4 výseče po 90°
    const paths = [0, 1, 2, 3].map((i) => {
      const a = (i * 90) * Math.PI / 180;
      const b = ((i + 1) * 90) * Math.PI / 180;
      const sx = r + r * Math.cos(a);
      const sy = r + r * Math.sin(a);
      const ex = r + r * Math.cos(b);
      const ey = r + r * Math.sin(b);
      return `<path d="M${r},${r} L${sx},${sy} A${r},${r} 0 0,1 ${ex},${ey} Z" fill="${colors[i % colors.length]}" fill-opacity="${opacity}"/>`;
    }).join('');

    const html = `
      <div style="display:inline-block;width:${size}px;height:${size}px;line-height:0;">
        <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          ${paths}
          <circle cx="${r}" cy="${r}" r="${r * centerRatio}" fill="${centerFill}" stroke="${centerStroke}" stroke-width="1" />
          <text x="${r}" y="${r + 4}" text-anchor="middle" font-size="12" font-weight="bold" fill="#111">${totals}</text>
        </svg>
      </div>
    `;

    return L.divIcon({ html, className: '', iconSize: [size, size] });
  };
}
