require('dotenv').config();
const {
  Client, GatewayIntentBits: G, Partials, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, ChannelType, MessageFlags, PermissionFlagsBits: P,
} = require('discord.js');
const { K, rangok, beallitasok: B, summon } = require('./config');
const { adat, ment, mentMost } = require('./adat');
const { xpSzinthez, szintXpbol, rangFrissites } = require('./szintek');
const { telepites, stabNevek } = require('./telepites');
const parancsok = require('./parancsok');

if (!process.env.TOKEN || process.env.TOKEN.startsWith('ide_')) {
  console.error('Hiányzik a token! Írd be a .env fájlba: TOKEN=a_bot_tokenje');
  process.exit(1);
}

const client = new Client({
  intents: [G.Guilds, G.GuildMembers, G.GuildMessages, G.MessageContent],
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

// ---------- Indulás ----------
client.once(Events.ClientReady, async () => {
  console.log(`Bejelentkezve: ${client.user.tag}`);
  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set(parancsok).catch((e) => console.error('Parancshiba:', e.message));
  }
  setInterval(nyeremenyEllenorzes, 30_000);
  nyeremenyEllenorzes();
});
client.on(Events.GuildCreate, (guild) => guild.commands.set(parancsok).catch(console.error));

// ---------- Üdvözlés ----------
client.on(Events.GuildMemberAdd, async (tag) => {
  const genin = rangNev(tag.guild, rangok.szintek.at(-1).nev);
  if (genin) await tag.roles.add(genin).catch(console.error);
  const altalanos = csatorna(tag.guild, 'általános');
  const szabalyzat = csatorna(tag.guild, 'szabályzat');
  altalanos?.send(`⛩️ Üdv a(z) **${K.szerverNev}** szerveren, ${tag}! `
    + `Olvasd el a ${szabalyzat ?? 'szabályzatot'}, aztán érezd otthon magad. 🌸`).catch(() => {});
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

  if (most - (xpIdok.get(id) ?? 0) < B.xpVarakozasMp * 1000) return;
  xpIdok.set(id, most);
  const regiXp = adat.xp[id] ?? 0;
  const ujXp = regiXp + veletlen(B.uzenetXpMin, B.uzenetXpMax);
  adat.xp[id] = ujXp;
  ment();
  const regiSzint = szintXpbol(regiXp);
  const ujSzint = szintXpbol(ujXp);
  if (ujSzint > regiSzint) {
    await rangFrissites(uzenet.member, ujSzint).catch(console.error);
    uzenet.channel.send(`🎉 ${uzenet.author} elérte a **${ujSzint}. szintet**!`).catch(() => {});
  }
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
    content: `${i.user}, írd le a problémádat, a stáb hamarosan válaszol.`,
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

  if (tipus === 'ticket') return ertek === 'nyitas' ? ticketNyitas(i) : ticketZaras(i);

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

// ---------- Perjeles parancsok ----------
const muveletek = {
  async telepites(i) {
    await i.deferReply(privat);
    const e = await telepites(i.guild);
    return i.editReply(`✅ Kész! Új rangok: ${e.rangok}, kategóriák: ${e.kategoriak}, csatornák: ${e.csatornak}. Frissített jogok: ${e.jogok}.`);
  },

  async rangvalaszto(i) {
    const sorok = [];
    const gombok = rangok.ertesitesek.map((nev) => {
      const [emoji, ...resz] = nev.split(' ');
      return new ButtonBuilder().setCustomId(`rang:${nev}`).setLabel(resz.join(' ')).setEmoji(emoji)
        .setStyle(ButtonStyle.Secondary);
    });
    for (let n = 0; n < gombok.length; n += 5) {
      sorok.push(new ActionRowBuilder().addComponents(gombok.slice(n, n + 5)));
    }
    await i.channel.send({
      embeds: [new EmbedBuilder().setColor(ROZSA).setTitle('🎭 Értesítések')
        .setDescription('Nyomd meg, amiről értesítést kérsz. Újra megnyomva leveszi a rangot.')],
      components: sorok,
    });
    return i.reply({ content: 'Kész!', ...privat });
  },

  async ticketpanel(i) {
    await i.channel.send({
      embeds: [new EmbedBuilder().setColor(ROZSA).setTitle('🎫 Segítség')
        .setDescription('Kérdésed van, vagy bajod akadt? Nyiss ticketet, és a stáb segít.')],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder()
        .setCustomId('ticket:nyitas').setLabel('Ticket nyitása').setEmoji('🎫').setStyle(ButtonStyle.Primary))],
    });
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

  async nyeremeny(i) {
    const nyeremeny = i.options.getString('nyeremeny');
    const perc = i.options.getInteger('perc');
    const nyertesek = i.options.getInteger('nyertesek') ?? 1;
    const vege = Date.now() + perc * 60_000;
    const cs = csatorna(i.guild, 'bejelentések') ?? i.channel;
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
    return i.reply({ content: `Felvéve: \`${kod}\``, ...privat });
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
    return i.reply({ embeds: [new EmbedBuilder().setColor(talalat.szin).setTitle(`🎲 ${talalat.ritkasag}!`)
      .setDescription(`${i.user} kihúzta: **${egyseg}**`)
      .setFooter({ text: 'Csak szerveres játék, a játékban nem ad semmit.' })] });
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
    if (i.isChatInputCommand()) return await muveletek[i.commandName]?.(i);
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
