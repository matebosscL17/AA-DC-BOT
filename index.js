require('dotenv').config();
const {
  Client, GatewayIntentBits: G, Partials, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, ChannelType, MessageFlags, PermissionFlagsBits: P, AttachmentBuilder,
} = require('discord.js');
const path = require('path');
const { createHash } = require('crypto');
const { K, rangok, beallitasok: B, summon, szovegek, stilus } = require('./config');
const { adat, ment, mentMost, napiMentes } = require('./adat');
const { xpSzinthez, szintXpbol, rangFrissites } = require('./szintek');
const { telepites, ujraepites, stabNevek } = require('./telepites');
const parancsok = require('./parancsok');
const funkciok = require('./funkciok');

if (!process.env.TOKEN || process.env.TOKEN.startsWith('ide_')) {
  console.error('Hiányzik a token! Írd be a .env fájlba: TOKEN=a_bot_tokenje');
  process.exit(1);
}

const client = new Client({
  intents: [G.Guilds, G.GuildMembers, G.GuildMessages, G.MessageContent, G.GuildVoiceStates, G.GuildInvites],
  partials: [Partials.GuildMember],
});

const ROZSA = 0x9b59b6;
const privat = { flags: MessageFlags.Ephemeral };
const csatorna = (guild, kulcs) => guild.channels.cache.find((c) => c.isTextBased() && c.name.includes(kulcs));
const rangNev = (guild, nev) => guild.roles.cache.find((r) => r.name === nev);
const stabTag = (tag) => tag.permissions.has(P.ManageMessages);
const veletlen = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function log(guild, szoveg) {
  csatorna(guild, 'logok')?.send({ content: szoveg, allowedMentions: { parse: [] } }).catch(() => {});
}

async function xpAd(tag, mennyiseg, cs) {
  const regiXp = adat.xp[tag.id] ?? 0;
  const ujXp = regiXp + mennyiseg;
  adat.xp[tag.id] = ujXp;
  funk.hetiPont(tag.id, 'xp', mennyiseg);
  ment();
  const ujSzint = szintXpbol(ujXp);
  if (ujSzint > szintXpbol(regiXp)) {
    await rangFrissites(tag, ujSzint).catch(console.error);
    await cs?.send({
      content: `⚡ ${tag} szintet lépett: **${ujSzint}. szint**`,
      allowedMentions: { users: [tag.id] },
    }).catch(() => {});
  }
}

const funk = funkciok({ csatorna, log, xpAd });

// ---------- Indulás ----------
client.once(Events.ClientReady, async () => {
  console.log(`Bejelentkezve: ${client.user.tag}`);
  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set(parancsok).catch((e) => console.error('Parancshiba:', e.message));
  }
  setInterval(() => {
    nyeremenyEllenorzes();
    funk.csapatTick(client).catch(console.error);
  }, 30_000);
  nyeremenyEllenorzes();
  napiMentes();
  setInterval(napiMentes, 3_600_000);
  for (const guild of client.guilds.cache.values()) await meghivoOlvasas(guild);
});
client.on(Events.GuildCreate, (guild) => guild.commands.set(parancsok).catch(console.error));

// ---------- Meghívók követése ----------
const meghivoCache = new Map();

async function meghivoOlvasas(guild) {
  const lista = await guild.invites.fetch().catch(() => null);
  if (!lista) return null;
  const regi = meghivoCache.get(guild.id);
  const uj = new Map([...lista.values()].map((m) => [m.code, { uses: m.uses, inviter: m.inviter?.id }]));
  meghivoCache.set(guild.id, uj);
  return { regi, uj };
}

client.on(Events.InviteCreate, (m) => meghivoOlvasas(m.guild));
client.on(Events.InviteDelete, (m) => meghivoOlvasas(m.guild));
client.on(Events.VoiceStateUpdate, (regi, uj) => funk.hangValtozas(regi, uj).catch(console.error));

