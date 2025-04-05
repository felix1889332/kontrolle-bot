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
  StringSelectMenuOptionBuilder
} = require("discord.js");
const { REST } = require("@discordjs/rest");

// Webserver
const app = express();
app.get("/", (_, res) => res.send("✅ Kontrolle-Bot läuft!"));
app.get("/health", (_, res) => client.isReady()
  ? res.status(200).send("✅ Bot ist bereit")
  : res.status(500).send("❌ Bot nicht bereit")
);
app.listen(3000, () => console.log("🌐 Webserver läuft auf Port 3000"));

setInterval(() => {
  try {
    fetch("https://" + process.env.REPL_URL);
  } catch (e) {
    console.log("❌ Selbstping fehlgeschlagen:", e.message);
  }
}, 4 * 60 * 1000);

// Bot-Client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`✅ Bot ist online als ${client.user.tag}`);
  const alert = client.channels.cache.get(process.env.ALERT_CHANNEL_ID);
  if (alert) alert.send("🟢 **Bot wurde gestartet**").catch(console.error);
});

// Slash-Commands
const commands = [
  new SlashCommandBuilder().setName("kontrolle").setDescription("Führe eine Kontrolle durch"),
  new SlashCommandBuilder().setName("stats").setDescription("Zeigt Statistik an"),
  new SlashCommandBuilder().setName("health").setDescription("Zeigt Bot-Status")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("📡 Registriere Slash-Commands...");
    const guilds = process.env.GUILD_IDS.split(",");
    for (const guildId of guilds) {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId.trim()), { body: commands });
    }
    console.log("✅ Slash-Commands registriert");
  } catch (err) {
    console.error("❌ Slash-Command Fehler:", err);
    notifyError(`Slash-Command Fehler:\n${err.message}`);
  }
})();

// Interaktionen
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === "kontrolle") {
    const members = await interaction.guild.members.fetch();
    const userOptions = members
      .filter(m => !m.user.bot)
      .map(m => new StringSelectMenuOptionBuilder()
        .setLabel(m.user.username)
        .setValue(m.user.id)
      ).slice(0, 24); // max 25 Optionen

    userOptions.push(new StringSelectMenuOptionBuilder().setLabel("✏️ Sonstige manuell eintragen").setValue("manual"));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select_user")
      .setPlaceholder("Wähle die kontrollierte Person aus")
      .addOptions(userOptions);

    await interaction.reply({
      content: "Bitte wähle die kontrollierte Person aus:",
      components: [new ActionRowBuilder().addComponents(selectMenu)],
      ephemeral: true
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "select_user") {
    const selection = interaction.values[0];

    if (selection === "manual") {
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
    } else {
      const user = await client.users.fetch(selection);
      await interaction.update({ content: `👤 Kontrollierte Person: <@${user.id}>`, components: [], ephemeral: true });
    }
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
      notifyError(`❌ Modal-Fehler:\n${err.message}`);
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "stats") {
    try {
      const stats = JSON.parse(fs.readFileSync("stats.json", "utf8"));
      const sortedUsers = Object.entries(stats.users)
        .sort((a, b) => b[1] - a[1])
        .map(([u, c]) => `- ${u}: ${c}x`).join("\n");

      const embed = new EmbedBuilder()
        .setColor("#3498db")
        .setTitle("📊 Statistik")
        .setDescription(`👥 **Pro Nutzer:**\n${sortedUsers}`)
        .addFields(
          { name: "📅 Heute", value: `${stats.today}`, inline: true },
          { name: "📈 Insgesamt", value: `${stats.total}`, inline: true },
          { name: "👤 Letzter Name", value: stats.lastName },
          { name: "👮‍♂️ Von", value: stats.lastBy }
        );
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      notifyError(`❌ Fehler bei /stats:\n${err.message}`);
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "health") {
    await interaction.reply({ content: `📶 Bot-Status: ${client.isReady() ? "✅ ONLINE" : "❌ OFFLINE"}` });
  }
});

// Fehlerbehandlung
process.on("unhandledRejection", err => notifyError(`🛑 Unhandled Rejection:\n${err}`));
process.on("uncaughtException", err => notifyError(`💥 Uncaught Exception:\n${err.message}`));

function notifyError(msg) {
  if (!client.isReady()) return console.log("⚠️ Bot nicht bereit");
  const channel = client.channels.cache.get(process.env.ALERT_CHANNEL_ID);
  if (channel) channel.send(`🚨 Fehler:\n\`\`\`${msg}\`\`\``).catch(console.error);
}

process.on("SIGINT", exitNotice);
process.on("SIGTERM", exitNotice);
async function exitNotice() {
  const channel = client.channels.cache.get(process.env.STARTUP_CHANNEL_ID);
  if (channel) await channel.send("🔴 Bot wird beendet...").catch(console.error);
  process.exit(0);
}

client.login(process.env.DISCORD_TOKEN);
