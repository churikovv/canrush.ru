// The five wraps of the season pass can: <out>/pass-wrap-<stage>.png is the colour, pass-glow-<stage>.png the light.
// Run from apps/site, where sharp is installed: node ../../design/3d/build_pass_textures.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sharp = createRequire(join(process.cwd(), 'package.json'))('sharp');
const W = 2048, H = 1536;

function logo(file, color) {
  const svg = readFileSync(join(here, '../../apps/site/public/brand', file), 'utf8');
  const box = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  return { width: Number(box[1]), height: Number(box[2]), body: svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>')).replaceAll('fill="white"', `fill="${color}"`) };
}

/** A logo at the centre (x, y), `width` wide; `turn` degrees around its centre. */
function place(art, x, y, width, turn = 0) {
  const scale = width / art.width;
  return `<g transform="translate(${x} ${y}) rotate(${turn}) scale(${scale}) translate(${-art.width / 2} ${-art.height / 2})">${art.body}</g>`;
}

/** The artwork twice around the can, so a logo is always in view as it turns. */
const twice = draw => draw(W * 0.25) + draw(W * 0.75);
/** One lightning bolt from the top to the bottom of the body; `seed` shifts its joints. */
function bolt(x, seed, swing = 80) {
  const points = [[x, -20]];
  for (let step = 1; step < 7; step += 1) points.push([x + ((step * 37 + seed * 53) % 2 ? 1 : -1) * (swing * (0.45 + ((step * seed * 7) % 5) / 8)), H * step / 7]);
  points.push([x, H + 20]);
  return points.map(point => point.join(',')).join(' ');
}

const stages = {
  // Bare aluminium, a thin blue band and a small logo.
  1: {
    wrap: color => `<rect width="${W}" height="${H}" fill="#c9ced6"/>
      <rect y="${H * 0.8}" width="${W}" height="26" fill="#006eff"/><rect y="${H * 0.83}" width="${W}" height="8" fill="#006eff"/>
      ${twice(x => place(logo('logo-mark-white.svg', '#006eff'), x, H * 0.44, 190) + place(logo('logo-wordmark-white.svg', color), x, H * 0.54, 360))}`,
    color: '#20262f',
  },
  // The brand blue, the big white name along the can and a white slash.
  2: {
    wrap: color => `<rect width="${W}" height="${H}" fill="#006eff"/>
      ${twice(x => `<polygon points="${x - 520},${H} ${x - 250},${H} ${x + 520},0 ${x + 250},0" fill="#0b4fd6"/>`)}
      ${twice(x => place(logo('logo-wordmark-white.svg', color), x, H * 0.52, 1130, -90))}`,
    color: '#ffffff',
  },
  // Night blue with neon lines: the lines are repeated in the glow map.
  3: {
    wrap: color => `<rect width="${W}" height="${H}" fill="#070b2e"/>
      ${twice(x => `<circle cx="${x}" cy="${H * 0.5}" r="470" fill="#0d1a5c"/>`)}
      ${twice(x => place(logo('logo-wordmark-white.svg', color), x, H * 0.52, 1130, -90))}`,
    color: '#7deaff',
    glow: `${twice(x => place(logo('logo-wordmark-white.svg', '#27e0ff'), x, H * 0.52, 1130, -90))}
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="${bolt(W * 0.02, 1)}" stroke="#27e0ff" stroke-width="12"/>
        <polyline points="${bolt(W * 0.5, 2)}" stroke="#ff3df2" stroke-width="12"/>
        <rect x="-20" y="50" width="${W + 40}" height="10" fill="#27e0ff" stroke="none"/><rect x="-20" y="${H - 60}" width="${W + 40}" height="10" fill="#27e0ff" stroke="none"/>
      </g>`,
  },
  // Black metal and gold foil, art deco lines.
  4: {
    wrap: color => `<rect width="${W}" height="${H}" fill="#0a0a0d"/>
      <g fill="${color}">
        <rect y="0" width="${W}" height="96"/><rect y="118" width="${W}" height="10"/><rect y="${H - 96}" width="${W}" height="96"/><rect y="${H - 128}" width="${W}" height="10"/>
        ${Array.from({ length: 28 }, (_, index) => `<polygon points="${(index * W) / 14},0 ${((index + 1) * W) / 14 - 44},0 ${((index + 0.5) * W) / 14 - 22},86"  fill="#0a0a0d"/>`).join('')}
      </g>
      ${twice(x => `<g fill="none" stroke="${color}" stroke-width="8">${[0, 1, 2].map(step => `<polygon points="${x},${H * 0.5 - 610 + step * 46} ${x + 340 - step * 34},${H * 0.5} ${x},${H * 0.5 + 610 - step * 46} ${x - 340 + step * 34},${H * 0.5}"/>`).join('')}</g>
        ${place(logo('logo-wordmark-white.svg', color), x, H * 0.5, 980, -90)}`)}`,
    color: '#e8b64a',
  },
  // A dark base the holographic shader lights up, the name in gold and a white-hot bolt.
  5: {
    wrap: color => `<rect width="${W}" height="${H}" fill="#808080"/>
      ${twice(x => place(logo('logo-wordmark-white.svg', color), x, H * 0.52, 1180, -90))}`,
    color: '#ffffff',
    glow: `${twice(x => place(logo('logo-wordmark-white.svg', '#ffb64a'), x, H * 0.52, 1180, -90))}
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="${bolt(W * 0.02, 3, 110)}" stroke="#ffffff" stroke-width="16"/>
        <polyline points="${bolt(W * 0.5, 5, 110)}" stroke="#ffffff" stroke-width="16"/>
      </g>`,
  },
};

const render = (body, file, background = '#000000') => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${background}"/>${body}</svg>`)).png({ compressionLevel: 9 }).toFile(join(here, file));

for (const [stage, art] of Object.entries(stages)) {
  await render(art.wrap(art.color), `pass-wrap-${stage}.png`);
  await render(art.glow ?? '', `pass-glow-${stage}.png`);
}

// The name for the back wall, white on nothing: the scene tints it.
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1071" viewBox="0 0 1400 1071">${place(logo('logo-mark-white.svg', '#ffffff'), 700, 535, 1400)}</svg>`)).png({ compressionLevel: 9 }).toFile(join(here, 'pass-mark.png'));
