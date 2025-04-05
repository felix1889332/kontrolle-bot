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
  StringSelectMenuBuilder,
  InteractionType,
  Events
} = require("discord.js");
const { REST } = require("@discordjs/rest");

// 🌐 Express Webserver & Healthcheck
const app = express();
app.get("/", (req, res) => res.send("✅ Kontrolle-Bot läuft!"));
app.get("/health", (req, res) => {
  res.status(client.isReady() ? 200 : 500).send(client.isReady() ? "✅ OK" : "❌ Bot offline");
});
app.listen(3000, () => console.log("🌐 Webserver läuft auf Port 3000"));

// 🔁 Self-ping
setInterval(() => {
  fetch("https://" + process.env.REPL_URL).catch(() => {});
}, 240000);

// 🤖 Discord Client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`✅ Bot ist online als ${client.user.tag}`);
  const startupChannel = client.channels.cache.get(process.env.STARTUP_CHANNEL_ID);
  if (startupChannel) startupChannel.send("🟢 **Bot wurde erfolgreich gestartet!**").catch(console.error);
});

// 📩 Slash Commands
const commands = [
  new SlashCommandBuilder().setName("kontrolle").setDescription("Öffnet das Kontrollformular"),
  new SlashCommandBuilder().setName("stats").setDescription("Zeigt Statistiken"),
  new SlashCommandBuilder().setName("health").setDescription("Zeigt den Bot-Status")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  try {
    console.log("📡 Registriere Commands...");
    const guilds = [process.env.GUILD_ID_1, process.env.GUILD_ID_2];
    for (const guildId of guilds) {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId), { body: commands });
    }
    console.log("✅ Slash Commands registriert");
  } catch (err) {
    console.error("❌ Fehler beim Registrieren:", err);
    notifyError(`❌ Fehler bei Registrierung: ${err.message}`);
  }
})();

