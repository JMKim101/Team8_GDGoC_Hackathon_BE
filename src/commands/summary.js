const { SlashCommandBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('node:fs');
const dotenv = require('dotenv');
const { generateTickets, storeTickets } = require('../utils/ticket');
const ticket2Embed = require('../utils/ticket2Embed');
const { days_of_week_value } = require('../utils/date');
dotenv.config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('summary')
    .setDescription('Generate summary for process'),
  async execute(interaction) {
    await interaction.reply({ content: 'Analyzing recent messages...' });

    try {
      const channel = interaction.channel;
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
        author: msg.author.id,
        content: msg.content,
      }));

      // make directory if not exists
      // if (!fs.existsSync(`data/${channel.guild.id}`))
      //   fs.mkdirSync(`data/${channel.guild.id}`, { recursive: true });
      // fs.writeFileSync(`data/${channel.guild.id}/messages.raw.json`, JSON.stringify(messages, null, 2));
      // fs.writeFileSync(`data/${channel.guild.id}/messages.json`, JSON.stringify(formattedMessages, null, 2));

      const now = new Date();
      const days_of_week = days_of_week_value[now.getDay()];

      fetch(`${process.env.API_URL}/extract`, {
        method: 'POST',
        body: JSON.stringify({
          messages: formattedMessages,
          prompt_type: "SUMMARY",
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(res => res.json()).then(async (data) => {
        let summary = data.summary;
        summary = summary.replace(/[0-9]{18}/g, (match) => `<@${match}>`);
        console.log("summary", summary);
        await interaction.editReply({ content: summary });
      }).catch(async (err) => {
        console.error(formattedMessages, err);
        await interaction.editReply({ content: `Error analyzing channel: ${err}` });
      });

    } catch (error) {
      console.error('Error analyzing channel:', error);
      await interaction.editReply({ content: `Error analyzing channel: ${error}` });
    }
  },
};