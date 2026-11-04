// A bot adatai a data.json fájlba kerülnek (XP, kódok, ticketek, nyereményjátékok).
const fs = require('fs');
const path = require('path');
const FAJL = path.join(__dirname, 'data.json');
const MENTESEK = path.join(__dirname, 'mentesek');
const MEGTARTOTT = 7;
let adat = {
  xp: {}, kodok: [], ticketek: {}, nyeremenyek: {}, kirakott: {}, warnok: {}, csapatok: {},
  ertekelesek: {}, napi: {}, kuldetes: {}, gyujtemeny: {},
  hangszobak: {}, emlekeztetok: [], lfgPontok: {}, meghivok: {}, meghivott: {}, csapatom: {},
  heti: { het: 0, xp: {}, secret: {}, nyertes: null },
};

try {
  if (fs.existsSync(FAJL)) adat = { ...adat, ...JSON.parse(fs.readFileSync(FAJL, 'utf8')) };
} catch (e) {
  console.error('A data.json nem olvasható, másolatot mentek róla:', e.message);
  fs.copyFileSync(FAJL, `${FAJL}.hibas`);
}

let idozito = null;
function ment() {
  if (idozito) return;
  idozito = setTimeout(mentMost, 2000);
}
function mentMost() {
  clearTimeout(idozito);
  idozito = null;
  const ideiglenes = `${FAJL}.tmp`;
  fs.writeFileSync(ideiglenes, JSON.stringify(adat, null, 2));
  fs.renameSync(ideiglenes, FAJL);
}

// Naponta egy másolatot készít, és csak az utolsó 7-et tartja meg.
function napiMentes() {
  mentMost();
  fs.mkdirSync(MENTESEK, { recursive: true });
  const cel = path.join(MENTESEK, `data-${new Date().toISOString().slice(0, 10)}.json`);
  if (fs.existsSync(cel)) return;
  fs.copyFileSync(FAJL, cel);
  const regiek = fs.readdirSync(MENTESEK).filter((f) => f.endsWith('.json')).sort().slice(0, -MEGTARTOTT);
  for (const f of regiek) fs.unlinkSync(path.join(MENTESEK, f));
}

module.exports = { adat, ment, mentMost, napiMentes };