const udvozloCimek = [
  'Új hős lépett a csatatérre!',
  'Secret húzás! Új tag érkezett!',
  'A banner ma ránk mosolygott!',
  'Új egység csatlakozott a csapathoz!',
];
const udvozloSorok = [
  'Ritkaság: ismeretlen. Potenciál: hatalmas. Jó, hogy itt vagy!',
  'Már csak te hiányoztál a csapatból. Üdv köztünk!',
  'A hullámok egyre nehezebbek, de most már eggyel többen vagyunk.',
  'Innen indul a kalandod. Az Ultra Instinct már csak pár szintre van.',
];

// ---------- Üdvözlés ----------
client.on(Events.GuildMemberAdd, async (tag) => {
  const m = await meghivoOlvasas(tag.guild);
  if (m?.regi) {
    const hasznalt = [...m.uj.entries()].find(([kod, v]) => v.uses > (m.regi.get(kod)?.uses ?? 0));
    await funk.meghivoJovairas(tag, hasznalt?.[1].inviter).catch(console.error);
  }
  const genin = rangNev(tag.guild, rangok.szintek.at(-1).nev);
  if (genin) await tag.roles.add(genin).catch(console.error);
  const altalanos = csatorna(tag.guild, 'üdvözlő') ?? csatorna(tag.guild, 'általános');
  const szabalyzat = csatorna(tag.guild, 'szabályzat');
  const rangvalaszto = csatorna(tag.guild, 'rangválasztó');
  altalanos?.send({
    content: `${tag} megérkezett! ⚔️`,
    embeds: [new EmbedBuilder().setColor(ROZSA)
      .setTitle(udvozloCimek[veletlen(0, udvozloCimek.length - 1)])
      .setDescription(`${udvozloSorok[veletlen(0, udvozloSorok.length - 1)]}\n\n**Első küldetéseid**\n`
        + `📜 Olvasd el: ${szabalyzat ?? 'a szabályzatot'}\n`
        + `🎭 Válassz rangot: ${rangvalaszto ?? 'a rangválasztóban'}\n`
        + `🎁 Vedd fel az első jutalmad: \`/napi\`\n`
        + `🤝 Keress csapatot: \`/lfg\``)
      .addFields(
        { name: 'Kalandor', value: `#${tag.guild.memberCount}`, inline: true },
        { name: 'Kezdő rang', value: genin?.name ?? rangok.szintek.at(-1).nev, inline: true },
      )
      .setThumbnail(tag.user.displayAvatarURL({ size: 256 }))
      .setImage('attachment://udvozlo.png')],
    files: [new AttachmentBuilder(path.join(__dirname, 'assets', 'udvozlo.png'), { name: 'udvozlo.png' })],
  }).catch(console.error);
});

// ---------- Üzenetek: moderáció és XP ----------
const uzenetIdok = new Map();
const xpIdok = new Map();
const summonIdok = new Map();

client.on(Events.MessageCreate, async (uzenet) => {
  if (!uzenet.guild || uzenet.author.bot || !uzenet.member) return;
  const id = uzenet.author.id;
  const most = Date.now();

  if (!stabTag(uzenet.member)) {
    const szoveg = uzenet.content.toLowerCase();
    if (B.tiltottSzovegek.some((t) => szoveg.includes(t))) {
      await uzenet.delete().catch(() => {});
      uzenet.channel.send(`🚫 ${uzenet.author}, ilyen linket vagy szöveget nem lehet küldeni.`).catch(() => {});
      log(uzenet.guild, `🚫 Törölt üzenet (${uzenet.author.tag}): ${uzenet.content.slice(0, 500)}`);
      return;
    }
    const idok = (uzenetIdok.get(id) ?? []).filter((t) => most - t < B.spamMasodperc * 1000);
    idok.push(most);
    uzenetIdok.set(id, idok);
    if (idok.length >= B.spamUzenet) {
      uzenetIdok.delete(id);
      await uzenet.member.timeout(B.nemitasPerc * 60_000, 'Spam').catch(() => {});
      log(uzenet.guild, `🔇 ${uzenet.author.tag} némítva ${B.nemitasPerc} percre (spam)`);
      return;
    }
  }

  await funk.halad(uzenet.member, 'uzenet', uzenet.channel);
  if (most - (xpIdok.get(id) ?? 0) < B.xpVarakozasMp * 1000) return;
  xpIdok.set(id, most);
  await xpAd(uzenet.member, veletlen(B.uzenetXpMin, B.uzenetXpMax), uzenet.channel);
});

