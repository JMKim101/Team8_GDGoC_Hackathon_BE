const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const hsv2rgb = require('./color');
const fs = require('fs');

priority2Emoji = {
  "LOW": "🟢",
  "MID": "🟡",
  "HIGH": "🔴",
}

const generateTickets = (response) => {
  const contextId = uuidv4();
  const ticketColors = response.map((_, idx) => hsv2rgb(idx / response.length * 360, 1, 1));
  const tickets = response.map((ticket, index) => ({
    title: ticket.title,
    color: ticketColors[index],
    description: ticket.description,
    due_date: ticket.due_date,
    assignee: "",
    priority: ticket.priority,
    contextId: contextId,
  }));

  return tickets; 
};

const storeTickets = (tickets, ticketIds, guild_id, channel_id) => {
  if (!fs.existsSync(`data/${guild_id}`))
    fs.mkdirSync(`data/${guild_id}`);
  const ticketsFilePath = `data/${guild_id}/tickets.json`;
  const recentTickets = loadTickets(guild_id);
  fs.writeFileSync(ticketsFilePath, JSON.stringify([
    ...recentTickets, 
    ...tickets.map((ticket, index) => ({ 
      ...ticket, 
      due_date: new Date(ticket.due_date).toISOString(),
      ticketId: ticketIds[index],
      guildId: guild_id,
      channelId: channel_id,
    }))
  ], null, 2));
}

const loadTickets = (guild_id) => {
  const ticketsFilePath = `data/${guild_id}/tickets.json`;
  if (!fs.existsSync(ticketsFilePath))
    fs.writeFileSync(ticketsFilePath, JSON.stringify([], null, 2));
  return JSON.parse(fs.readFileSync(ticketsFilePath, 'utf8'));
}

module.exports = {
  generateTickets,
  storeTickets,
  loadTickets,
};