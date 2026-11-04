const { SlashCommandBuilder: S, PermissionFlagsBits: P } = require('discord.js');

const admin = (b) => b.setDefaultMemberPermissions(P.ManageGuild);

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
].map((c) => c.toJSON());
