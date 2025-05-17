const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const tickets2Embeds = (tickets) => {
  return tickets.map((ticket, index) => {
    const embed = new EmbedBuilder()
      .setColor(ticket.color)
      .setTitle(`:pencil: [${ticket.title}]`)
      .addFields(
        { name: `Assignee`, value: `:bust_in_silhouette: ${ticket.assignee}`, inline: true },
        { name: `Due Date`, value: `:alarm_clock: ${ticket.dueDate.toLocaleString()}`, inline: true },
        { name: `Priority`, value: `:memo: ${ticket.priority}`, inline: true },
      )
      .addFields(
        { name: `Description`, value: `${ticket.description}`, inline: false },
      )
      
    const buttonRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`assign_ticket_${ticket.id}`) // UUID를 custom ID로 사용
          .setLabel('할당하기')
          .setStyle(ButtonStyle.Primary),
      );
      
    return { embed, buttonRow };
  });
}

module.exports = tickets2Embeds;