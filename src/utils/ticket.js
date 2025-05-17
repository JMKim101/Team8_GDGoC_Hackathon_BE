const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const jsonlines = require('jsonlines');
const hsv2rgb = require('./color');
const fs = require('fs');

const generateTickets = (response) => {
  const contextId = uuidv4();
  const ticketColors = response.map((_, idx) => hsv2rgb(idx / response.length * 360, 1, 1));
  const tickets = response.map((ticket, index) => ({
    title: ticket.title,
    color: ticketColors[index],
    description: ticket.description,
    dueDate: ticket.dueDate,
    assignee: "",
    priority: ticket.priority,
    contextId: contextId,
  }));

  return tickets;
};

const storeTickets = (tickets, ticketIds, guild_id) => {
  if (!fs.existsSync(`data/${guild_id}`))
    fs.mkdirSync(`data/${guild_id}`);
  const ticketsFilePath = `data/${guild_id}/tickets.jsonl`;
  const writer = jsonlines.stringify();
  writer.pipe(fs.createWriteStream(ticketsFilePath));
  tickets.forEach((ticket, index) => writer.write({ ...ticket, ticketId: ticketIds[index] }));
  writer.end();
}

module.exports = {
  generateTickets,
  storeTickets,
};