// ---------- Nyereményjáték ----------
function nyeremenyGomb(id, darab, lezart = false) {
  return new ActionRowBuilder().addComponents(new ButtonBuilder()
    .setCustomId(`nyeremeny:${id}`)
    .setLabel(`Jelentkezem (${darab})`)
    .setEmoji('🎉')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(lezart));
}

async function nyeremenyEllenorzes() {
  for (const [id, ny] of Object.entries(adat.nyeremenyek)) {
    if (Date.now() < ny.vege) continue;
    delete adat.nyeremenyek[id];
    ment();
    const cs = await client.channels.fetch(ny.csatorna).catch(() => null);
    if (!cs) continue;
    const jelentkezok = [...ny.jelentkezok].sort(() => Math.random() - 0.5);
    const nyertesek = jelentkezok.slice(0, ny.nyertesek);
    const uzenet = await cs.messages.fetch(id).catch(() => null);
    uzenet?.edit({ components: [nyeremenyGomb(id, ny.jelentkezok.length, true)] }).catch(() => {});
    cs.send(nyertesek.length
      ? `🎉 **${ny.nyeremeny}** nyertese: ${nyertesek.map((n) => `<@${n}>`).join(', ')}! Gratulálunk!`
      : `😢 A(z) **${ny.nyeremeny}** nyereményjátékra senki sem jelentkezett.`).catch(() => {});
  }
}

// ---------- Ticket ----------
async function ticketNyitas(i) {
  const van = adat.ticketek[i.user.id];
  if (van && i.guild.channels.cache.has(van)) {
    return i.reply({ content: `Már van nyitott ticketed: <#${van}>`, ...privat });
  }
  const jogok = [
    { id: i.guild.roles.everyone.id, deny: [P.ViewChannel] },
    { id: i.user.id, allow: [P.ViewChannel, P.SendMessages, P.AttachFiles, P.ReadMessageHistory] },
    { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.ManageChannels] },
  ];
  for (const nev of stabNevek) {
    const r = rangNev(i.guild, nev);
    if (r) jogok.push({ id: r.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] });
  }
  const cs = await i.guild.channels.create({
    name: `ticket-${i.user.username}`.slice(0, 90),
    type: ChannelType.GuildText,
    parent: i.channel.parentId ?? undefined,
    permissionOverwrites: jogok,
  });
  adat.ticketek[i.user.id] = cs.id;
  ment();
  await cs.send({
    content: `${i.user}, itt vagyunk. Írd le pár mondatban, miben segíthetünk.`,
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder()
      .setCustomId('ticket:zaras').setLabel('Lezárás').setEmoji('🔒').setStyle(ButtonStyle.Danger))],
  });
  return i.reply({ content: `Kész a ticketed: ${cs}`, ...privat });
}

async function ticketZaras(i) {
  await i.reply('🔒 A ticket 5 másodperc múlva bezárul.');
  for (const [tag, cs] of Object.entries(adat.ticketek)) {
    if (cs === i.channelId) delete adat.ticketek[tag];
  }
  ment();
  log(i.guild, `🎫 ${i.channel.name} lezárva: ${i.user.tag}`);
  setTimeout(() => i.channel.delete().catch(console.error), 5000);
}

