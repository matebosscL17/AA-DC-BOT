// A bot adatai a data.json fájlba kerülnek (XP, kódok, ticketek, nyereményjátékok).
const fs = require('fs');
const path = require('path');
const FAJL = path.join(__dirname, 'data.json');
let adat = { xp: {}, kodok: [], ticketek: {}, nyeremenyek: {} };

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

module.exports = { adat, ment, mentMost };
