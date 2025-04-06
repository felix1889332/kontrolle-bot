const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
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
  UserSelectMenuBuilder
} = require("discord.js");
const { REST } = require("@discordjs/rest");

const app = express();
app.get("/", (req, res) => res.send("✅ Kontrolle-Bot läuft!"));
app.get("/health", (req, res) => {
  res.status(client.isReady() ? 200 : 500).send(client.isReady() ? "✅ Bot ist bereit" : "❌ Bot nicht bereit");
});
app.listen(3000, () => console.log("🌐 Webserver läuft auf Port 3000"));

setInterval(() => {
  if (process.env.REPL_URL) {
    fetch("https://" + process.env.REPL_URL).catch(() => {});
  }
}, 4 * 60 * 1000);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`✅ Bot ist online als ${client.user.tag}`);

  const startupChannel = client.channels.cache.get(process.env.STARTUP_CHANNEL_ID);
  if (startupChannel) {
    startupChannel.send("🟢 **Kontrolle-Bot wurde gestartet!**").catch(console.error);
  }
});

const commands = [
  new SlashCommandBuilder().setName("kontrolle").setDescription("Starte eine Kontrolle"),
  new SlashCommandBuilder().setName("stats").setDescription("Zeigt die Kontrollstatistik an"),
  new SlashCommandBuilder().setName("health").setDescription("Statuscheck")
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  const guilds = [process.env.GUILD_ID_1, process.env.GUILD_ID_2];
  for (const guildId of guilds) {
    try {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId), { body: commands });
      console.log(`✅ Slash-Commands registriert für Guild ${guildId}`);
    } catch (error) {
      console.error("❌ Fehler beim Registrieren:", error);
      notifyError(`❌ Fehler bei Command-Registrierung (Guild ${guildId}): ${error.message}`);
    }
  }
})();

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === "kontrolle") {
    const userSelect = new UserSelectMenuBuilder()
      .setCustomId("kontrolle_user_select")
      .setPlaceholder("User hinzufügen")
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(userSelect);

    await interaction.reply({
      content: "👥 Wähle dich selber aus:",
      components: [row],
      ephemeral: true
    });
  }

  if (interaction.isUserSelectMenu() && interaction.customId === "kontrolle_user_select") {
    const selectedUser = interaction.users.first();

    const dabeiSelect = new UserSelectMenuBuilder()
      .setCustomId(`kontrolle_dabei_select__${selectedUser.id}`)
      .setPlaceholder("Wähle alle Personen, die bei der Kontrolle dabei waren")
      .setMinValues(0)
      .setMaxValues(10);

    const row = new ActionRowBuilder().addComponents(dabeiSelect);

    await interaction.update({
      content: `✅ Kontrollierende Person: <@${selectedUser.id}>\nJetzt: Wer war dabei?`,
      components: [row]
    });
  }

  if (interaction.isUserSelectMenu() && interaction.customId.startsWith("kontrolle_dabei_select__")) {
    const kontrollierteId = interaction.customId.split("__")[1];
    const dabeiMentions = interaction.users.map(u => `<@${u.id}>`).join(", ") || "Keine Angabe";

    const modal = new ModalBuilder()
      .setCustomId(`kontrolle_modal__${kontrollierteId}__${Buffer.from(dabeiMentions).toString("base64")}`)
      .setTitle("📝 Kontrolle durchführen")
      .addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder()
          .setCustomId("input_ort").setLabel("📍 Ort").setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder()
          .setCustomId("input_status").setLabel("📝 Status").setStyle(TextInputStyle.Paragraph).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder()
          .setCustomId("input_uhrzeit").setLabel("🕒 Uhrzeit").setStyle(TextInputStyle.Short).setRequired(true))
      );

   await interaction.showModal(modal);
  }

  if (interaction.type === InteractionType.ModalSubmit && interaction.customId.startsWith("kontrolle_modal__")) {
    const parts = interaction.customId.split("__");
    const kontrollierteId = parts[1];
    const dabeiDecoded = parts[2] ? Buffer.from(parts[2], "base64").toString("utf8") : "Keine Angabe";
    const kontrollierteMention = `<@${kontrollierteId}>`;

    const ort = interaction.fields.getTextInputValue("input_ort");
    const status = interaction.fields.getTextInputValue("input_status");
    const uhrzeit = interaction.fields.getTextInputValue("input_uhrzeit");
    const user = interaction.user.tag;

    let stats = { today: 0, total: 0, lastName: "Noch niemand", lastBy: "Unbekannt", users: {} };
    try { stats = JSON.parse(fs.readFileSync("stats.json", "utf8")); } catch {}

    stats.today++;
    stats.total++;
    stats.lastName = kontrollierteMention;
    stats.lastBy = user;
    stats.users[user] = (stats.users[user] || 0) + 1;

    fs.writeFileSync("stats.json", JSON.stringify(stats, null, 2));

    const embed = new EmbedBuilder()
      .setColor("#2ecc71")
      .setTitle("📋 Kontrolle durchgeführt")
      .addFields(
        { name: "👤 Kontrollierende Person", value: kontrollierteMention, inline: true },
        { name: "🕒 Uhrzeit", value: uhrzeit, inline: true },
        { name: "📍 Ort", value: ort, inline: true },
        { name: "📝 Status", value: status },
        { name: "👥 Dabei", value: dabeiDecoded }
      )
      .setFooter({ text: `Von ${user} • ${new Date().toLocaleDateString("de-DE")}` });

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "stats") {
    try {
      const stats = JSON.parse(fs.readFileSync("stats.json", "utf8"));
      const sortedUsers = Object.entries(stats.users)
        .sort((a, b) => b[1] - a[1])
        .map(([u, c]) => `- ${u}: ${c} Kontrolle(n)`)
        .join("\n");

      const embed = new EmbedBuilder()
        .setColor("#3498db")
        .setTitle("📊 Kontroll-Statistik")
        .setDescription(`👥 **Kontrollen pro Nutzer:**\n${sortedUsers || "Noch keine"}\n\n`)
        .addFields(
          { name: "📅 Heute", value: `${stats.today}`, inline: true },
          { name: "📈 Insgesamt", value: `${stats.total}`, inline: true },
          { name: "👤 Letzter Name", value: stats.lastName },
          { name: "🧑‍✈️ Durchgeführt von", value: stats.lastBy }
        );

      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      console.error("❌ Fehler bei /stats:", e);
      notifyError("❌ Fehler bei /stats");
      await interaction.reply({ content: "❌ Fehler beim Laden der Statistik", ephemeral: true });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "health") {
    const status = client.isReady() ? "✅ ONLINE" : "❌ OFFLINE";
    await interaction.reply({ content: `📶 Bot-Status: ${status}`, ephemeral: true });
  }
});

process.on("unhandledRejection", reason => {
  console.error("🛑 Unhandled Rejection:", reason);
  notifyError(`🛑 Unhandled Rejection:\n${reason}`);
});
process.on("uncaughtException", err => {
  console.error("💥 Uncaught Exception:", err);
  notifyError(`💥 Uncaught Exception:\n${err.message}`);
});

function notifyError(msg) {
  if (!client.isReady()) return;
  const channel = client.channels.cache.get(process.env.ALERT_CHANNEL_ID);
  if (channel) {
    channel.send({ content: `🚨 **Bot-Fehler:**\n\`\`\`${msg}\`\`\`` }).catch(console.error);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function shutdown() {
  const channel = client.channels.cache.get(process.env.STARTUP_CHANNEL_ID);
  if (channel) await channel.send("🔴 **Kontrolle-Bot wird beendet.**").catch(() => {});
  process.exit(0);
}

client.login(process.env.DISCORD_TOKEN);
