const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const fs = require('node:fs');
const dotenv = require('dotenv');
const { loadTickets, storeTickets } = require('../utils/ticket');
dotenv.config();

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('remove all in this context')
    .setType(ApplicationCommandType.Message),
  async execute(interaction) {
    const { guildId, channelId, id } = interaction.targetMessage;
    console.log("remove", guildId, channelId, id);

    const tickets = loadTickets(guildId);
    const targetTicket = tickets.find(ticket => ticket.ticketId === id);
    if (targetTicket) {
      console.log("targetTicket", targetTicket);
      const targetTickets = tickets.filter(ticket => ticket.contextId === targetTicket.contextId);
      for (const ticket of targetTickets) {
        await interaction.channel.messages.fetch(ticket.ticketId).then((msg) => msg.delete());
      }
      const filteredTickets = tickets.filter(ticket => ticket.contextId !== targetTicket.contextId);
      storeTickets(filteredTickets, filteredTickets.map(ticket => ticket.ticketId), guildId, channelId);
      await interaction.reply({ content: `Removed all tickets about this context` });
    }
  },
};