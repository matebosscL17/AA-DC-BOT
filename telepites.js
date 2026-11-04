const { ChannelType, PermissionFlagsBits: P } = require('discord.js');
const { rangok, kategoriak } = require('./config');
const { adat, ment } = require('./adat');
const { szintXpbol, rangFrissites } = require('./szintek');

const stabNevek = rangok.stab.map((r) => r.nev);
const szinKod = (s) => parseInt(s.replace('#', ''), 16);

const BOT_JOGOK = [
  P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.EmbedLinks, P.AttachFiles,
  P.ManageChannels, P.ManageRoles, P.ManageMessages, P.Connect,
];
const STAB_JOGOK = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AddReactions, P.Connect, P.Speak];
const CSAK_OLVASAS = [
  P.SendMessages, P.AddReactions, P.CreatePublicThreads, P.CreatePrivateThreads, P.SendMessagesInThreads,
];

// Egy kategória vagy csatorna teljes jogosultságlistája
function jogok(guild, iras, stabRangok, afk = false) {
  const everyone = guild.roles.everyone.id;
  const lista = [{ id: guild.client.user.id, allow: BOT_JOGOK }];
  if (iras === 'rejtett') lista.push({ id: everyone, deny: [P.ViewChannel] });
  if (iras === 'stab') lista.push({ id: everyone, deny: CSAK_OLVASAS });
  if (afk) lista.push({ id: everyone, deny: [P.Speak] });
  if (iras) {
    for (const r of stabRangok) lista.push({ id: r.id, allow: STAB_JOGOK });
  }
  return lista;
}

function rangJogok(r) {
  if (r.admin) return [P.Administrator];
  return (r.jogok ?? []).map((j) => P[j]);
}

// Csak azt hozza létre, ami még nincs meg, a jogokat viszont mindig beállítja,
// ezért többször is futtatható.
async function telepites(guild) {
  const eredmeny = { rangok: 0, kategoriak: 0, csatornak: 0, jogok: 0 };
  await guild.roles.fetch();
  await guild.channels.fetch();

  // A Discord az új rangot alulra teszi, ezért fentről lefelé haladunk.
  const mind = [
    ...rangok.stab,
    ...rangok.kulonleges,
    ...rangok.szintek,
    ...rangok.ertesitesek.map((nev) => ({ nev })),
    ...rangok.valaszthato.map((nev) => ({ nev })),
  ];
  for (const r of mind) {
    const meglevo = guild.roles.cache.find((x) => x.name === r.nev);
    if (meglevo) {
      if (stabNevek.includes(r.nev)) {
        await meglevo.setPermissions(rangJogok(r)).then(() => { eredmeny.jogok++; }, (e) => {
          console.error(`A(z) ${r.nev} rang jogai nem állíthatók (a bot rangja legyen feljebb):`, e.message);
        });
      }
      continue;
    }
    const adatok = { name: r.nev, reason: 'Szerver telepítése', permissions: rangJogok(r), hoist: Boolean(r.szin) };
    if (r.szin) adatok.color = szinKod(r.szin);
    await guild.roles.create(adatok);
    eredmeny.rangok++;
  }

  // A meglévő szerveren az új rangok alulra kerülnének, ezért sorba rendezzük őket.
  const sorrend = mind.map((r) => guild.roles.cache.find((x) => x.name === r.nev)).filter(Boolean);
  await guild.roles.setPositions(sorrend.map((r, n) => ({ role: r.id, position: sorrend.length - n })))
    .catch((e) => console.error('A rangok nem rendezhetők (a bot rangja legyen legfelül):', e.message));

  const stabRangok = stabNevek.map((n) => guild.roles.cache.find((x) => x.name === n)).filter(Boolean);

  const hasznaltKategoriak = new Set();
  const katSorrend = [];
  for (const kat of kategoriak) {
    const katJogok = jogok(guild, kat.iras, stabRangok);
    // Két azonos nevű kategória is lehet, ezért a már használtat kihagyjuk.
    let kategoria = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === kat.nev && !hasznaltKategoriak.has(c.id),
    );
    if (kategoria) {
      await kategoria.permissionOverwrites.set(katJogok);
      eredmeny.jogok++;
    } else {
      kategoria = await guild.channels.create({
        name: kat.nev, type: ChannelType.GuildCategory, permissionOverwrites: katJogok,
      });
      eredmeny.kategoriak++;
    }
    hasznaltKategoriak.add(kategoria.id);
    katSorrend.push(kategoria.id);
    const csatSorrend = [];

    for (const cs of kat.csatornak) {
      const tipus = cs.hang ? ChannelType.GuildVoice : ChannelType.GuildText;
      const csatJogok = jogok(guild, cs.iras ?? kat.iras, stabRangok, cs.afk);
      // A Discord a szöveges neveket kisbetűsíti, ezért a név végét hasonlítjuk.
      const kulcs = cs.nev.split('・').pop().toLowerCase();
      const meglevo = guild.channels.cache.find(
        (c) => c.type === tipus && c.parentId === kategoria.id && c.name.toLowerCase().split('・').pop() === kulcs,
      );
      if (meglevo) {
        await meglevo.permissionOverwrites.set(csatJogok);
        eredmeny.jogok++;
        const celNev = cs.hang ? cs.nev : cs.nev.toLowerCase();
        if (meglevo.name !== celNev) await meglevo.setName(cs.nev).catch((e) => console.error(cs.nev, e.message));
        csatSorrend.push(meglevo.id);
        continue;
      }
      const uj = await guild.channels.create({
        name: cs.nev,
        type: tipus,
        parent: kategoria.id,
        permissionOverwrites: csatJogok,
        ...(cs.limit ? { userLimit: cs.limit } : {}),
      });
      if (cs.afk) await guild.setAFKChannel(uj);
      eredmeny.csatornak++;
      csatSorrend.push(uj.id);
    }
    await guild.channels.setPositions(csatSorrend.map((channel, position) => ({ channel, position })))
      .catch((e) => console.error('A csatornák nem rendezhetők:', e.message));
  }
  await guild.channels.setPositions(katSorrend.map((channel, position) => ({ channel, position })))
    .catch((e) => console.error('A kategóriák nem rendezhetők:', e.message));
  return eredmeny;
}

