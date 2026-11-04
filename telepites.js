const { ChannelType, PermissionFlagsBits: P } = require('discord.js');
const { rangok, kategoriak } = require('./config');

const stabNevek = rangok.stab.map((r) => r.nev);
const szinKod = (s) => parseInt(s.replace('#', ''), 16);

function jogok(guild, iras, stabRangok) {
  const lista = [];
  if (iras === 'rejtett') lista.push({ id: guild.roles.everyone.id, deny: [P.ViewChannel] });
  if (iras === 'stab') lista.push({ id: guild.roles.everyone.id, deny: [P.SendMessages, P.AddReactions] });
  if (iras) {
    for (const r of stabRangok) {
      lista.push({ id: r.id, allow: [P.ViewChannel, P.SendMessages] });
    }
  }
  return lista;
}

// Csak azt hozza létre, ami még nincs meg, ezért többször is futtatható.
async function telepites(guild) {
  const eredmeny = { rangok: 0, kategoriak: 0, csatornak: 0 };
  await guild.roles.fetch();
  await guild.channels.fetch();

  // A Discord az új rangot alulra teszi, ezért fentről lefelé haladunk.
  const mind = [
    ...rangok.stab,
    ...rangok.kulonleges,
    ...rangok.szintek,
    ...rangok.ertesitesek.map((nev) => ({ nev })),
  ];
  for (const r of mind) {
    if (guild.roles.cache.some((x) => x.name === r.nev)) continue;
    const adatok = { name: r.nev, reason: 'Szerver telepítése' };
    if (r.szin) adatok.color = szinKod(r.szin);
    if (r.admin) adatok.permissions = [P.Administrator];
    else if (r.jogok) adatok.permissions = r.jogok.map((j) => P[j]);
    else adatok.permissions = [];
    adatok.hoist = Boolean(r.szin);
    await guild.roles.create(adatok);
    eredmeny.rangok++;
  }

  const stabRangok = stabNevek.map((n) => guild.roles.cache.find((x) => x.name === n)).filter(Boolean);

  const hasznaltKategoriak = new Set();
  for (const kat of kategoriak) {
    // Két azonos nevű kategória is lehet, ezért a már használtat kihagyjuk.
    let kategoria = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === kat.nev && !hasznaltKategoriak.has(c.id),
    );
    if (!kategoria) {
      kategoria = await guild.channels.create({ name: kat.nev, type: ChannelType.GuildCategory });
      eredmeny.kategoriak++;
    }
    hasznaltKategoriak.add(kategoria.id);
    for (const cs of kat.csatornak) {
      const tipus = cs.hang ? ChannelType.GuildVoice : ChannelType.GuildText;
      // A Discord a szöveges neveket kisbetűsíti, ezért a név végét hasonlítjuk.
      const kulcs = cs.nev.split('・').pop().toLowerCase();
      const meglevo = guild.channels.cache.find(
        (c) => c.type === tipus && c.parentId === kategoria.id && c.name.toLowerCase().includes(kulcs),
      );
      if (meglevo) continue;
      const uj = await guild.channels.create({
        name: cs.nev,
        type: tipus,
        parent: kategoria.id,
        permissionOverwrites: jogok(guild, cs.iras, stabRangok),
        ...(cs.limit ? { userLimit: cs.limit } : {}),
      });
      if (cs.afk) await guild.setAFKChannel(uj);
      eredmeny.csatornak++;
    }
  }
  return eredmeny;
}

module.exports = { telepites, stabNevek };
