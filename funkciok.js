// Az újabb funkciók: moderáció, csapatkereső, csere, napi küldetések, gyűjtemény.
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ChannelType, PermissionFlagsBits: P,
} = require('discord.js');
const { kuldetesSablonok, summon, lfgModok, jutalmak: J, rangok } = require('./config');
const { adat, ment } = require('./adat');
const { szintXpbol } = require('./szintek');

const privat = { flags: MessageFlags.Ephemeral };
const ROZSA = 0x9b59b6;
const NAP = 86_400_000;
const CSAPAT_LEJARAT = NAP;
const HET = 7 * NAP;
const EMLEKEZTETO = 5 * 60_000;
const ROBLOX_LINK = /^https:\/\/((www\.)?roblox\.com|ro\.blox\.com)\//i;

// Magyar idő szerinti napszám (téli időszámítással számolva)
const maiNap = () => Math.floor((Date.now() + 3_600_000) / NAP);
const kever = (lista) => [...lista].sort(() => Math.random() - 0.5);
// Hétfőn kezdődő hét sorszáma
const maiHet = () => Math.floor((Date.now() + 3_600_000 + 3 * NAP) / HET);
const toplista = (o, db = 10) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, db);

module.exports = ({ csatorna, log, xpAd }) => {
  // ---------- Napi küldetések ----------
  function kuldetesek(id) {
    const nap = maiNap();
    let k = adat.kuldetes[id];
    if (!k || k.nap !== nap) {
      const lista = [];
      for (const s of kever(kuldetesSablonok)) {
        if (lista.some((m) => m.tipus === s.tipus)) continue;
        lista.push({ ...s, jelen: 0, kesz: false });
        if (lista.length === 3) break;
      }
      k = { nap, lista };
      adat.kuldetes[id] = k;
      ment();
    }
    return k;
  }

  async function halad(tag, tipus, cs) {
    for (const m of kuldetesek(tag.id).lista) {
      if (m.tipus !== tipus || m.kesz) continue;
      m.jelen++;
      ment();
      if (m.jelen < m.cel) continue;
      m.kesz = true;
      await cs?.send({
        content: `✅ ${tag} teljesítette: **${m.szoveg}** (+${m.xp} XP)`,
        allowedMentions: { parse: [] },
      }).catch(() => {});
      await xpAd(tag, m.xp, cs);
    }
  }

  // ---------- Csapatkereső ----------
  function csapatEmbed(cs) {
    const tagok = cs.tagok.map((t) => `<@${t}>`).join('\n');
    const sorok = [`**Létszám:** ${cs.tagok.length}/${cs.letszam}${cs.lezart ? ' (lezárva)' : ''}`];
    if (cs.kezdes) sorok.push(`**Kezdés:** <t:${Math.floor(cs.kezdes / 1000)}:R>`);
    if (cs.minSzint) sorok.push(`**Minimum szint:** ${cs.minSzint}`);
    if (cs.elvaras) sorok.push(`**Elvárás:** ${cs.elvaras}`);
    if (cs.link) sorok.push('🔗 Privát szerver link a csapatnak');
    return new EmbedBuilder().setColor(cs.lezart ? 0x747f8d : 0x2ed573)
      .setTitle(`🤝 ${cs.cim}`)
      .setDescription(`${sorok.join('\n')}\n\n${tagok}`);
  }

  function csapatGombok(id, cs) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`csapat:${id}`).setLabel('Csatlakozom / kilépek').setEmoji('⚔️')
        .setStyle(ButtonStyle.Success).setDisabled(Boolean(cs.lezart)),
      new ButtonBuilder().setCustomId(`csapatzar:${id}`).setLabel('Lezárás').setStyle(ButtonStyle.Secondary)
        .setDisabled(Boolean(cs.lezart)),
    );
  }

  // Megtelt csapatnak saját, csak nekik látható hangszobát nyit.
  async function hangszobaNyitas(guild, cs) {
    const hang = guild.channels.cache.find((c) => c.type === ChannelType.GuildVoice && c.parentId);
    const jogok = [
      { id: guild.roles.everyone.id, deny: [P.ViewChannel, P.Connect] },
      { id: guild.client.user.id, allow: [P.ViewChannel, P.Connect, P.ManageChannels, P.SendMessages] },
      ...cs.tagok.map((id) => ({ id, allow: [P.ViewChannel, P.Connect, P.Speak, P.SendMessages] })),
    ];
    const szoba = await guild.channels.create({
      name: `⚔️・${cs.cim}`,
      type: ChannelType.GuildVoice,
      parent: hang?.parentId,
      userLimit: cs.letszam,
      permissionOverwrites: jogok,
    });
    adat.hangszobak[szoba.id] = { kezdes: Math.max(Date.now(), cs.kezdes ?? 0), voltak: [] };
    ment();
    await szoba.send({
      content: `⚔️ ${cs.tagok.map((t) => `<@${t}>`).join(' ')} itt a saját szobátok!`
        + `${cs.link ? `\n🔗 Privát szerver: ${cs.link}` : ''}`,
      allowedMentions: { users: cs.tagok },
    }).catch(console.error);
    return szoba;
  }

  async function hangszobaZaras(client, id, szoba) {
    const h = adat.hangszobak[id];
    delete adat.hangszobak[id];
    ment();
    // Közös játék: legalább 2 tag volt bent, és a minimum idő is letelt.
    if (h && szoba && h.voltak.length >= 2 && Date.now() - h.kezdes >= J.lfgMinPerc * 60_000) {
      for (const tagId of h.voltak) {
        adat.lfgPontok[tagId] = (adat.lfgPontok[tagId] ?? 0) + 1;
        const tag = await szoba.guild.members.fetch(tagId).catch(() => null);
        if (tag) await xpAd(tag, J.lfgXp, csatorna(szoba.guild, 'csapatkeresés'));
      }
      ment();
    }
    await szoba?.delete('Üres csapatszoba').catch(() => {});
  }

  async function hangValtozas(regi, uj) {
    const belepett = uj.channelId && adat.hangszobak[uj.channelId];
    if (belepett && !belepett.voltak.includes(uj.id)) {
      belepett.voltak.push(uj.id);
      ment();
    }
    // Túl korai kilépésnél a szoba megmarad, hogy a csapat visszajöhessen.
    const h = regi.channelId !== uj.channelId ? adat.hangszobak[regi.channelId] : null;
    if (h && regi.channel?.members.size === 0 && Date.now() - h.kezdes >= J.lfgMinPerc * 60_000) {
      await hangszobaZaras(regi.client, regi.channelId, regi.channel);
    }
  }

  async function csapatTick(client) {
    const most = Date.now();
    for (const [id, cs] of Object.entries(adat.csapatok)) {
      if (cs.kezdes && !cs.emlekeztetve && most >= cs.kezdes - EMLEKEZTETO) {
        cs.emlekeztetve = true;
        adat.emlekeztetok.push({ ido: 0, csatorna: cs.csatorna, tagok: [...cs.tagok], cim: cs.cim });
        ment();
      }
      if (most - Math.max(cs.ido, cs.kezdes ?? 0) < CSAPAT_LEJARAT) continue;
      delete adat.csapatok[id];
      ment();
      cs.lezart = true;
      const ch = await client.channels.fetch(cs.csatorna).catch(() => null);
      const u = await ch?.messages.fetch(id).catch(() => null);
      u?.edit({ embeds: [csapatEmbed(cs)], components: [csapatGombok(id, cs)] }).catch(() => {});
    }

    for (const e of adat.emlekeztetok.filter((x) => most >= x.ido)) {
      const ch = await client.channels.fetch(e.csatorna).catch(() => null);
      await ch?.send({
        content: `⏰ ${e.tagok.map((t) => `<@${t}>`).join(' ')} hamarosan kezdődik: **${e.cim}**`,
        allowedMentions: { users: e.tagok },
      }).catch(() => {});
    }
    const maradt = adat.emlekeztetok.filter((x) => most < x.ido);
    if (maradt.length !== adat.emlekeztetok.length) {
      adat.emlekeztetok = maradt;
      ment();
    }

    for (const [id, h] of Object.entries(adat.hangszobak)) {
      if (most - h.kezdes < J.lfgMinPerc * 60_000) continue;
      const szoba = await client.channels.fetch(id).catch(() => null);
      if (!szoba) {
        delete adat.hangszobak[id];
        ment();
      } else if (szoba.members.size === 0) await hangszobaZaras(client, id, szoba);
    }
    await hetiTick(client);
  }

  // ---------- Heti verseny ----------
  function hetiPont(id, tipus, pont = 1) {
    adat.heti[tipus][id] = (adat.heti[tipus][id] ?? 0) + pont;
    ment();
  }

  async function hetiTick(client) {
    const het = maiHet();
    const h = adat.heti;
    if (h.het === het) return;
    if (h.het === 0) {
      h.het = het;
      ment();
      return;
    }
    const [elsoXp] = toplista(h.xp, 1);
    const [elsoSecret] = toplista(h.secret, 1);
    const guild = client.guilds.cache.first();
    const nyertesRang = guild?.roles.cache.find((r) => r.name === rangok.kulonleges[2].nev);
    if (guild && elsoXp) {
      if (h.nyertes && nyertesRang) {
        const regi = await guild.members.fetch(h.nyertes).catch(() => null);
        await regi?.roles.remove(nyertesRang).catch(() => {});
      }
      const uj = await guild.members.fetch(elsoXp[0]).catch(() => null);
      if (nyertesRang) await uj?.roles.add(nyertesRang).catch(console.error);
      await csatorna(guild, 'bejelentések')?.send({
        embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('🏆 A hét nyertesei')
          .setDescription(`**Legaktívabb:** <@${elsoXp[0]}> (${elsoXp[1]} XP)\n`
            + `**Legszerencsésebb:** ${elsoSecret ? `<@${elsoSecret[0]}> (${elsoSecret[1]} Secret)` : 'senki'}`)],
      }).catch(() => {});
      h.nyertes = elsoXp[0];
    }
    h.het = het;
    h.xp = {};
    h.secret = {};
    ment();
  }

  // ---------- Meghívók ----------
  async function meghivoJovairas(tag, meghivoId) {
    if (!meghivoId || meghivoId === tag.id || tag.user.bot || adat.meghivott[tag.id]) return;
    if (Date.now() - tag.user.createdTimestamp < J.meghivoMinNap * NAP) return;
    adat.meghivott[tag.id] = meghivoId;
    adat.meghivok[meghivoId] = (adat.meghivok[meghivoId] ?? 0) + 1;
    ment();
    const meghivo = await tag.guild.members.fetch(meghivoId).catch(() => null);
    if (meghivo) await xpAd(meghivo, J.meghivoXp, csatorna(tag.guild, 'bot-parancsok'));
  }

  // ---------- Moderáció segédek ----------
  // Csak nálad alacsonyabb rangú tagot moderálhatsz.
  const felette = (i, cel) => i.guild.ownerId === i.user.id
    || i.member.roles.highest.comparePositionTo(cel.roles.highest) > 0;

  function celTag(i) {
    const cel = i.options.getMember('tag');
    if (!cel) return { hiba: 'Ez a felhasználó nincs a szerveren.' };
    if (cel.id === i.user.id) return { hiba: 'Magadon ezt nem használhatod.' };
    if (!felette(i, cel)) return { hiba: 'Ez a tag nálad magasabb vagy azonos rangú.' };
    return { cel };
  }

  const kesz = (i, szoveg) => {
    log(i.guild, szoveg);
    return i.reply({ content: szoveg, allowedMentions: { parse: [] }, ...privat });
  };

  const muveletek = {
    // ---------- Moderáció ----------
    async warn(i) {
      const { cel, hiba } = celTag(i);
      if (hiba) return i.reply({ content: hiba, ...privat });
      const indok = i.options.getString('indok');
      (adat.warnok[cel.id] ??= []).push({ indok, ki: i.user.id, ido: Date.now() });
      ment();
      await cel.send(`⚠️ Figyelmeztetést kaptál a(z) **${i.guild.name}** szerveren: ${indok}`).catch(() => {});
      return kesz(i, `⚠️ ${cel.user.tag} figyelmeztetve (${adat.warnok[cel.id].length}.): ${indok}`);
    },

    async figyelmeztetesek(i) {
      const u = i.options.getUser('tag');
      const lista = adat.warnok[u.id] ?? [];
      if (!lista.length) return i.reply({ content: `${u.tag} tagnak nincs figyelmeztetése.`, ...privat });
      const sorok = lista.map((w, n) => `**${n + 1}.** ${w.indok} (<@${w.ki}>, <t:${Math.floor(w.ido / 1000)}:d>)`);
      return i.reply({
        embeds: [new EmbedBuilder().setColor(0xffa502).setTitle(`⚠️ ${u.tag}`)
          .setDescription(sorok.join('\n').slice(0, 4000))],
        ...privat,
      });
    },

    async 'warn-torles'(i) {
      const u = i.options.getUser('tag');
      delete adat.warnok[u.id];
      ment();
      return kesz(i, `🧹 ${u.tag} figyelmeztetései törölve (${i.user.tag}).`);
    },

    async nemit(i) {
      const { cel, hiba } = celTag(i);
      if (hiba) return i.reply({ content: hiba, ...privat });
      if (!cel.moderatable) return i.reply({ content: 'Ezt a tagot a bot nem tudja némítani.', ...privat });
      const perc = i.options.getInteger('perc');
      const indok = i.options.getString('indok') ?? 'Nincs indok';
      await cel.timeout(perc * 60_000, indok);
      return kesz(i, `🔇 ${cel.user.tag} némítva ${perc} percre: ${indok} (${i.user.tag})`);
    },

    async kirug(i) {
      const { cel, hiba } = celTag(i);
      if (hiba) return i.reply({ content: hiba, ...privat });
      if (!cel.kickable) return i.reply({ content: 'Ezt a tagot a bot nem tudja kirúgni.', ...privat });
      const indok = i.options.getString('indok') ?? 'Nincs indok';
      await cel.kick(indok);
      return kesz(i, `👢 ${cel.user.tag} kirúgva: ${indok} (${i.user.tag})`);
    },

    async kitilt(i) {
      const { cel, hiba } = celTag(i);
      if (hiba) return i.reply({ content: hiba, ...privat });
      if (!cel.bannable) return i.reply({ content: 'Ezt a tagot a bot nem tudja kitiltani.', ...privat });
      const indok = i.options.getString('indok') ?? 'Nincs indok';
      await cel.ban({ reason: indok });
      return kesz(i, `🔨 ${cel.user.tag} kitiltva: ${indok} (${i.user.tag})`);
    },

    async torles(i) {
      const torolt = await i.channel.bulkDelete(i.options.getInteger('darab'), true);
      return kesz(i, `🧹 ${torolt.size} üzenet törölve a(z) #${i.channel.name} csatornában (${i.user.tag}).`);
    },

    // ---------- Csapatkereső ----------
    async lfg(i) {
      const mod = lfgModok.find((m) => m.nev === i.options.getString('mod'));
      const link = i.options.getString('link');
      if (link && !ROBLOX_LINK.test(link)) {
        return i.reply({ content: 'Csak roblox.com link adható meg.', ...privat });
      }
      const perc = i.options.getInteger('kezdes_perc');
      const cs = {
        cim: mod.nev,
        letszam: i.options.getInteger('letszam'),
        tulaj: i.user.id,
        tagok: [i.user.id],
        ido: Date.now(),
        kezdes: perc ? Date.now() + perc * 60_000 : undefined,
        link: link ?? undefined,
        minSzint: i.options.getInteger('min_szint') ?? undefined,
        elvaras: i.options.getString('elvaras') ?? undefined,
      };
      const ch = csatorna(i.guild, 'csapatkeresés') ?? i.channel;
      const pingRang = i.guild.roles.cache.find((r) => r.name === mod.ping);
      const u = await ch.send({
        content: pingRang ? `${pingRang}` : undefined,
        embeds: [csapatEmbed(cs)],
        allowedMentions: { roles: pingRang ? [pingRang.id] : [] },
      });
      cs.csatorna = ch.id;
      adat.csapatok[u.id] = cs;
      ment();
      await u.edit({ components: [csapatGombok(u.id, cs)] });
      await i.reply({ content: `Kiraktam ide: ${ch}`, ...privat });
      return halad(i.member, 'csapat', i.channel);
    },

    async 'lfg-toplista'(i) {
      const top = toplista(adat.lfgPontok);
      if (!top.length) return i.reply({ content: 'Még nincs lejátszott csapat.', ...privat });
      return i.reply({
        embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('🤝 LFG toplista')
          .setDescription(top.map(([id, p], n) => `**${n + 1}.** <@${id}>: ${p} közös játék`).join('\n'))],
        allowedMentions: { parse: [] },
      });
    },

    async meghivok(i) {
      const u = i.options.getUser('tag') ?? i.user;
      return i.reply({
        content: `📨 **${u.username}:** ${adat.meghivok[u.id] ?? 0} meghívott tag`,
        allowedMentions: { parse: [] },
      });
    },

    async heti(i) {
      const sorok = toplista(adat.heti.xp, 5).map(([id, p], n) => `**${n + 1}.** <@${id}>: ${p} XP`);
      const secret = toplista(adat.heti.secret, 3).map(([id, p]) => `<@${id}>: ${p}`);
      return i.reply({
        embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('🏆 Heti verseny')
          .setDescription(`**Legaktívabbak**\n${sorok.join('\n') || 'Még senki'}\n\n`
            + `**Secret húzások**\n${secret.join('\n') || 'Még senki'}\n\nA nyertes hétfőn kapja a rangot.`)],
        allowedMentions: { parse: [] },
      });
    },

    async csapatom(i) {
      if (i.options.getSubcommand() === 'beallit') {
        adat.csapatom[i.user.id] = i.options.getString('egysegek').split(',').map((e) => e.trim()).filter(Boolean).slice(0, 10);
        ment();
        return i.reply({ content: 'Elmentettem az összeállításod.', ...privat });
      }
      const u = i.options.getUser('tag') ?? i.user;
      const lista = adat.csapatom[u.id];
      if (!lista) return i.reply({ content: 'Nincs mentett összeállítás. Használd: `/csapatom beallit`', ...privat });
      return i.reply({
        embeds: [new EmbedBuilder().setColor(ROZSA).setTitle(`⚔️ ${u.username} csapata`)
          .setDescription(lista.map((e, n) => `**${n + 1}.** ${e}`).join('\n'))],
      });
    },

    // ---------- Csere ----------
    async csere(i) {
      const ch = csatorna(i.guild, 'cserék') ?? i.channel;
      const pontok = Object.values(adat.ertekelesek[i.user.id] ?? {});
      const hirnev = pontok.length
        ? `⭐ ${(pontok.reduce((o, p) => o + p, 0) / pontok.length).toFixed(1)} (${pontok.length} értékelés)`
        : 'Még nincs értékelése';
      await ch.send({
        embeds: [new EmbedBuilder().setColor(0x1abc9c).setTitle('🔄 Cserehirdetés')
          .setDescription(`**Hirdető:** ${i.user}\n**Hírnév:** ${hirnev}`)
          .addFields(
            { name: 'Adok', value: i.options.getString('adok') },
            { name: 'Kérek', value: i.options.getString('kerek') },
          )],
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder()
          .setCustomId(`csereerdekel:${i.user.id}`).setLabel('Érdekel').setEmoji('🤝').setStyle(ButtonStyle.Primary))],
      });
      await i.reply({ content: `Kiraktam ide: ${ch}`, ...privat });
      return halad(i.member, 'csere', i.channel);
    },

    async ertekeles(i) {
      const u = i.options.getUser('tag');
      if (u.id === i.user.id || u.bot) return i.reply({ content: 'Őt nem értékelheted.', ...privat });
      (adat.ertekelesek[u.id] ??= {})[i.user.id] = i.options.getInteger('pont');
      ment();
      await i.reply({ content: `Értékelted: ${u.tag}, ${i.options.getInteger('pont')} ⭐`, ...privat });
      return halad(i.member, 'ertekeles', i.channel);
    },

    async hirnev(i) {
      const u = i.options.getUser('tag') ?? i.user;
      const pontok = Object.values(adat.ertekelesek[u.id] ?? {});
      if (!pontok.length) return i.reply({ content: `${u.tag} tagnak még nincs értékelése.`, ...privat });
      const atlag = pontok.reduce((o, p) => o + p, 0) / pontok.length;
      return i.reply({ content: `⭐ **${u.tag}:** ${atlag.toFixed(1)} (${pontok.length} értékelés)`, allowedMentions: { parse: [] } });
    },

    // ---------- Napi ----------
    async napi(i) {
      const nap = maiNap();
      const n = adat.napi[i.user.id] ?? { utolso: 0, sorozat: 0 };
      let felso;
      if (n.utolso === nap) {
        felso = `Ma már átvetted a jutalmat. Sorozat: **${n.sorozat} nap** 🔥`;
      } else {
        n.sorozat = n.utolso === nap - 1 ? n.sorozat + 1 : 1;
        n.utolso = nap;
        adat.napi[i.user.id] = n;
        ment();
        const jutalom = 50 + 10 * Math.min(n.sorozat, 10);
        felso = `🎁 **+${jutalom} XP!** Sorozat: **${n.sorozat} nap** 🔥`;
        await xpAd(i.member, jutalom, i.channel);
      }
      const sorok = kuldetesek(i.user.id).lista.map((m) => (
        `${m.kesz ? '✅' : '⬜'} ${m.szoveg} (${Math.min(m.jelen, m.cel)}/${m.cel}), ${m.xp} XP`));
      return i.reply({
        embeds: [new EmbedBuilder().setColor(ROZSA).setTitle('📅 Napi jutalom és küldetések')
          .setDescription(`${felso}\n\n${sorok.join('\n')}`)],
        ...privat,
      });
    },

    // ---------- Gyűjtemény ----------
    async gyujtemeny(i) {
      const u = i.options.getUser('tag') ?? i.user;
      const gy = adat.gyujtemeny[u.id] ?? {};
      if (!Object.keys(gy).length) return i.reply({ content: 'Ez a gyűjtemény még üres, próbáld a `/summon` parancsot!', ...privat });
      const mezok = [];
      for (const s of summon) {
        const sorok = s.egysegek.filter((e) => gy[e]).map((e) => `${e} ×${gy[e]}`);
        if (sorok.length) mezok.push({ name: s.ritkasag, value: sorok.join('\n') });
      }
      const osszes = summon.reduce((o, s) => o + s.egysegek.length, 0);
      const megvan = summon.reduce((o, s) => o + s.egysegek.filter((e) => gy[e]).length, 0);
      return i.reply({
        embeds: [new EmbedBuilder().setColor(ROZSA).setTitle(`📖 ${u.username} gyűjteménye (${megvan}/${osszes})`)
          .addFields(mezok)],
      });
    },
  };

  const gombok = {
    async csapat(i, id) {
      const cs = adat.csapatok[id];
      if (!cs) return i.reply({ content: 'Ez a csapat már lezárult.', ...privat });
      const hely = cs.tagok.indexOf(i.user.id);
      if (hely >= 0) {
        if (i.user.id === cs.tulaj) return i.reply({ content: 'A hirdető nem léphet ki, de lezárhatja a csapatot.', ...privat });
        cs.tagok.splice(hely, 1);
      } else {
        if (cs.minSzint && szintXpbol(adat.xp[i.user.id] ?? 0) < cs.minSzint) {
          return i.reply({ content: `Ehhez legalább ${cs.minSzint}. szint kell.`, ...privat });
        }
        cs.tagok.push(i.user.id);
      }
      if (cs.tagok.length >= cs.letszam) {
        cs.lezart = true;
        delete adat.csapatok[id];
        if (cs.kezdes && !cs.emlekeztetve && cs.kezdes > Date.now()) {
          adat.emlekeztetok.push({ ido: cs.kezdes - EMLEKEZTETO, csatorna: cs.csatorna, tagok: [...cs.tagok], cim: cs.cim });
        }
      }
      ment();
      await i.update({ embeds: [csapatEmbed(cs)], components: [csapatGombok(id, cs)] });
      if (cs.lezart) {
        const szoba = await hangszobaNyitas(i.guild, cs);
        await i.channel.send({
          content: `🎉 Megtelt a csapat: ${cs.tagok.map((t) => `<@${t}>`).join(' ')}! Szobátok: ${szoba}`,
          allowedMentions: { users: cs.tagok },
        }).catch(() => {});
      }
    },

    async csapatzar(i, id) {
      const cs = adat.csapatok[id];
      if (!cs) return i.reply({ content: 'Ez a csapat már lezárult.', ...privat });
      if (i.user.id !== cs.tulaj && !i.member.permissions.has('ManageMessages')) {
        return i.reply({ content: 'Csak a hirdető zárhatja le.', ...privat });
      }
      cs.lezart = true;
      delete adat.csapatok[id];
      ment();
      return i.update({ embeds: [csapatEmbed(cs)], components: [csapatGombok(id, cs)] });
    },

    async csereerdekel(i, tulaj) {
      if (i.user.id === tulaj) return i.reply({ content: 'Ez a saját hirdetésed.', ...privat });
      await i.channel.send({
        content: `🤝 <@${tulaj}>, ${i.user} érdeklődik a cseréd iránt!`,
        allowedMentions: { users: [tulaj] },
      });
      return i.reply({ content: 'Szóltam a hirdetőnek.', ...privat });
    },
  };

  return { muveletek, gombok, halad, csapatTick, hangValtozas, hetiPont, meghivoJovairas };
};
