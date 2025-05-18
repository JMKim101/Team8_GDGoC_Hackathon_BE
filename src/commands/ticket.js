const { SlashCommandBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, IntegerInputBuilder } = require('discord.js');
const fs = require('node:fs');
const dotenv = require('dotenv');
const { generateTickets, storeTickets } = require('../utils/ticket');
const ticket2Embed = require('../utils/ticket2Embed');
const { days_of_week_value } = require('../utils/date');
dotenv.config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Generate tickets for process')
    .addStringOption(option =>
      option
        .setName('from')
        .setDescription('how to generate tickets')
        .setRequired(true)
        .addChoices(
          { name: 'Recent Messages', value: 'recent-messages' },
          { name: 'Draft', value: 'draft' }
        )
    )
    .addIntegerOption(option => 
      option
        .setName('counts')
        .setDescription('number of tickets to generate, if 0, AI suggest number of tickets')
        .setMinValue(0)
        .setMaxValue(20)
        .setRequired(false)
    ),
  async execute(interaction) {
    if (interaction.options.getString('from') === 'recent-messages') {
      await interaction.reply({ content: 'Analyzing recent messages...' });

      try {
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const counts = interaction.options.getInteger('counts') || 0;
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

        const now = new Date();
        const days_of_week = days_of_week_value[now.getDay()];

        fetch(`${process.env.API_URL}/extract`, {
          method: 'POST',
          body: JSON.stringify({
            messages: formattedMessages,
            prompt_type: "TICKETS",
            counts: counts,
            timestamp: now.toISOString(),
            days_of_week: days_of_week
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        }).then(res => res.json()).then(async (data) => {
          const tickets = generateTickets(data.tickets);
          const embeds = tickets.map((ticket) => ticket2Embed(ticket));
          console.log("tickets", tickets)

          const ticketIds = await Promise.all(embeds.map(async (embed) => {
            const msg = await interaction.channel.send({ embeds: [embed] });
            await msg.react('⚪');
            return msg.id;
          }));
          console.log("ticketIds", ticketIds);

          storeTickets(tickets, ticketIds, channel.guild.id, channel.id);
        }).catch(async (err) => {
          console.error(formattedMessages, err);
          await interaction.editReply({ content: `Error analyzing channel: ${err}` });
        });

      } catch (error) {
        console.error('Error analyzing channel:', error);
        await interaction.editReply({ content: `Error analyzing channel: ${error}` });
      }
    } else {
      // form modal
      const modal = new ModalBuilder()
        .setCustomId('ticket-draft')
        .setTitle('Draft for generate Tickets')
        .addComponents( 
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('ticket-form-title')
              .setLabel('Title')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('ticket-form-counts')
              .setLabel('Counts')
              .setPlaceholder('Number of tickets to generate, if 0, AI suggest number of tickets, max 20')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('ticket-form-description')
              .setLabel('Description')
              .setRequired(true)
              .setStyle(TextInputStyle.Paragraph)
          ),
        );
      await interaction.showModal(modal);
    }
  },
};