// ---------- Panelek ----------
function rangPanelTartalom() {
  const gomb = (nev, stilusa) => {
    const [emoji, felirat] = nev.split(' ┃ ');
    return new ButtonBuilder().setCustomId(`rang:${nev}`).setLabel(felirat).setEmoji(emoji).setStyle(stilusa);
  };
  const sorok = [];
  const hozzaad = (nevek, stilusa) => {
    for (let n = 0; n < nevek.length; n += 5) {
      sorok.push(new ActionRowBuilder().addComponents(nevek.slice(n, n + 5).map((x) => gomb(x, stilusa))));
    }
  };
  hozzaad(rangok.ertesitesek, ButtonStyle.Secondary);
  hozzaad(rangok.valaszthato.slice(0, 3), ButtonStyle.Primary);
  hozzaad(rangok.valaszthato.slice(3), ButtonStyle.Success);
  return {
    content: '',
    embeds: [new EmbedBuilder().setColor(ROZSA).setTitle('Szabd testre a profilod')
      .setDescription('Egy koppintással felveheted a rangot, még egy koppintással leveheted.\n\n'
        + '🔔 **Szürke gombok:** erről kérsz értesítést\n'
        + '🖥️ **Kék gombok:** ezen játszol\n'
        + '🎯 **Zöld gombok:** ilyen szinten játszol')],
    components: sorok,
  };
}

const rangPanel = (cs) => cs.send(rangPanelTartalom());

function ticketPanel(cs) {
  return cs.send({
    embeds: [new EmbedBuilder().setColor(ROZSA).setTitle('Segítségre van szükséged?')
      .setDescription('Kérdésed van, hibát találtál, vagy jelentenél valakit? Nyiss egy privát ticketet, és a stáb hamarosan válaszol.')],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder()
      .setCustomId('ticket:nyitas').setLabel('Ticket nyitása').setEmoji('🎫').setStyle(ButtonStyle.Primary))],
  });
}

const guild_csatorna = (guild, id) => guild.channels.cache.get(id);

// Kirakja, ami még nincs kint. Ha egy szöveg megváltozott, a régi üzenetet frissíti.
async function kirakOnce(kulcs, cs, kuld, { kituz = false, verzio, frissit } = {}) {
  if (!cs) return;
  const regi = adat.kirakott[kulcs];
  if (regi && regi.csatorna === cs.id) {
    const megvan = await cs.messages.fetch(regi.uzenet).catch(() => null);
    if (megvan) {
      if (verzio && regi.verzio !== verzio) {
        await frissit(megvan);
        regi.verzio = verzio;
        ment();
      }
      return;
    }
  }
  // Ha új csatornába költözik, a régi példányt töröljük.
  if (regi) {
    const regiCs = guild_csatorna(cs.guild, regi.csatorna);
    await regiCs?.messages.delete(regi.uzenet).catch(() => {});
  }
  const u = await kuld(cs);
  adat.kirakott[kulcs] = { csatorna: cs.id, uzenet: u.id, verzio };
  ment();
  if (kituz) await u.pin().catch(() => {});
}

async function kirakasok(guild) {
  await kirakOnce('rang', csatorna(guild, 'rangválasztó') ?? csatorna(guild, 'bejelentések'), rangPanel, {
    verzio: [...rangok.ertesitesek, ...rangok.valaszthato].join(),
    frissit: (u) => u.edit(rangPanelTartalom()),
  });
  await kirakOnce('ticket', csatorna(guild, '・ticket'), ticketPanel);
  for (const sz of szovegek) {
    const tartalom = sz.cim
      ? { content: '', embeds: [new EmbedBuilder().setColor(ROZSA).setTitle(sz.cim).setDescription(sz.szoveg)] }
      : { content: sz.szoveg };
    await kirakOnce(`szoveg:${sz.kulcs}`, csatorna(guild, sz.kulcs), (cs) => cs.send(tartalom), {
      kituz: true,
      verzio: createHash('sha1').update(sz.szoveg).digest('hex'),
      frissit: (u) => u.edit(tartalom),
    });
  }
}

// ---------- Telepítés gombjai ----------
let telepitesFut = false;

