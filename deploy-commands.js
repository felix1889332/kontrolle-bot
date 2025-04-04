require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("kontrolle")
    .setDescription("Öffnet das Kontrollformular"),
  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Zeigt die Kontrollstatistik an")
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

const guildIds = [process.env.GUILD_ID_1, process.env.GUILD_ID_2];

(async () => {
  try {
    console.log("📡 Registriere Slash-Commands für alle Server...");

    for (const guildId of guildIds) {
      if (!guildId) continue;

      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
        { body: commands }
      );

      console.log(`✅ Registriert für GUILD_ID: ${guildId}`);
    }
  } catch (error) {
    console.error("❌ Fehler beim Registrieren:", error);
  }
})();