// 📥 Interaction Handler
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "kontrolle") {
      if (interaction.channelId !== process.env.KONTROLLE_CHANNEL_ID) {
        return interaction.reply({ content: "🚫 Nur im vorgesehenen Channel erlaubt.", ephemeral: true });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("kontrolle_select_user")
        .setPlaceholder("👤 Wähle eine Person")
        .addOptions([
          { label: "Max Mustermann", value: "max" },
          { label: "Erika Beispiel", value: "erika" },
          { label: "Selbst eintragen", value: "custom" }
        ]);

      const row = new ActionRowBuilder().addComponents(selectMenu);
      await interaction.reply({ content: "Bitte wähle eine Person:", components: [row], ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "kontrolle_select_user") {
      const selected = interaction.values[0];
      const nameInput = new TextInputBuilder()
        .setCustomId("input_name")
        .setLabel("👤 Name")
        .setStyle(TextInputStyle.Short)
        .setValue(selected === "custom" ? "" : selected)
        .setRequired(true);

      const ortInput = new TextInputBuilder().setCustomId("input_ort").setLabel("📍 Ort").setStyle(TextInputStyle.Short).setRequired(true);
      const statusInput = new TextInputBuilder().setCustomId("input_status").setLabel("📝 Status").setStyle(TextInputStyle.Paragraph).setRequired(true);
      const dabeiInput = new TextInputBuilder().setCustomId("input_dabei").setLabel("👥 Dabei?").setStyle(TextInputStyle.Short).setRequired(false);
      const uhrzeitInput = new TextInputBuilder().setCustomId("input_uhrzeit").setLabel("🕒 Uhrzeit").setStyle(TextInputStyle.Short).setRequired(true);

      const modal = new ModalBuilder()
        .setCustomId("kontrolle_modal")
        .setTitle("📝 Kontrolle durchführen")
        .addComponents(
          new ActionRowBuilder().addComponents(nameInput),
          new ActionRowBuilder().addComponents(ortInput),
          new ActionRowBuilder().addComponents(statusInput),
          new ActionRowBuilder().addComponents(dabeiInput),
          new ActionRowBuilder().addComponents(uhrzeitInput)
        );

      await interaction.showModal(modal);
    }

    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === "kontrolle_modal") {
      const name = interaction.fields.getTextInputValue("input_name");
      const ort = interaction.fields.getTextInputValue("input_ort");
      const status = interaction.fields.getTextInputValue("input_status");
      const dabei = interaction.fields.getTextInputValue("input_dabei") || "Keine Angabe";
      const uhrzeit = interaction.fields.getTextInputValue("input_uhrzeit");
      const user = interaction.user.tag;

      let stats = { today: 0, total: 0, lastName: "Noch niemand", lastBy: "Unbekannt", users: {} };
      try { stats = JSON.parse(fs.readFileSync("stats.json", "utf8")); } catch {}

      stats.today += 1;
      stats.total += 1;
      stats.lastName = name;
      stats.lastBy = user;
      stats.users[user] = (stats.users[user] || 0) + 1;
      fs.writeFileSync("stats.json", JSON.stringify(stats, null, 2));

      const embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("📋 Kontrolle durchgeführt")
        .addFields(
          { name: "👤 Name", value: name, inline: true },
          { name: "🕒 Uhrzeit", value: uhrzeit, inline: true },
          { name: "📍 Ort", value: ort, inline: true },
          { name: "📝 Status", value: status },
          { name: "👥 Dabei", value: dabei }
        )
        .setFooter({ text: `Von ${user} • ${new Date().toLocaleDateString("de-DE")}` });

      await interaction.reply({ embeds: [embed] });
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "stats") {
      if (interaction.channelId !== process.env.STATS_CHANNEL_ID) {
        return interaction.reply({ content: "🚫 Nur im vorgesehenen Channel erlaubt.", ephemeral: true });
      }

      let stats = { today: 0, total: 0, lastName: "Noch niemand", lastBy: "Unbekannt", users: {} };
      try { stats = JSON.parse(fs.readFileSync("stats.json", "utf8")); } catch {}

      const sortedUsers = Object.entries(stats.users).sort((a, b) => b[1] - a[1]);
      const userList = sortedUsers.map(([user, count]) => `- ${user} → ${count}`).join("\n") || "Noch keine Daten";

      const embed = new EmbedBuilder()
        .setColor("Blue")
        .setTitle("📊 Kontroll-Statistik")
        .setDescription(`👥 **Kontrollen pro Nutzer:**\n${userList}`)
        .addFields(
          { name: "📅 Heute", value: `${stats.today}`, inline: true },
          { name: "📈 Insgesamt", value: `${stats.total}`, inline: true },
          { name: "👤 Letzter Name", value: stats.lastName },
          { name: "🧑‍✈️ Durchgeführt von", value: stats.lastBy }
        );

      await interaction.reply({ embeds: [embed] });
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "health") {
      await interaction.reply({ content: client.isReady() ? "✅ Der Bot läuft stabil." : "❌ Der Bot ist offline!" });
    }
  } catch (err) {
    console.error("❌ Fehler in InteractionCreate:", err);
    notifyError(`❌ Fehler in InteractionCreate:\n${err.message}`);
  }
});

// 🔐 Fehler-Handling
process.on("unhandledRejection", err => notifyError(`🛑 Unhandled Rejection:\n${err}`));
process.on("uncaughtException", err => notifyError(`💥 Uncaught Exception:\n${err.message}`));

// 🔌 Shutdown-Message
process.on("SIGINT", sendShutdownMessage);
process.on("SIGTERM", sendShutdownMessage);

async function sendShutdownMessage() {
  const channel = client.channels.cache.get(process.env.STARTUP_CHANNEL_ID);
  if (channel) await channel.send("🔴 **Bot wird beendet...**");
  process.exit(0);
}

// 📢 Discord-Fehlerbenachrichtigung
function notifyError(message) {
  if (!client.isReady()) return;
  const channel = client.channels.cache.get(process.env.ALERT_CHANNEL_ID);
  if (channel) channel.send(`🚨 **Fehler:**\n\`\`\`${message}\`\`\``).catch(console.error);
}

// 🧠 Start Bot
client.login(process.env.DISCORD_TOKEN);


