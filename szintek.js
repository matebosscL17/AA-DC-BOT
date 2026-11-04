const { rangok } = require('./config');

// Ennyi összes XP kell az adott szinthez: 50 * szint * (szint + 1)
const xpSzinthez = (szint) => 50 * szint * (szint + 1);

function szintXpbol(xp) {
  let szint = 0;
  while (xp >= xpSzinthez(szint + 1)) szint++;
  return szint;
}

// A legmagasabb rang, ami az adott szinthez jár
const szintRang = (szint) => rangok.szintek.find((r) => szint >= r.szint);

async function rangFrissites(tag, szint) {
  const cel = szintRang(szint);
  const celRang = tag.guild.roles.cache.find((r) => r.name === cel.nev);
  if (!celRang) return;
  const regiek = rangok.szintek
    .filter((r) => r.nev !== cel.nev)
    .map((r) => tag.guild.roles.cache.find((x) => x.name === r.nev))
    .filter((r) => r && tag.roles.cache.has(r.id));
  if (regiek.length) await tag.roles.remove(regiek);
  if (!tag.roles.cache.has(celRang.id)) await tag.roles.add(celRang);
}

module.exports = { xpSzinthez, szintXpbol, szintRang, rangFrissites };
