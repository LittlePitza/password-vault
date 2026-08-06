/**
 * Genera los iconos de la extensión.
 *
 *   node scripts/generate-icons.mjs
 *
 * ── Por qué hay un script y no unos PNG sueltos en el repositorio ─────────────
 * Un PNG binario es un callejón sin salida: si la paleta cambia, nadie sabe con qué se
 * hizo ni cómo rehacerlo. Aquí la geometría está descrita una sola vez y **los colores se
 * leen de `src/ui/tokens.css`**, que es el único sitio del proyecto con hex. Cambiar un
 * token y volver a ejecutar esto deja el icono al día, igual que la interfaz.
 *
 * ── Por qué no se usa una librería ────────────────────────────────────────────
 * Rasterizar esto son dos primitivas —rectángulo redondeado y cerradura— y escribir un PNG
 * son tres bloques y un CRC. Traer `sharp` o `resvg` serían entre 8 y 30 MB de binarios
 * nativos para un archivo que se regenera dos veces al año, en un proyecto que ha
 * rechazado dependencias por mucho menos.
 *
 * ── El diseño ─────────────────────────────────────────────────────────────────
 * Una cerradura verde sobre un cuadrado navy. Ni escudo ni llave: a 16 px —que es el
 * tamaño al que se ve el 90 % del tiempo, en la barra del navegador— cualquier dibujo con
 * más de dos formas se convierte en una mancha. La cerradura sobrevive al tamaño y dice
 * «esto guarda cosas cerradas» sin necesidad de explicarlo.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'icon');
const SVG_OUT = join(ROOT, 'design-system', 'pimsa-password-vault', 'icon.svg');

/** Los tamaños que pide Chrome. 16 barra, 32 Windows, 48 gestión, 128 tienda. */
const SIZES = [16, 32, 48, 96, 128];

/** Muestras por eje dentro de cada píxel. 4×4 = 16 muestras: suficiente para bordes limpios. */
const SUPERSAMPLE = 4;

// ── Colores ──────────────────────────────────────────────────────────────────

