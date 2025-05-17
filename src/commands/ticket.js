const { SlashCommandBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('node:fs');
const dotenv = require('dotenv');
const { generateTickets, storeTickets } = require('../utils/ticket');
const tickets2Embeds = require('../utils/tickets2Embeds');
dotenv.config();

const dummyReponse = [
  {
    title: 'Title 1',
    description: "Description 1",
    dueDate: new Date(),
    assignee: 'John Doe',
    priority: 'High'
  },
  {
    title: 'Title 2',
    description: "Description 2",
    dueDate: new Date(),
    assignee: 'Jane Doe',
    priority: 'Medium'
  },
  {
    title: 'Title 3',
    description: "Description 3",
    dueDate: new Date(),
    assignee: 'John Doe',
    priority: 'Low'
  },
  {
    title: 'Title 4',
    description: "Description 4",
    dueDate: new Date(),
    assignee: 'Jane Doe',
    priority: 'Low'
  }
]

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Generate tickets for process')
    .addSubcommand(subcommand =>
      subcommand
        .setName('from-recent-messages')
        .setDescription('generate tickets from recent messages')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to get analyzed')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('from-survey')
        .setDescription('generate tickets from survey')
    ),
  async execute(interaction) {
    if (interaction.options.getSubcommand() === 'from-recent-messages') {
      await interaction.reply({ content: 'Analyzing recent messages...' });

      try {
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const messages = [];
        let lastId;

        while (messages.length < 500) {
          const options = { limit: 100 };
          if (lastId) options.before = lastId;

          const fetchedMessages = await channel.messages.fetch(options);
          if (fetchedMessages.size === 0) break;

          messages.push(...fetchedMessages.values());
          lastId = fetchedMessages.last().id;

          if (fetchedMessages.size < 100) break;
        }

        const formattedMessages = messages.map(msg => ({
          author: msg.author.tag,
          content: msg.content,
        }));

        // make directory if not exists
        if (!fs.existsSync(`data/${channel.guild.id}`))
          fs.mkdirSync(`data/${channel.guild.id}`, { recursive: true });
        fs.writeFileSync(`data/${channel.guild.id}/messages.raw.json`, JSON.stringify(messages, null, 2));
        fs.writeFileSync(`data/${channel.guild.id}/messages.json`, JSON.stringify(formattedMessages, null, 2));

        // fetch(`${process.env.API_URL}/api/v1/analyze`, {
        //   method: 'POST',
        //   body: JSON.stringify(formattedMessages),
        // }).then(res => res.json()).then(async (data) => {
        //   const tickets = generateTickets(data);
        //   storeTickets(tickets, channel.guild.id);
        //   await interaction.editReply({
        //     content: `Tickets generated successfully`
        //   });
        // }).catch(async (err) => {
        //   await interaction.editReply({ content: `Error analyzing channel: ${err}` });
        // });

        const tickets = generateTickets(dummyReponse);
        const embeds = tickets2Embeds(tickets);

        const ticketIds = await Promise.all(embeds.map(async (embed) => {
          const msg = await interaction.channel.send({ embeds: [embed.embed] });
          await msg.react('👍');
          return msg.id;
        }));

        storeTickets(tickets, ticketIds, channel.guild.id);

      } catch (error) {
        console.error('Error analyzing channel:', error);
        await interaction.editReply({ content: `Error analyzing channel: ${error}` });
      }
    } else {
      // form modal
      const modal = new ModalBuilder()
        .setCustomId('ticket-form')
        .setTitle('Process')
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
              .setCustomId('ticket-form-description')
              .setLabel('Description')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
        );
      await interaction.showModal(modal);
    }
  },
};