// Mindent töröl, újraépíti a szervert, és visszaadja a tagok rangjait.
async function ujraepites(guild) {
  await guild.roles.fetch();
  await guild.channels.fetch();
  const tagok = await guild.members.fetch();

  // A rangok nevét megjegyezzük, hogy törlés után vissza lehessen adni.
  const szintNevek = rangok.szintek.map((r) => r.nev);
  const mentes = new Map();
  for (const tag of tagok.values()) {
    if (tag.user.bot) continue;
    const nevek = [...tag.roles.cache.values()]
      .filter((r) => r.id !== guild.roles.everyone.id && !r.managed && !szintNevek.includes(r.name))
      .map((r) => r.name);
    mentes.set(tag.id, nevek);
  }

  let kihagyott = 0;
  for (const c of [...guild.channels.cache.values()]) {
    await c.delete('Szerver újraépítése').catch((e) => {
      kihagyott++;
      console.error(`Nem törölhető csatorna (${c.name}):`, e.message);
    });
  }
  for (const r of [...guild.roles.cache.values()]) {
    if (r.id === guild.roles.everyone.id || r.managed) continue;
    await r.delete('Szerver újraépítése').catch((e) => {
      kihagyott++;
      console.error(`Nem törölhető rang (${r.name}):`, e.message);
    });
  }
  adat.ticketek = {};
  adat.nyeremenyek = {};
  adat.csapatok = {};
  adat.hangszobak = {};
  adat.emlekeztetok = [];
  ment();

  const eredmeny = await telepites(guild);
  eredmeny.kihagyott = kihagyott;

  for (const tag of tagok.values()) {
    if (tag.user.bot) continue;
    const nevek = [...(mentes.get(tag.id) ?? [])];
    if (tag.id === guild.ownerId) nevek.push(rangok.stab[0].nev);
    const vissza = nevek.map((n) => guild.roles.cache.find((r) => r.name === n)).filter(Boolean);
    if (vissza.length) await tag.roles.add(vissza).catch((e) => console.error(tag.id, e.message));
    await rangFrissites(tag, szintXpbol(adat.xp[tag.id] ?? 0)).catch((e) => console.error(tag.id, e.message));
  }
  return eredmeny;
}

module.exports = { telepites, ujraepites, stabNevek };
