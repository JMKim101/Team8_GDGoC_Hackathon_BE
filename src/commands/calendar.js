const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const fs = require('node:fs');
const dotenv = require('dotenv');
const { loadTickets, storeTickets } = require('../utils/ticket');
dotenv.config();

const priority2ColorId = {
  "LOW": "10",
  "MID": "5",
  "HIGH": "11",
}

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('enroll to calendar')
    .setType(ApplicationCommandType.Message),
  async execute(interaction) {
    const { guildId, channelId, id } = interaction.targetMessage;
    console.log("enroll to calendar", guildId, channelId, id);
    await interaction.reply({ content: `Enrolling to calendar...`, ephemeral: true });

    const tickets = loadTickets(guildId);
    const targetTicket = tickets.find(ticket => ticket.ticketId === id);
    if (!targetTicket) {
      await interaction.editReply({ content: `Ticket not found`, ephemeral: true });
      return;
    }
    console.log("targetTicket", targetTicket);
    try {
      const res = await fetch(`${process.env.API_URL}/create_event`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: `${interaction.user.id}`,
          ticket: {
            title: targetTicket.title,
            description: targetTicket.description,
            due_date: targetTicket.due_date,
            assignee: targetTicket.assignee,
            priority: targetTicket.priority,
          },
          color_id: priority2ColorId[targetTicket.priority],
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      console.log("data", data);
      if (data.status !== 200 && data.message !== "Event created") {
        await interaction.editReply({ content: `[to use this command, please login to calendar first](${process.env.API_URL}/auth?user_id=${interaction.user.id})`, ephemeral: true });
        return;
      }
      await interaction.editReply({ content: `Enrolled to calendar`, ephemeral: true });
    } catch (err) {
      console.error("err", err);
      await interaction.editReply({ content: `Error enrolling to calendar: ${err}`, ephemeral: true });
    }
  },
};