async function telepitesGomb(i, ertek) {
  if (ertek === 'megse') return i.update({ content: 'Rendben, nem történt semmi.', components: [] });
  if (telepitesFut) return i.update({ content: 'A telepítés már fut, várj egy kicsit.', components: [] });

  if (ertek === 'frissites') {
    telepitesFut = true;
    try {
      await i.update({ content: '⏳ Frissítés folyamatban...', components: [] });
      const e = await telepites(i.guild);
      await kirakasok(i.guild);
      return await i.editReply(`✅ Kész! Új rangok: ${e.rangok}, kategóriák: ${e.kategoriak}, csatornák: ${e.csatornak}. Frissített jogok: ${e.jogok}.`);
    } finally {
      telepitesFut = false;
    }
  }

  if (!i.member.permissions.has(P.Administrator)) {
    return i.update({ content: 'A teljes törléshez Rendszergazda jog kell.', components: [] });
  }
  telepitesFut = true;
  try {
    await i.update({ content: '⏳ Törlés és újraépítés folyamatban...', components: [] });
    const e = await ujraepites(i.guild);
    await kirakasok(i.guild);
    // A csatorna, ahol a parancsot írtad, már törlődött, ezért a stáb-chatbe jelzünk.
    await csatorna(i.guild, 'stáb-chat')?.send(`✅ ${i.user}, kész az újraépítés! `
      + `Új rangok: ${e.rangok}, kategóriák: ${e.kategoriak}, csatornák: ${e.csatornak}.`
      + `${e.kihagyott ? ` Nem sikerült törölni: ${e.kihagyott} elem, a részletek a Termuxban.` : ''}`);
  } finally {
    telepitesFut = false;
  }
}

// ---------- Gombok ----------
async function gomb(i) {
  const [tipus, ertek] = i.customId.split(':');

  if (tipus === 'rang') {
    const r = rangNev(i.guild, ertek);
    if (!r) return i.reply({ content: 'Ez a rang nem létezik.', ...privat });
    if (i.member.roles.cache.has(r.id)) {
      await i.member.roles.remove(r);
      return i.reply({ content: `Levetted: **${r.name}**`, ...privat });
    }
    await i.member.roles.add(r);
    return i.reply({ content: `Felvetted: **${r.name}**`, ...privat });
  }

  if (tipus === 'telepites') return telepitesGomb(i, ertek);

  if (tipus === 'ticket') return ertek === 'nyitas' ? ticketNyitas(i) : ticketZaras(i);

  if (funk.gombok[tipus]) return funk.gombok[tipus](i, ertek);

  if (tipus === 'nyeremeny') {
    const ny = adat.nyeremenyek[ertek];
    if (!ny) return i.reply({ content: 'Ez a nyereményjáték már véget ért.', ...privat });
    const hely = ny.jelentkezok.indexOf(i.user.id);
    if (hely >= 0) ny.jelentkezok.splice(hely, 1);
    else ny.jelentkezok.push(i.user.id);
    ment();
    await i.update({ components: [nyeremenyGomb(ertek, ny.jelentkezok.length)] });
    return i.followUp({ content: hely >= 0 ? 'Visszavontad a jelentkezést.' : 'Jelentkeztél, sok szerencsét! 🍀', ...privat });
  }
}

async function pingPoszt(guild, kulcs, rangNeve, embed) {
  const cs = csatorna(guild, kulcs);
  if (!cs) return null;
  const r = rangNev(guild, rangNeve);
  await cs.send({ content: r ? `${r}` : undefined, embeds: [embed], allowedMentions: { roles: r ? [r.id] : [] } });
  return cs;
}

