const { ChannelType, PermissionFlagsBits: P } = require('discord.js');
const { rangok, kategoriak } = require('./config');

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

  const stabRangok = stabNevek.map((n) => guild.roles.cache.find((x) => x.name === n)).filter(Boolean);

  const hasznaltKategoriak = new Set();
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

    for (const cs of kat.csatornak) {
      const tipus = cs.hang ? ChannelType.GuildVoice : ChannelType.GuildText;
      const csatJogok = jogok(guild, cs.iras ?? kat.iras, stabRangok, cs.afk);
      // A Discord a szöveges neveket kisbetűsíti, ezért a név végét hasonlítjuk.
      const kulcs = cs.nev.split('・').pop().toLowerCase();
      const meglevo = guild.channels.cache.find(
        (c) => c.type === tipus && c.parentId === kategoria.id && c.name.toLowerCase().includes(kulcs),
      );
      if (meglevo) {
        await meglevo.permissionOverwrites.set(csatJogok);
        eredmeny.jogok++;
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
    }
  }
  return eredmeny;
}

module.exports = { telepites, stabNevek };
