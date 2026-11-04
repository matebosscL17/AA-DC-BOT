// Az újabb funkciók: moderáció, csapatkereső, csere, napi küldetések, gyűjtemény.
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const { kuldetesSablonok, summon } = require('./config');
const { adat, ment } = require('./adat');

const privat = { flags: MessageFlags.Ephemeral };
const ROZSA = 0x9b59b6;
const NAP = 86_400_000;
const CSAPAT_LEJARAT = NAP;

// Magyar idő szerinti napszám (téli időszámítással számolva)
const maiNap = () => Math.floor((Date.now() + 3_600_000) / NAP);
const kever = (lista) => [...lista].sort(() => Math.random() - 0.5);

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
    return new EmbedBuilder().setColor(cs.lezart ? 0x747f8d : 0x2ed573)
      .setTitle(`🤝 ${cs.cim}`)
      .setDescription(`**Létszám:** ${cs.tagok.length}/${cs.letszam}${cs.lezart ? ' (lezárva)' : ''}\n\n${tagok}`);
  }

  function csapatGombok(id, cs) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`csapat:${id}`).setLabel('Csatlakozom / kilépek').setEmoji('⚔️')
        .setStyle(ButtonStyle.Success).setDisabled(Boolean(cs.lezart)),
      new ButtonBuilder().setCustomId(`csapatzar:${id}`).setLabel('Lezárás').setStyle(ButtonStyle.Secondary)
        .setDisabled(Boolean(cs.lezart)),
    );
  }

  async function csapatLejarat(client) {
    for (const [id, cs] of Object.entries(adat.csapatok)) {
      if (Date.now() - cs.ido < CSAPAT_LEJARAT) continue;
      delete adat.csapatok[id];
      ment();
      cs.lezart = true;
      const ch = await client.channels.fetch(cs.csatorna).catch(() => null);
      const u = await ch?.messages.fetch(id).catch(() => null);
      u?.edit({ embeds: [csapatEmbed(cs)], components: [csapatGombok(id, cs)] }).catch(() => {});
    }
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
    async csapat(i) {
      const cs = {
        cim: i.options.getString('mit'),
        letszam: i.options.getInteger('letszam'),
        tulaj: i.user.id,
        tagok: [i.user.id],
        ido: Date.now(),
      };
      const ch = csatorna(i.guild, 'csapatkeresés') ?? i.channel;
      const u = await ch.send({ embeds: [csapatEmbed(cs)] });
      cs.csatorna = ch.id;
      adat.csapatok[u.id] = cs;
      ment();
      await u.edit({ components: [csapatGombok(u.id, cs)] });
      await i.reply({ content: `Kiraktam ide: ${ch}`, ...privat });
      return halad(i.member, 'csapat', i.channel);
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
        cs.tagok.push(i.user.id);
      }
      if (cs.tagok.length >= cs.letszam) {
        cs.lezart = true;
        delete adat.csapatok[id];
      }
      ment();
      await i.update({ embeds: [csapatEmbed(cs)], components: [csapatGombok(id, cs)] });
      if (cs.lezart) {
        await i.channel.send(`🎉 Megtelt a csapat: ${cs.tagok.map((t) => `<@${t}>`).join(' ')}`).catch(() => {});
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

  return { muveletek, gombok, halad, csapatLejarat };
};
