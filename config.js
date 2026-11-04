// Itt tudod átírni a rangokat, csatornákat és szövegeket.
const K = { szerverNev: 'Anime Adventures HU' };

const rangok = {
  stab: [
    { nev: '👑 Hokage', szin: '#FF8C00', admin: true },
    { nev: '🔥 Hashira', szin: '#FF3B3B', jogok: ['ManageChannels', 'ManageRoles', 'BanMembers', 'KickMembers', 'ManageMessages', 'ModerateMembers'] },
    { nev: '⚔️ Kapitány', szin: '#E8E8E8', jogok: ['KickMembers', 'ManageMessages', 'ModerateMembers'] },
    { nev: '🍃 Jonin', szin: '#2ED573', jogok: ['ManageMessages'] },
  ],
  kulonleges: [
    { nev: '🚀 Saiyan Herceg', szin: '#F47FFF' },
    { nev: '🎥 Akatsuki', szin: '#C0392B' },
    { nev: '🏆 Pirátkirály', szin: '#FFD700' },
  ],
  // Szintrangok, a legerősebbtől lefelé
  szintek: [
    { nev: '🌌 Ultra Instinct', szin: '#DFE6E9', szint: 50 },
    { nev: '⚡ Super Saiyan', szin: '#FFD32A', szint: 40 },
    { nev: '👁️ Sharingan', szin: '#D63031', szint: 30 },
    { nev: '🗡️ Démonvadász', szin: '#00B894', szint: 20 },
    { nev: '🛡️ Felderítő', szin: '#6C7A89', szint: 10 },
    { nev: '🍥 Chunin', szin: '#FDCB6E', szint: 5 },
    { nev: '🌱 Genin', szin: '#B2BEC3', szint: 0 },
  ],
  ertesitesek: ['🔔 Kódok', '🔔 Frissítések', '🔔 Csere', '🔔 Raid', '🔔 Nyereményjáték'],
};

// iras: nincs megadva = mindenki írhat | 'stab' = csak a stáb írhat | 'rejtett' = csak a stáb látja
// A kategória iras értékét öröklik a csatornái, de csatornánként felülírható.
const kategoriak = [
  { nev: '━━━ 「 ⛩️ KAPU 」 ━━━', iras: 'stab', csatornak: [
    { nev: '╭・📜・szabályzat' },
    { nev: '┃・📢・bejelentések' },
    { nev: '╰・📰・hírek-és-kódok' },
  ]},
  { nev: '━━━ 「 🌸 TEAHÁZ 」 ━━━', csatornak: [
    { nev: '╭・💬・általános' },
    { nev: '┃・🖼️・képek' },
    { nev: '╰・🤖・bot-parancsok' },
  ]},
  { nev: '━━━ 「 ⚔️ CSATATÉR 」 ━━━', csatornak: [
    { nev: '╭・💡・tippek' },
    { nev: '┃・🏆・tier-lista', iras: 'stab' },
    { nev: '┃・🤝・csapatkeresés' },
    { nev: '┃・🎲・summon' },
    { nev: '╰・🔄・cserék' },
  ]},
  { nev: '━━━ 「 🏮 SEGÍTSÉG 」 ━━━', csatornak: [
    { nev: '╭・🎫・ticket', iras: 'stab' },
    { nev: '╰・🚨・csaló-jelentés' },
  ]},
  { nev: '━━━ 「 🔊 HANG 」 ━━━', csatornak: [
    { nev: '🎧・Teaház', hang: true },
    { nev: '🎮・Csata 1', hang: true },
    { nev: '🎮・Csata 2', hang: true },
  ]},
  { nev: '━━━ 「 🔒 STÁB 」 ━━━', iras: 'rejtett', csatornak: [
    { nev: '╭・🗡️・stáb-chat' },
    { nev: '╰・📋・logok' },
  ]},
  { nev: '━━━ 「 🔊 HANG 」 ━━━', csatornak: [
    { nev: '╭・🍵・Teaház', hang: true },
    { nev: '┃・🌸・Sakura Kert', hang: true },
    { nev: '┃・⚔️・Csatatér 1', hang: true },
    { nev: '┃・⚔️・Csatatér 2', hang: true },
    { nev: '┃・🗡️・Raid Csapat', hang: true },
    { nev: '┃・🎲・Summon Szoba', hang: true },
    { nev: '┃・🏮・Privát Szoba (2 fő)', hang: true, limit: 2 },
    { nev: '╰・💤・AFK Barlang', hang: true, afk: true },
  ]},
];

