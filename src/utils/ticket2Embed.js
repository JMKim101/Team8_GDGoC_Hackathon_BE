const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const priority2Emoji = {
  "LOW": "🟢",
  "MID": "🟡",
  "HIGH": "🔴",
}

const ticket2Embed = (ticket) => {
  console.log("ticket2Embed", priority2Emoji[ticket.priority]);
  return new EmbedBuilder()
    .setColor(ticket.color)
    .setTitle(`:pencil: [${ticket.title}]`)
    .addFields(
      { name: `Assignee`, value: `:bust_in_silhouette: <@${ticket.assignee}>`, inline: true },
      { name: `Due Date`, value: `:alarm_clock: ${new Date(ticket.due_date).toLocaleString()}`, inline: true },
      { name: `Priority`, value: `${priority2Emoji[ticket.priority]}`, inline: true },
    )
    .addFields(
      { name: `Description`, value: `${ticket.description}`, inline: false },
    )
    .setFooter({ text: `Ticket Context ID: ${ticket.contextId}` })
}

module.exports = ticket2Embed;