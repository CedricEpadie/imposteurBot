const stub = (f) => new URL(`./stubs/${f}`, import.meta.url).href
const MAP = {
  '@whiskeysockets/baileys': stub('baileys.mjs'),
  sharp: stub('sharp.mjs'),
  pino: stub('pino.mjs'),
  'qrcode-terminal': stub('qrcode.mjs'),
}
export async function resolve(specifier, context, next) {
  return MAP[specifier] ? { url: MAP[specifier], shortCircuit: true } : next(specifier, context)
}