const beallitasok = {
  uzenetXpMin: 15,
  uzenetXpMax: 25,
  xpVarakozasMp: 60,       // ennyi másodpercenként jár XP
  summonVarakozasMp: 300,  // ennyi másodpercenként lehet /summon
  spamUzenet: 5,           // ennyi üzenet...
  spamMasodperc: 7,        // ...ennyi másodperc alatt spamnek számít
  nemitasPerc: 5,          // spamért járó némítás
  // Az ilyen szövegeket tartalmazó üzeneteket törli a bot
  tiltottSzovegek: [
    'discord.gg/', 'discord.com/invite/', 'discordapp.com/invite/',
    'free robux', 'ingyen robux', 'robux generator', 'free nitro', 'ingyen nitro',
    'steamcommunity.ru', 'dlscord', 'discorcl', 'roblox-free', 'grabify.link',
  ],
};

// A /summon kitalált, vicces egységei. Nem a játék valódi egységei.
const summon = [
  { ritkasag: 'Secret', esely: 1, szin: '#FF2E63', egysegek: ['Pörköltmester Sensei', 'A Nagy Paprikasárkány'] },
  { ritkasag: 'Mythic', esely: 4, szin: '#C77DFF', egysegek: ['Holdfény Szamuráj', 'Az Utolsó Lángmágus'] },
  { ritkasag: 'Legendary', esely: 10, szin: '#FFC837', egysegek: ['Viharpenge Kira', 'Aranyöklű Taro'] },
  { ritkasag: 'Epic', esely: 20, szin: '#B388FF', egysegek: ['Árnyék Ninja', 'Tűzrókás Lány'] },
  { ritkasag: 'Rare', esely: 30, szin: '#4DA6FF', egysegek: ['Kék Kardforgató', 'Kezdő Varázsló'] },
  { ritkasag: 'Common', esely: 35, szin: '#C4C9D1', egysegek: ['Fáradt Diák', 'Pogácsa Őr', 'Random Falusi'] },
];

// A /napi parancs ezekből sorsol naponta 3 különböző típusú küldetést.
const kuldetesSablonok = [
  { tipus: 'uzenet', cel: 10, szoveg: 'Küldj 10 üzenetet', xp: 40 },
  { tipus: 'uzenet', cel: 25, szoveg: 'Küldj 25 üzenetet', xp: 80 },
  { tipus: 'summon', cel: 1, szoveg: 'Használd a /summon parancsot', xp: 30 },
  { tipus: 'summon', cel: 3, szoveg: 'Használd 3-szor a /summon parancsot', xp: 70 },
  { tipus: 'csapat', cel: 1, szoveg: 'Hirdess csapatot a /csapat paranccsal', xp: 50 },
  { tipus: 'csere', cel: 1, szoveg: 'Hirdess cserét a /csere paranccsal', xp: 50 },
  { tipus: 'ertekeles', cel: 1, szoveg: 'Értékelj egy cserepartnert az /ertekeles paranccsal', xp: 40 },
];

// A /telepites ezeket a szövegeket rakja ki és tűzi ki magától.
const szovegek = [
  { kulcs: 'szabályzat', szoveg: `**Üdv az ${K.szerverNev} szerveren!** Ez egy nem hivatalos, rajongói közösség.

1. Légy tisztelettudó, a sértegetés és a zaklatás tilos.
2. Tilos a gyűlöletbeszéd és a felnőtt tartalom.
3. Tilos a spam és a reklám a stáb engedélye nélkül.
4. Tilos a csalás, a hackelés és az exploitok megosztása.
5. Ne oszd meg senki személyes adatait.
6. A beszélgetés nyelve magyar.
7. Mindent a megfelelő csatornába írj.
8. Pénzért cserélni vagy fiókot adni-venni tilos.
9. Tartsd be a Discord és a Roblox szabályait.
10. A stáb döntését tartsd tiszteletben. Ha vitád van, nyiss ticketet.` },
  { kulcs: 'cserék', szoveg: `**Biztonságos csere**
- Hirdetni a \`/csere\` paranccsal tudsz, sikeres csere után pedig \`/ertekeles\` paranccsal értékelj.
- Csak a játékban cserélj, a szerver nem vállal felelősséget az elveszett tárgyakért.
- Soha ne add meg senkinek a jelszavadat vagy a Roblox-fiókodat.
- Ne kattints ismeretlen linkekre, és ne tölts le semmit cserepartnertől.
- A csalókat a csaló-jelentés csatornában jelentsd, képpel együtt.` },
];

module.exports = { K, rangok, kategoriak, beallitasok, summon, kuldetesSablonok, szovegek };