// ---------- Perjeles parancsok ----------
const muveletek = {
  async telepites(i) {
    return i.reply({
      content: '⚠️ **Mit szeretnél?**\n'
        + '**Törlés és újraépítés:** MINDEN csatorna, üzenet és rang végleg törlődik, majd a bot újra felépíti a szervert. '
        + 'Ez nem vonható vissza. A tagok rangjait és az XP-t a bot megtartja.\n'
        + '**Csak frissítés:** semmit nem töröl, csak pótolja a hiányzókat és beállítja a jogokat.',
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('telepites:torles').setLabel('Törlés és újraépítés').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('telepites:frissites').setLabel('Csak frissítés').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('telepites:megse').setLabel('Mégse').setStyle(ButtonStyle.Secondary),
      )],
      ...privat,
    });
  },

  async rangvalaszto(i) {
    await rangPanel(i.channel);
    return i.reply({ content: 'Kész!', ...privat });
  },

  async ticketpanel(i) {
    await ticketPanel(i.channel);
    return i.reply({ content: 'Kész!', ...privat });
  },

  async changelog(i) {
    const cs = csatorna(i.guild, 'changelog') ?? csatorna(i.guild, 'bejelentések');
    if (!cs) return i.reply({ content: 'Nem találom a bejelentések csatornát.', ...privat });
    await cs.send({ embeds: [new EmbedBuilder().setColor(ROZSA)
      .setTitle(`🛠️ ${i.options.getString('cim')}`)
      .setDescription(i.options.getString('szoveg').replaceAll('\\n', '\n'))
      .setTimestamp()] });
    return i.reply({ content: `Kiraktam ide: ${cs}`, ...privat });
  },

  async hir(i) {
    const cs = await pingPoszt(i.guild, 'hírek-és-kódok', stilus('🔔 Frissítések'), new EmbedBuilder().setColor(ROZSA)
      .setTitle(`📰 ${i.options.getString('cim')}`)
      .setDescription(i.options.getString('szoveg').replaceAll('\\n', '\n')).setTimestamp());
    return i.reply({ content: cs ? `Kiraktam ide: ${cs}` : 'Nem találom a hírek csatornát.', ...privat });
  },

  async nyeremeny(i) {
    const nyeremeny = i.options.getString('nyeremeny');
    const perc = i.options.getInteger('perc');
    const nyertesek = i.options.getInteger('nyertesek') ?? 1;
    const vege = Date.now() + perc * 60_000;
    const cs = csatorna(i.guild, 'nyereményjáték') ?? csatorna(i.guild, 'bejelentések') ?? i.channel;
    const uzenet = await cs.send({
      embeds: [new EmbedBuilder().setColor(0xffd700).setTitle(`🎉 ${nyeremeny}`)
        .setDescription(`Nyertesek száma: **${nyertesek}**\nVége: <t:${Math.floor(vege / 1000)}:R>`)],
    });
    adat.nyeremenyek[uzenet.id] = { nyeremeny, nyertesek, vege, csatorna: cs.id, jelentkezok: [] };
    ment();
    await uzenet.edit({ components: [nyeremenyGomb(uzenet.id, 0)] });
    return i.reply({ content: `Elindult itt: ${cs}`, ...privat });
  },

  async 'kod-hozzaad'(i) {
    const kod = i.options.getString('kod').trim();
    if (adat.kodok.some((k) => k.kod.toLowerCase() === kod.toLowerCase())) {
      return i.reply({ content: 'Ez a kód már a listán van.', ...privat });
    }
    adat.kodok.push({ kod, jutalom: i.options.getString('jutalom') ?? '' });
    ment();
    const jutalom = i.options.getString('jutalom');
    await pingPoszt(i.guild, 'hírek-és-kódok', stilus('🔔 Kódok'), new EmbedBuilder().setColor(0x2ed573)
      .setTitle('🎁 Új kód!').setDescription(`\`${kod}\`${jutalom ? `\n${jutalom}` : ''}`));
    return i.reply({ content: `Felvéve és kirakva: \`${kod}\``, ...privat });
  },

  async 'kod-torol'(i) {
    const kod = i.options.getString('kod').trim().toLowerCase();
    const elotte = adat.kodok.length;
    adat.kodok = adat.kodok.filter((k) => k.kod.toLowerCase() !== kod);
    ment();
    return i.reply({ content: adat.kodok.length < elotte ? 'Törölve.' : 'Nincs ilyen kód a listán.', ...privat });
  },

  async kodok(i) {
    if (!adat.kodok.length) return i.reply({ content: 'Még nincs felvett kód.', ...privat });
    return i.reply({ embeds: [new EmbedBuilder().setColor(ROZSA).setTitle('📰 Játékkódok')
      .setDescription(adat.kodok.map((k) => `\`${k.kod}\`${k.jutalom ? `: ${k.jutalom}` : ''}`).join('\n').slice(0, 4000))
      .setFooter({ text: 'A kódok lejárhatnak.' })] });
  },

  async summon(i) {
    const most = Date.now();
    const maradt = (summonIdok.get(i.user.id) ?? 0) + B.summonVarakozasMp * 1000 - most;
    if (maradt > 0) {
      return i.reply({ content: `Még ${Math.ceil(maradt / 1000)} másodpercet várj a következő summonig.`, ...privat });
    }
    summonIdok.set(i.user.id, most);
    let dobas = veletlen(1, summon.reduce((o, s) => o + s.esely, 0));
    const talalat = summon.find((s) => (dobas -= s.esely) <= 0);
    const egyseg = talalat.egysegek[veletlen(0, talalat.egysegek.length - 1)];
    const gy = (adat.gyujtemeny[i.user.id] ??= {});
    gy[egyseg] = (gy[egyseg] ?? 0) + 1;
    ment();
    await i.reply({ embeds: [new EmbedBuilder().setColor(talalat.szin).setTitle(`🎲 ${talalat.ritkasag}!`)
      .setDescription(`${i.user} kihúzta: **${egyseg}**`)
      .setFooter({ text: 'Csak szerveres játék, a játékban nem ad semmit.' })] });
    if (talalat.ritkasag === 'Secret') {
      funk.hetiPont(i.user.id, 'secret');
      await (csatorna(i.guild, 'secret-húzások') ?? csatorna(i.guild, 'általános'))?.send({
        content: `🌟 **SECRET HÚZÁS!** ${i.user} kihúzta: **${egyseg}**!`,
        allowedMentions: { parse: [] },
      }).catch(() => {});
    }
    return funk.halad(i.member, 'summon', i.channel);
  },

  async szint(i) {
    const tag = i.options.getUser('tag') ?? i.user;
    const xp = adat.xp[tag.id] ?? 0;
    const szint = szintXpbol(xp);
    return i.reply({ embeds: [new EmbedBuilder().setColor(ROZSA).setTitle(`⚡ ${tag.username}`)
      .setDescription(`Szint: **${szint}**\nXP: **${xp} / ${xpSzinthez(szint + 1)}**`)] });
  },

  async ranglista(i) {
    const top = Object.entries(adat.xp).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!top.length) return i.reply({ content: 'Még üres a ranglista.', ...privat });
    return i.reply({
      embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('🏆 Ranglista')
        .setDescription(top.map(([id, xp], n) => `**${n + 1}.** <@${id}>: ${szintXpbol(xp)}. szint (${xp} XP)`).join('\n'))],
      allowedMentions: { parse: [] },
    });
  },
};

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isButton()) return await gomb(i);
    if (i.isChatInputCommand()) return await (muveletek[i.commandName] ?? funk.muveletek[i.commandName])?.(i);
  } catch (e) {
    console.error(e);
    const v = { content: '❌ Hiba történt. Nézd meg a bot jogait és a rangja helyét.', ...privat };
    if (i.deferred && !i.replied) await i.editReply({ content: v.content }).catch(() => {});
    else if (i.replied) await i.followUp(v).catch(() => {});
    else await i.reply(v).catch(() => {});
  }
});

// ---------- Hibakezelés és leállás ----------
process.on('unhandledRejection', (e) => console.error('Hiba:', e));
for (const jel of ['SIGINT', 'SIGTERM']) {
  process.on(jel, () => { mentMost(); process.exit(0); });
}

client.login(process.env.TOKEN).catch((e) => {
  if (String(e.message).includes('disallowed intents')) {
    console.error('Kapcsold be a Developer Portalon: Server Members Intent és Message Content Intent!');
  } else if (String(e.message).includes('invalid token') || e.code === 'TokenInvalid') {
    console.error('Rossz a token, ellenőrizd a .env fájlt.');
  } else console.error(e);
  process.exit(1);
});