/** Lee un token de `tokens.css`. Si el nombre no existe, es mejor romper que inventarse un color. */
function readToken(css, name) {
  const match = new RegExp(`--pimsa-${name}:\\s*#([0-9a-fA-F]{6})`).exec(css);
  if (match === null) throw new Error(`Falta el token --pimsa-${name} en tokens.css`);
  const hex = match[1];
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

const tokens = readFileSync(join(ROOT, 'src', 'ui', 'tokens.css'), 'utf8');

/*
 * El icono se queda en navy con la cerradura verde aunque la interfaz haya movido su
 * acento a azul: es la marca, y la marca de PIMSA son esos dos colores. Lo que cambió en
 * el modo noche fue el color de trabajo de una interfaz, no la identidad.
 */
const PALETTE = {
  navy900: readToken(tokens, 'navy-900'),
  night950: readToken(tokens, 'night-950'),
  green500: readToken(tokens, 'green-500'),
  green300: readToken(tokens, 'green-300'),
  blue400: readToken(tokens, 'blue-400'),
};

const mix = (a, b, t) => a.map((channel, i) => channel + (b[i] - channel) * t);

// ── Geometría, en unidades relativas al lado del icono ───────────────────────

const GEOMETRY = {
  /** Radio de esquina. 0.22 es la proporción del cuadrado redondeado del sistema operativo. */
  corner: 0.225,
  /** Cabeza de la cerradura. */
  headCenterY: 0.4,
  headRadius: 0.152,
  /**
   * Cuerpo: un trapecio que se abre hacia abajo.
   *
   * Las proporciones importan más de lo que parece. Con el cuerpo corto y ancho —tan ancho
   * como alto— el conjunto deja de leerse como una cerradura y se lee como la silueta de
   * una persona: cabeza y hombros. Alargándolo y estrechándolo por arriba vuelve a ser lo
   * que tiene que ser. El ancho de abajo se queda en dos tercios del de la cabeza, que es
   * la proporción de una cerradura de cilindro real.
   */
  slotTop: 0.475,
  slotBottom: 0.76,
  slotHalfTop: 0.043,
  slotHalfBottom: 0.1,
};

/** Distancia con signo a un rectángulo redondeado centrado en el origen. Negativa = dentro. */
function sdRoundRect(px, py, half, radius) {
  const qx = Math.abs(px) - (half - radius);
  const qy = Math.abs(py) - (half - radius);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
}

/** ¿Cae este punto dentro de la cerradura? Unión de la cabeza redonda y el cuerpo. */
function insideKeyhole(x, y) {
  const g = GEOMETRY;

  if (Math.hypot(x - 0.5, y - g.headCenterY) <= g.headRadius) return true;

  if (y >= g.slotTop && y <= g.slotBottom) {
    const t = (y - g.slotTop) / (g.slotBottom - g.slotTop);
    return Math.abs(x - 0.5) <= g.slotHalfTop + (g.slotHalfBottom - g.slotHalfTop) * t;
  }

  return false;
}

// ── Rasterizado ──────────────────────────────────────────────────────────────

function render(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const step = 1 / SUPERSAMPLE;
  const samples = SUPERSAMPLE * SUPERSAMPLE;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;

      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          // Centro de la submuestra, normalizado a 0..1.
          const x = (px + (sx + 0.5) * step) / size;
          const y = (py + (sy + 0.5) * step) / size;

          // Fuera del cuadrado redondeado no se dibuja nada: ahí va la transparencia.
          if (sdRoundRect(x - 0.5, y - 0.5, 0.5, GEOMETRY.corner) > 0) continue;

          let color;
          if (insideKeyhole(x, y)) {
            // La cerradura se aclara hacia arriba: da la sensación de que le entra luz.
            color = mix(PALETTE.green300, PALETTE.green500, y);
          } else {
            // El fondo se oscurece hacia abajo, del navy de marca al casi negro de la
            // banda oscura. Es el mismo gradiente que la interfaz.
            color = mix(PALETTE.navy900, PALETTE.night950, y);

            // Filo de luz en el borde superior, el mismo recurso que `--color-hairline`.
            // Sólo a partir de 32 px: en 16 ocuparía media cara del icono.
            if (size >= 32 && y < 0.045) {
              color = mix(color, PALETTE.blue400, ((0.045 - y) / 0.045) * 0.55);
            }
          }

          r += color[0];
          g += color[1];
          b += color[2];
          covered += 1;
        }
      }

      const offset = (py * size + px) * 4;
      if (covered > 0) {
        pixels[offset] = Math.round(r / covered);
        pixels[offset + 1] = Math.round(g / covered);
        pixels[offset + 2] = Math.round(b / covered);
        pixels[offset + 3] = Math.round((covered / samples) * 255);
      }
    }
  }

  return pixels;
}

// ── Escritura del PNG ────────────────────────────────────────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // 8 bits por canal
  header[9] = 6; // color RGBA
  // Compresión, filtrado e interlazado: los únicos valores que admite el formato.

  // Cada fila lleva delante su byte de filtro. 0 = sin filtrar: con imágenes de este
  // tamaño, el filtrado no compensa el código que cuesta.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── SVG, para la ficha de la tienda y la documentación ───────────────────────

function toHex([r, g, b]) {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function buildSvg() {
  const g = GEOMETRY;
  const s = 128;
  const px = (value) => (value * s).toFixed(2);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" role="img" aria-label="PIMSA Password Vault">
  <!-- Generado por scripts/generate-icons.mjs. No editar a mano. -->
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${toHex(PALETTE.navy900)}"/>
      <stop offset="1" stop-color="${toHex(PALETTE.night950)}"/>
    </linearGradient>
    <linearGradient id="key" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${toHex(PALETTE.green300)}"/>
      <stop offset="1" stop-color="${toHex(PALETTE.green500)}"/>
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" rx="${px(g.corner)}" fill="url(#bg)"/>
  <path fill="url(#key)" d="M ${px(0.5 - g.slotHalfTop)} ${px(g.slotTop)} L ${px(0.5 - g.slotHalfBottom)} ${px(g.slotBottom)} L ${px(0.5 + g.slotHalfBottom)} ${px(g.slotBottom)} L ${px(0.5 + g.slotHalfTop)} ${px(g.slotTop)} Z"/>
  <circle cx="${px(0.5)}" cy="${px(g.headCenterY)}" r="${px(g.headRadius)}" fill="url(#key)"/>
</svg>
`;
}

// ── Ejecución ────────────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });

for (const size of SIZES) {
  writeFileSync(join(OUT_DIR, `${size}.png`), encodePng(size, render(size)));
}

writeFileSync(SVG_OUT, buildSvg());

process.stdout.write(`Iconos generados: ${SIZES.join(', ')} px → public/icon/\n`);
