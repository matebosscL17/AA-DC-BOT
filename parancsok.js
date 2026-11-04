const { SlashCommandBuilder: S, PermissionFlagsBits: P } = require('discord.js');
const { lfgModok } = require('./config');

const admin = (b) => b.setDefaultMemberPermissions(P.ManageGuild);
const jog = (b, j) => b.setDefaultMemberPermissions(j);
const tagOpcio = (o) => o.setName('tag').setDescription('Melyik tag?').setRequired(true);
const indokOpcio = (o) => o.setName('indok').setDescription('Miért?').setMaxLength(300);

module.exports = [
  admin(new S().setName('telepites').setDescription('Létrehozza a rangokat és csatornákat, és beállítja a jogokat')),
  admin(new S().setName('rangvalaszto').setDescription('Kirakja a rangválasztó gombokat ebbe a csatornába')),
  admin(new S().setName('ticketpanel').setDescription('Kirakja a ticketnyitó gombot ebbe a csatornába')),
  admin(new S().setName('changelog').setDescription('Frissítés posztolása a bejelentések csatornába')
    .addStringOption((o) => o.setName('cim').setDescription('A frissítés címe').setRequired(true).setMaxLength(200))
    .addStringOption((o) => o.setName('szoveg').setDescription('Szöveg, új sor: \\n').setRequired(true).setMaxLength(3000))),
  admin(new S().setName('nyeremeny').setDescription('Nyereményjáték indítása')
    .addStringOption((o) => o.setName('nyeremeny').setDescription('Mit lehet nyerni?').setRequired(true).setMaxLength(200))
    .addIntegerOption((o) => o.setName('perc').setDescription('Hány percig tart?').setRequired(true).setMinValue(1).setMaxValue(10080))
    .addIntegerOption((o) => o.setName('nyertesek').setDescription('Nyertesek száma').setMinValue(1).setMaxValue(20))),
  admin(new S().setName('kod-hozzaad').setDescription('Játékkód felvétele a listára')
    .addStringOption((o) => o.setName('kod').setDescription('A kód').setRequired(true).setMaxLength(100))
    .addStringOption((o) => o.setName('jutalom').setDescription('Mit ad a kód?').setMaxLength(200))),
  admin(new S().setName('kod-torol').setDescription('Játékkód törlése a listáról')
    .addStringOption((o) => o.setName('kod').setDescription('A kód').setRequired(true).setMaxLength(100))),
  new S().setName('kodok').setDescription('A felvett játékkódok listája'),
  new S().setName('summon').setDescription('Vicces, kitalált summon a szerveren'),
  new S().setName('szint').setDescription('Megmutatja a szintet és az XP-t')
    .addUserOption((o) => o.setName('tag').setDescription('Kinek a szintjét nézzük?')),
  new S().setName('ranglista').setDescription('A 10 legaktívabb tag'),
  jog(new S().setName('warn').setDescription('Figyelmeztetés adása')
    .addUserOption(tagOpcio)
    .addStringOption((o) => o.setName('indok').setDescription('Miért?').setRequired(true).setMaxLength(300)), P.ModerateMembers),
  jog(new S().setName('figyelmeztetesek').setDescription('Egy tag figyelmeztetései').addUserOption(tagOpcio), P.ModerateMembers),
  jog(new S().setName('warn-torles').setDescription('Egy tag összes figyelmeztetésének törlése').addUserOption(tagOpcio), P.ModerateMembers),
  jog(new S().setName('nemit').setDescription('Tag némítása')
    .addUserOption(tagOpcio)
    .addIntegerOption((o) => o.setName('perc').setDescription('Hány perc?').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(indokOpcio), P.ModerateMembers),
  jog(new S().setName('kirug').setDescription('Tag kirúgása').addUserOption(tagOpcio).addStringOption(indokOpcio), P.KickMembers),
  jog(new S().setName('kitilt').setDescription('Tag kitiltása').addUserOption(tagOpcio).addStringOption(indokOpcio), P.BanMembers),
  jog(new S().setName('torles').setDescription('Üzenetek törlése ebben a csatornában')
    .addIntegerOption((o) => o.setName('darab').setDescription('Hány üzenet?').setRequired(true).setMinValue(1).setMaxValue(100)), P.ManageMessages),
  new S().setName('lfg').setDescription('Csapatkereső hirdetés')
    .addStringOption((o) => o.setName('mod').setDescription('Játékmód').setRequired(true)
      .addChoices(...lfgModok.map((m) => ({ name: m.nev, value: m.nev }))))
    .addIntegerOption((o) => o.setName('letszam').setDescription('Hány fő összesen?').setRequired(true).setMinValue(2).setMaxValue(10))
    .addIntegerOption((o) => o.setName('kezdes_perc').setDescription('Hány perc múlva kezdtek? Üresen: most').setMinValue(1).setMaxValue(1440))
    .addStringOption((o) => o.setName('link').setDescription('Roblox privát szerver link, csak a csapat kapja meg').setMaxLength(300))
    .addIntegerOption((o) => o.setName('min_szint').setDescription('Legalább ilyen szerverszint kell').setMinValue(1).setMaxValue(100))
    .addStringOption((o) => o.setName('elvaras').setDescription('Például: csak haladóknak').setMaxLength(150)),
  new S().setName('lfg-toplista').setDescription('A legtöbb közös játékot lejátszó tagok'),
  new S().setName('meghivok').setDescription('Hány tagot hívott meg valaki')
    .addUserOption((o) => o.setName('tag').setDescription('Melyik tag?')),
  new S().setName('heti').setDescription('A heti verseny állása'),
  new S().setName('csapatom').setDescription('Egység-összeállítás')
    .addSubcommand((c) => c.setName('beallit').setDescription('A saját összeállításod mentése')
      .addStringOption((o) => o.setName('egysegek').setDescription('Egységek vesszővel elválasztva').setRequired(true).setMaxLength(500)))
    .addSubcommand((c) => c.setName('nez').setDescription('Összeállítás megnézése')
      .addUserOption((o) => o.setName('tag').setDescription('Kié?'))),
  admin(new S().setName('hir').setDescription('Hír kirakása pingeléssel')
    .addStringOption((o) => o.setName('cim').setDescription('A hír címe').setRequired(true).setMaxLength(200))
    .addStringOption((o) => o.setName('szoveg').setDescription('Szöveg, új sor: \\n').setRequired(true).setMaxLength(3000))),
  new S().setName('csere').setDescription('Cserehirdetés')
    .addStringOption((o) => o.setName('adok').setDescription('Mit adsz?').setRequired(true).setMaxLength(300))
    .addStringOption((o) => o.setName('kerek').setDescription('Mit kérsz?').setRequired(true).setMaxLength(300)),
  new S().setName('ertekeles').setDescription('Cserepartner értékelése')
    .addUserOption(tagOpcio)
    .addIntegerOption((o) => o.setName('pont').setDescription('1-5 csillag').setRequired(true).setMinValue(1).setMaxValue(5)),
  new S().setName('hirnev').setDescription('Egy tag cserés értékelése')
    .addUserOption((o) => o.setName('tag').setDescription('Melyik tag?')),
  new S().setName('napi').setDescription('Napi jutalom és küldetések'),
  new S().setName('gyujtemeny').setDescription('A summon gyűjteményed')
    .addUserOption((o) => o.setName('tag').setDescription('Kinek a gyűjteménye?')),
].map((c) => c.toJSON());
