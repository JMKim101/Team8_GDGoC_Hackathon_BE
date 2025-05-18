const { SlashCommandBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('node:fs');
const dotenv = require('dotenv');
const { generateTickets, storeTickets } = require('../utils/ticket');
const tickets2Embeds = require('../utils/ticket2Embed');
dotenv.config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('overview')
    .setDescription('Generate overview for process')
    .addStringOption(option =>
      option
        .setName('length')
        .setDescription('Length of overview')
        .setRequired(true)
        .addChoices(
          { name: 'Short', value: 'SHORT' },
          { name: 'Long', value: 'LONG' }
        )
    ),
  async execute(interaction) {
    await interaction.reply({ content: 'Analyzing recent messages...' });
    try {
      const length = interaction.options.getString('length');
      const messages = [];
      let lastId;

      while (messages.length < 500) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const fetchedMessages = await channel.messages.fetch(options);
        if (fetchedMessages.size === 0) break;

        const filteredMessages = fetchedMessages.values().filter(m => !m.author.bot);

        messages.push(...filteredMessages);

        lastId = filteredMessages.length > 0
          ? filteredMessages[filteredMessages.length - 1].id
          : messages[messages.length - 1].id;

        if (fetchedMessages.length < 100) break;
      }

      const formattedMessages = messages.map(msg => ({
        author: msg.author.tag,
        content: msg.content,
      }));

      // make directory if not exists
      // if (!fs.existsSync(`data/${channel.guild.id}`))
      //   fs.mkdirSync(`data/${channel.guild.id}`, { recursive: true });
      // fs.writeFileSync(`data/${channel.guild.id}/messages.raw.json`, JSON.stringify(messages, null, 2));
      // fs.writeFileSync(`data/${channel.guild.id}/messages.json`, JSON.stringify(formattedMessages, null, 2));

      fetch(`${process.env.API_URL}/extract`, {
        method: 'POST',
        body: JSON.stringify({
          messages: formattedMessages,
          prompt_type: `${length}_OVERVIEW`,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(res => res.json()).then(async (data) => {
        const overview = data.overview;

        console.log("overview", overview);
        await interaction.editReply({ content: overview });
      }).catch(async (err) => {
        await interaction.editReply({ content: `Error analyzing channel: ${err}` });
      });
    } catch (error) {
      console.error('Error analyzing channel:', error);
      await interaction.editReply({ content: `Error analyzing channel: ${error}` });
    }
  },
};