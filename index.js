// ✅ Kontrolle-Bot index.js (Modal + Select-Menü)

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require("dotenv").config();
const fs = require("fs");
const express = require("express");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  SlashCommandBuilder,
  Routes,
  Events,
  InteractionType,
  StringSelectMenuBuilder,
} = require("discord.js");
const { REST } = require("@discordjs/rest");

const app = express();
app.get("/", (req, res) => res.send("✅ Kontrolle-Bot läuft!"));
app.get("/health", (req, res) => {
  if (client.isReady()) res.status(200).send("✅ Bot ist bereit");
  else res.status(500).send("❌ Bot nicht bereit");
});
app.listen(3000, () => console.log("🌐 Webserver läuft auf Port 3000"));

setInterval(() => {
  try {
    fetch("https://" + process.env.REPL_URL);
  } catch (e) {
    console.log("❌ Selbstping fehlgeschlagen:", e.message);
  }
}, 240000);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`✅ Bot ist online als ${client.user.tag}`);
  const alertChannel = client.channels.cache.get(process.env.ALERT_CHANNEL_ID);
  if (alertChannel) console.log("✅ Alert-Channel gefunden");
  const startupChannel = client.channels.cache.get(process.env.STARTUP_CHANNEL_ID);
  if (startupChannel) {
    startupChannel.send(`🟢 **Bot wurde erfolgreich gestartet!**`).catch(console.error);
  }
});

const commands = [
  new SlashCommandBuilder().setName("kontrolle").setDescription("Öffnet das Kontrollformular"),
  new SlashCommandBuilder().setName("stats").setDescription("Zeigt die Kontrollstatistik an"),
  new SlashCommandBuilder().setName("health").setDescription("Zeigt den Bot-Status")
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("✅ Slash-Commands registriert");
  } catch (error) {
    notifyError(`Fehler beim Registrieren: ${error.message}`);
  }
})();

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand() && interaction.commandName === "kontrolle") {
    const modal = new ModalBuilder()
      .setCustomId("kontrolle_modal")
      .setTitle("📝 Kontrolle durchführen")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("input_name").setLabel("👤 Name").setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("input_ort").setLabel("📍 Ort").setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("input_status").setLabel("📝 Status").setStyle(TextInputStyle.Paragraph).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("input_uhrzeit").setLabel("🕒 Uhrzeit").setStyle(TextInputStyle.Short).setRequired(true)
        )
      );
    await interaction.showModal(modal);
  }

  if (interaction.type === InteractionType.ModalSubmit && interaction.customId === "kontrolle_modal") {
    const name = interaction.fields.getTextInputValue("input_name");
    const ort = interaction.fields.getTextInputValue("input_ort");
    const status = interaction.fields.getTextInputValue("input_status");
    const uhrzeit = interaction.fields.getTextInputValue("input_uhrzeit");

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select_dabei")
      .setPlaceholder("👥 Wer war dabei?")
      .setMinValues(0)
      .setMaxValues(5)
      .addOptions(
        interaction.guild.members.cache.filter(m => !m.user.bot).map(member => ({
          label: member.user.username,
          value: member.user.id
        })).slice(0, 25) // Discord Limit
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: "Bitte wähle jetzt aus, wer bei der Kontrolle dabei war:",
      components: [row],
      ephemeral: true
    });

    client.once(Events.InteractionCreate, async select => {
      if (!select.isStringSelectMenu() || select.customId !== "select_dabei") return;

      const selected = select.values.map(id => `<@${id}>`).join(", ") || "Keine Angabe";
      const user = select.user.tag;

      let stats = { today: 0, total: 0, lastName: "Noch niemand", lastBy: "Unbekannt", users: {} };
      try { stats = JSON.parse(fs.readFileSync("stats.json", "utf8")); } catch {}
      stats.today += 1;
      stats.total += 1;
      stats.lastName = name;
      stats.lastBy = user;
      stats.users[user] = (stats.users[user] || 0) + 1;
      fs.writeFileSync("stats.json", JSON.stringify(stats, null, 2));

      const embed = new EmbedBuilder()
        .setColor("#2ecc71")
        .setTitle("📋 Kontrolle durchgeführt")
        .addFields(
          { name: "👤 Name", value: name, inline: true },
          { name: "🕒 Uhrzeit", value: uhrzeit, inline: true },
          { name: "📍 Ort", value: ort, inline: true },
          { name: "📝 Status", value: status },
          { name: "👥 Dabei", value: selected }
        )
        .setFooter({ text: `Von ${user} • ${new Date().toLocaleDateString("de-DE")}` });

      await select.update({ content: "✅ Kontrolle gespeichert!", components: [], embeds: [embed] });
    });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "stats") {
    if (interaction.channelId !== process.env.STATS_CHANNEL_ID) return interaction.reply({ content: "❌ Nicht erlaubt hier", ephemeral: true });
    let stats = { today: 0, total: 0, lastName: "-", lastBy: "-", users: {} };
    try { stats = JSON.parse(fs.readFileSync("stats.json", "utf8")); } catch {}
    const sorted = Object.entries(stats.users).sort((a, b) => b[1] - a[1]).map(([u, c]) => `- ${u} → ${c}x`).join("\n");

    const embed = new EmbedBuilder()
      .setTitle("📊 Kontroll-Statistik")
      .setColor("#3498db")
      .addFields(
        { name: "📅 Heute", value: `${stats.today}`, inline: true },
        { name: "📈 Insgesamt", value: `${stats.total}`, inline: true },
        { name: "👤 Letzter Name", value: stats.lastName },
        { name: "🧑‍✈️ Letzte Kontrolle von", value: stats.lastBy }
      )
      .setDescription(sorted || "Noch keine Daten");

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "health") {
    await interaction.reply({ content: client.isReady() ? "✅ Bot ist ONLINE" : "❌ Bot ist OFFLINE" });
  }
});

function notifyError(msg) {
  const channel = client.channels.cache.get(process.env.ALERT_CHANNEL_ID);
  if (client.isReady() && channel) {
    channel.send(`🚨 Fehler:\n\`\`\`${msg}\`\`\``).catch(console.error);
  }
}

client.login(process.env.DISCORD_TOKEN);

