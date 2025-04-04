// ✅ Kontrolle-Bot index.js (maximale Stabilität, mit Herzblut abgesichert)

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
  InteractionType
} = require("discord.js");
const { REST } = require("@discordjs/rest");

// 🌐 Webserver für Replit aktivieren
const app = express();
app.get("/", (req, res) => {
  res.send("✅ Kontrolle-Bot läuft!");
});

// 🩺 Healthcheck Endpoint für UptimeRobot
app.get("/health", (req, res) => {
  if (client.isReady()) {
    res.status(200).send("✅ Bot ist bereit");
  } else {
    res.status(500).send("❌ Bot nicht bereit");
  }
});

app.listen(3000, () => {
  console.log("🌐 Webserver läuft auf Port 3000");
});

// 🔁 Bot pingt sich selbst, damit Replit wach bleibt
setInterval(() => {
  try {
    fetch("https://" + process.env.REPL_URL);
  } catch (e) {
    console.log("❌ Selbstping fehlgeschlagen:", e.message);
  }
}, 4 * 60 * 1000); // alle 4 Minuten

// 🤖 Discord-Client starten
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`✅ Bot ist online als ${client.user.tag}`);

  const alertChannel = client.channels.cache.get(process.env.ALERT_CHANNEL_ID);
  if (alertChannel) console.log("✅ Alert-Channel gefunden");
  else console.log("❌ ALERT_CHANNEL_ID ungültig oder nicht sichtbar");

  const startupChannel = client.channels.cache.get(process.env.STARTUP_CHANNEL_ID);
  if (startupChannel) {
    startupChannel.send(`🟢 **Bot wurde erfolgreich gestartet!**\nLäuft als: \`${client.user.tag}\``).catch(console.error);
  } else {
    console.log("❌ STARTUP_CHANNEL_ID ungültig oder nicht sichtbar");
  }
});

// 📩 Slash Commands registrieren
const commands = [
  new SlashCommandBuilder().setName("kontrolle").setDescription("Öffnet das Kontrollformular"),
  new SlashCommandBuilder().setName("stats").setDescription("Zeigt die Kontrollstatistik an"),
  new SlashCommandBuilder().setName("health").setDescription("Zeigt den aktuellen Bot-Status")
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("📡 Registriere Slash-Commands...");
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("✅ Slash-Commands registriert");
  } catch (error) {
    console.error("❌ Fehler beim Registrieren:", error);
    notifyError(`Fehler beim Registrieren: ${error.message}`);
  }
})();

// 📥 Interaction-Handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === "kontrolle") {
    if (interaction.channelId !== process.env.KONTROLLE_CHANNEL_ID) {
      return interaction.reply({ content: "🚫 Der Befehl `/kontrolle` ist in diesem Channel nicht erlaubt.", ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId("kontrolle_modal")
      .setTitle("📝 Kontrolle durchführen")
      .addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("input_name").setLabel("👤 Name").setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("input_ort").setLabel("📍 Ort").setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("input_status").setLabel("📝 Status").setStyle(TextInputStyle.Paragraph).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("input_dabei").setLabel("👥 Dabei?").setStyle(TextInputStyle.Short).setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("input_uhrzeit").setLabel("🕒 Uhrzeit").setStyle(TextInputStyle.Short).setRequired(true))
      );

    await interaction.showModal(modal);
  }

  if (interaction.type === InteractionType.ModalSubmit && interaction.customId === "kontrolle_modal") {
    try {
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
        .setColor("#2ecc71")
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
    } catch (err) {
      console.error("💥 Fehler bei Modal-Verarbeitung:", err);
      notifyError(`Fehler bei Kontrolle: ${err.message}`);
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "stats") {
    if (interaction.channelId !== process.env.STATS_CHANNEL_ID) {
      return interaction.reply({ content: "🚫 Der Befehl `/stats` ist in diesem Channel nicht erlaubt.", ephemeral: true });
    }

    try {
      let stats = { today: 0, total: 0, lastName: "Noch niemand", lastBy: "Unbekannt", users: {} };
      try { stats = JSON.parse(fs.readFileSync("stats.json", "utf8")); } catch {}

      const sortedUsers = Object.entries(stats.users)
        .sort((a, b) => b[1] - a[1])
        .map(([user, count]) => `- ${user} → ${count} Kontrolle(n)`).join("\n");

      const embed = new EmbedBuilder()
        .setColor("#3498db")
        .setTitle("📊 Kontroll-Statistik")
        .setDescription(`👥 **Kontrollen pro Nutzer:**\n${sortedUsers || "Noch keine"}`)
        .addFields(
          { name: "📅 Heute", value: `${stats.today}`, inline: true },
          { name: "📈 Insgesamt", value: `${stats.total}`, inline: true },
          { name: "👤 Letzter Name", value: stats.lastName },
          { name: "🧑‍✈️ Durchgeführt von", value: stats.lastBy }
        );

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("❌ Fehler bei /stats:", err);
      notifyError(`Fehler bei /stats: ${err.message}`);
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "health") {
    const status = client.isReady() ? "✅ ONLINE" : "❌ OFFLINE";
    await interaction.reply({ content: `📶 Bot-Status: ${status}` });
  }
});

// 🔐 Fehler-Überwachung + Discord-Alert
process.on("unhandledRejection", reason => {
  console.error("🛑 Unhandled Promise Rejection:", reason);
  notifyError(`🛑 Unhandled Rejection:\n${reason}`);
});
process.on("uncaughtException", err => {
  console.error("💥 Uncaught Exception:", err);
  notifyError(`💥 Uncaught Exception:\n${err.message}`);
});
process.on("uncaughtExceptionMonitor", err => {
  console.error("🚨 uncaughtExceptionMonitor:", err);
  notifyError(`🚨 uncaughtExceptionMonitor:\n${err.message}`);
});

function notifyError(message) {
  if (!client.isReady()) return console.log("⚠️ Bot nicht bereit für Fehler-Alert");
  const channel = client.channels.cache.get(process.env.ALERT_CHANNEL_ID);
  if (!channel) return console.log("⚠️ ALERT_CHANNEL_ID ungültig");
  channel.send({ content: `🚨 **Bot-Fehler:**\n\
\`\`\`${message}\`\`\`` }).catch(console.error);
}

// 🔌 Shutdown-Detection
process.on("SIGINT", sendShutdownMessage);
process.on("SIGTERM", sendShutdownMessage);

async function sendShutdownMessage() {
  if (!client.isReady()) {
    console.log("⚠️ Bot wird beendet (nicht bereit)");
    process.exit(0);
  }
  const channel = client.channels.cache.get(process.env.STARTUP_CHANNEL_ID);
  if (channel) await channel.send("🔴 **Bot wird beendet...**").catch(console.error);
  process.exit(0);
}
try {
  client.login(process.env.DISCORD_TOKEN);
} catch (err) {
  console.error("❌ Fehler beim Login:", err);
  notifyError(`❌ Fehler beim Bot-Login: ${err.message}`);
}

client.login(process.env.DISCORD_TOKEN);
