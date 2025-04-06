require('dotenv').config();
const fs = require('fs');
const express = require('express');
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
  StringSelectMenuBuilder
} = require('discord.js');
const { REST } = require('@discordjs/rest');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
app.get('/', (req, res) => res.send('✅ Kontrolle-Bot läuft!'));
app.get('/health', (req, res) => {
  if (client.isReady()) res.status(200).send('✅ Bot ist bereit');
  else res.status(500).send('❌ Bot nicht bereit');
});
app.listen(3000, () => console.log('🌐 Webserver läuft auf Port 3000'));

// Keep-alive
setInterval(() => {
  if (process.env.REPL_URL) {
    fetch('https://' + process.env.REPL_URL).catch(() => {});
  }
}, 4 * 60 * 1000);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('ready', () => {
  console.log(`✅ Bot ist online als ${client.user.tag}`);
  const channel = client.channels.cache.get(process.env.STARTUP_CHANNEL_ID);
  if (channel) channel.send('🟢 Bot wurde gestartet!').catch(console.error);
});

const commands = [
  new SlashCommandBuilder().setName('kontrolle').setDescription('Starte eine Kontrolle'),
  new SlashCommandBuilder().setName('stats').setDescription('Zeigt die Kontrollstatistik'),
  new SlashCommandBuilder().setName('health').setDescription('Bot-Status überprüfen'),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const guilds = process.env.GUILD_IDS.split(',').map(id => id.trim());

(async () => {
  try {
    console.log('📡 Registriere Slash-Commands...');
    for (const guildId of guilds) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
        { body: commands }
      );
    }
    console.log('✅ Slash-Commands registriert');
  } catch (err) {
    console.error('❌ Fehler beim Registrieren:', err);
  }
})();

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'kontrolle') {
    const select = new StringSelectMenuBuilder()
      .setCustomId('kontrolle_select')
      .setPlaceholder('Wähle die kontrollierte Person aus')
      .addOptions([
        { label: 'Max Mustermann', value: 'max' },
        { label: 'Erika Beispiel', value: 'erika' },
        { label: 'Selbst eintragen', value: 'custom' },
      ]);

    const row = new ActionRowBuilder().addComponents(select);

    await interaction.reply({
      content: '👥 Bitte wähle die kontrollierte Person aus:',
      components: [row],
      ephemeral: true
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'kontrolle_select') {
    const selected = interaction.values[0];

    if (selected === 'custom') {
      const modal = new ModalBuilder()
        .setCustomId('kontrolle_modal')
        .setTitle('📝 Kontrolle durchführen')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('input_name')
              .setLabel('👤 Name')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('input_ort')
              .setLabel('📍 Ort')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('input_status')
              .setLabel('📝 Status')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('input_uhrzeit')
              .setLabel('🕒 Uhrzeit')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );

      await interaction.showModal(modal);
    } else {
      await interaction.reply({ content: `✅ Du hast **${selected}** ausgewählt.`, ephemeral: true });
    }
  }

  if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'kontrolle_modal') {
    try {
      const name = interaction.fields.getTextInputValue('input_name');
      const ort = interaction.fields.getTextInputValue('input_ort');
      const status = interaction.fields.getTextInputValue('input_status');
      const uhrzeit = interaction.fields.getTextInputValue('input_uhrzeit');
      const user = interaction.user.tag;

      let stats = { today: 0, total: 0, lastName: 'Noch niemand', lastBy: 'Unbekannt', users: {} };
      try {
        stats = JSON.parse(fs.readFileSync('stats.json', 'utf8'));
      } catch {}

      stats.today += 1;
      stats.total += 1;
      stats.lastName = name;
      stats.lastBy = user;
      stats.users[user] = (stats.users[user] || 0) + 1;

      fs.writeFileSync('stats.json', JSON.stringify(stats, null, 2));

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('📋 Kontrolle durchgeführt')
        .addFields(
          { name: '👤 Name', value: name },
          { name: '📍 Ort', value: ort },
          { name: '🕒 Uhrzeit', value: uhrzeit },
          { name: '📝 Status', value: status }
        )
        .setFooter({ text: `Von ${user}` });

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error('❌ Fehler im Modal:', err);
      await interaction.reply({ content: '❌ Fehler bei der Eingabe.', ephemeral: true });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'stats') {
    try {
      let stats = JSON.parse(fs.readFileSync('stats.json', 'utf8'));

      const sorted = Object.entries(stats.users)
        .sort((a, b) => b[1] - a[1])
        .map(([user, count]) => `- ${user}: ${count}`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('📊 Statistik')
        .addFields(
          { name: '📅 Heute', value: `${stats.today}`, inline: true },
          { name: '📈 Gesamt', value: `${stats.total}`, inline: true },
          { name: '👤 Letzter Name', value: stats.lastName },
          { name: '🧑‍✈️ Letzter Prüfer', value: stats.lastBy },
          { name: '👥 Nutzer Übersicht', value: sorted || 'Keine Daten' }
        );

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ content: '❌ Fehler beim Laden der Statistik.', ephemeral: true });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'health') {
    await interaction.reply({ content: '✅ Bot ist online!' });
  }
});

client.login(process.env.DISCORD_TOKEN);
