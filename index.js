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
  StringSelectMenuOptionBuilder,
  UserSelectMenuBuilder
} = require("discord.js");
const { REST } = require("@discordjs/rest");

// Webserver
const app = express();
app.get("/", (_, res) => res.send("✅ Kontrolle-Bot läuft!"));
app.get("/health", (_, res) => res.status(client.isReady() ? 200 : 500).send(client.isReady() ? "✅ Bot ist bereit" : "❌ Bot nicht bereit"));
app.listen(3000, () => console.log("🌐 Webserver läuft auf Port 3000"));

// Bot-Client
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once("ready", () => {
  console.log(`✅ Bot ist online als ${client.user.tag}`);
  const alertChannel = client.channels.cache.get(process.env.ALERT_CHANNEL_ID);
  if (alertChannel) alertChannel.send("🟢 **Bot wurde gestartet**").catch(console.error);
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
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "kontrolle") {
      await handleKontrolleCommand(interaction);
    } else if (interaction.commandName === "stats") {
      await handleStatsCommand(interaction);
    } else if (interaction.commandName === "health") {
      await interaction.reply({ content: `📶 Bot-Status: ${client.isReady() ? "✅ ONLINE" : "❌ OFFLINE"}` });
    }
  } else if (interaction.isStringSelectMenu() && interaction.customId === "select_user") {
    await handleSelectUser(interaction);
  } else if (interaction.type === InteractionType.ModalSubmit && interaction.customId === "kontrolle_modal") {
    await handleKontrolleModal(interaction);
  }
});

async function handleKontrolleCommand(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const userSelectMenu = new UserSelectMenuBuilder()
      .setCustomId("user_select")
      .setPlaceholder("Wähle die kontrollierte Person aus")
      .setMinValues(1)
      .setMaxValues(1);

    const manualOption = new StringSelectMenuBuilder()
      .setCustomId("manual_entry")
      .setPlaceholder("Oder trage den Namen manuell ein")
      .addOptions(new StringSelectMenuOptionBuilder()
        .setLabel("✏️ Manuelle Eingabe")
        .setValue("manual"));

    const actionRowUserSelect = new ActionRowBuilder().addComponents(userSelectMenu);
    const actionRowManualEntry = new ActionRowBuilder().addComponents(manualOption);

    await interaction.editReply({
      content: "Bitte wähle die kontrollierte Person aus oder trage den Namen manuell ein:",
      components: [actionRowUserSelect, actionRowManualEntry]
    });
  } catch (err) {
    console.error("❌ Fehler bei /kontrolle:", err);
    notifyError(`Fehler bei /kontrolle:\n${err.message}`);
    await interaction.editReply({ content: "❌ Es gab einen Fehler bei der Ausführung des Befehls." });
  }
}

async function handleSelectUser(interaction) {
  const selectedUserId = interaction.values[0];
  const selectedUser = await client.users.fetch(selectedUserId);

  const modal = new ModalBuilder()
    .setCustomId("kontrolle_modal")
    .setTitle("📝 Kontrolle durchführen")
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("input_name").setLabel("👤 Name").setStyle(TextInputStyle.Short).setValue(selectedUser.username).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("input_ort").setLabel("📍 Ort").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("input_status").setLabel("📝 Status").setStyle(TextInputStyle.Paragraph).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("input_dabei").setLabel("👥 Dabei?").setStyle(TextInputStyle.Short).setRequired(false)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("input_uhrzeit").setLabel("🕒 Uhrzeit").setStyle(TextInputStyle.Short).setRequired(true))
    );

  await interaction.showModal(modal);
}

async function handleKontrolleModal(interaction) {
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

    const embed = new
::contentReference[oaicite:0]{index=0}
 
