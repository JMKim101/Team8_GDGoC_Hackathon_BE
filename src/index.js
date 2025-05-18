const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, REST, Routes, EmbedBuilder, Partials } = require('discord.js');
const dotenv = require('dotenv');
const { loadTickets } = require('./utils/ticket');
const ticket2Embed = require('./utils/ticket2Embed');
const { generateTickets, storeTickets } = require('./utils/ticket');
const { days_of_week_value } = require('./utils/date');

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.commands = new Collection();

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

client.once(Events.ClientReady, () => {
  console.log(`Ready! ${client.user?.tag} logged in`);
});

client.login(process.env.TOKEN).catch(error => {
  console.error('Error logging in:', error);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error while executing this command!' });
    } else {
      await interaction.reply({ content: 'There was an error while executing this command!' });
    }
  }
});

// 버튼 클릭 상호작용 처리
client.on(Events.InteractionCreate, async interaction => {
  // 버튼 클릭이 아니면 리턴
  if (!interaction.isButton()) return;

  // 버튼 ID가 assign_ticket_로 시작하는지 확인
  if (interaction.customId.startsWith('assign_ticket_')) {
    // 버튼 ID에서 티켓 ID 추출 (예: assign_ticket_<uuid>)
    const ticketId = interaction.customId.replace('assign_ticket_', '');

    // 상호작용한 유저 정보 가져오기
    const userId = interaction.user.id;
    const userName = interaction.user.tag;

    // 로그에 기록
    console.log(`Ticket assigned: ticket ID ${ticketId}`);
    console.log(`Assigned user: ${userName} (ID: ${userId})`);

    // 데이터베이스나 파일에 정보 저장
    // 실제 구현에서는 이 부분에 데이터 저장 로직 추가
    const userAssignments = {
      userId,
      userName,
      ticketId,
      assignedAt: new Date().toISOString()
    };

    // 예시: JSON 파일에 저장
    let assignments = [];
    const assignmentsFile = path.join(__dirname, '../data/assignments.json');

    // 디렉토리가 없으면 생성
    if (!fs.existsSync(path.join(__dirname, '../data'))) {
      fs.mkdirSync(path.join(__dirname, '../data'));
    }

    // 기존 파일이 있으면 로드
    if (fs.existsSync(assignmentsFile)) {
      try {
        assignments = JSON.parse(fs.readFileSync(assignmentsFile, 'utf8'));
      } catch (error) {
        console.error('Error loading assignments data:', error);
      }
    }

    // 새 할당 데이터 추가
    assignments.push(userAssignments);

    // 파일에 저장
    try {
      fs.writeFileSync(assignmentsFile, JSON.stringify(assignments, null, 2));
    } catch (error) {
      console.error('Error saving assignments data:', error);
    }

    // 사용자에게 응답
    await interaction.reply({
      content: `<@${userId}>님이 티켓 ID(${ticketId})를 할당받았습니다!`,
      ephemeral: false // 모든 사람이 볼 수 있게 설정
    });
  }
});

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.TOKEN);

// and deploy your commands!
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // 전역 커맨드로 등록
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error('Error registering commands:', error);
  }
})();

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isModalSubmit()) return;

  // Get the data entered by the user
  const title = interaction.fields.getTextInputValue('ticket-form-title');
  const description = interaction.fields.getTextInputValue('ticket-form-description');
  const counts = interaction.fields.getTextInputValue('ticket-form-counts') || "0";
  const number = parseFloat(counts);
  console.log({ title, description, counts });

  if (isNaN(number)) {
    return interaction.reply({ content: '❌ invalid counts', ephemeral: true });
  }

  const now = new Date();
  const days_of_week = days_of_week_value[now.getDay()];

  fetch(`${process.env.API_URL}/extract`, {
    method: 'POST',
    body: JSON.stringify({
      prompt_type: "TICKETS",
      messages: [{
        author: "",
        content: `
        [TITLE] ${title}
        [DESCRIPTION]${description}
        `
      }],
      counts: number,
      timestamp: now.toISOString(),
      days_of_week: days_of_week
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  }).then(res => res.json()).then(async (data) => {
    console.log("data", data);
    const tickets = generateTickets(data.tickets);
    const embeds = tickets.map((ticket) => ticket2Embed(ticket));
    console.log("tickets", tickets)

    const ticketIds = await Promise.all(embeds.map(async (embed) => {
      const msg = await interaction.channel.send({ embeds: [embed] });
      await msg.react('⚪');
      return msg.id;
    }));
    console.log("ticketIds", ticketIds);

    storeTickets(tickets, ticketIds, interaction.guild.id, interaction.channel.id);
  }).catch(async (err) => {
    console.error(err);
    await interaction.editReply({ content: `Error analyzing channel: ${err}` });
  });
});

client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;

  console.log(`${user.tag} reacted: ${reaction.emoji.name}`);

  const ticketId = reaction.message.id;
  const userId = user.id;
  const guildId = reaction.message.guild.id;

  try {
    const tickets = loadTickets(guildId);
    console.log(tickets);

    const ticket = tickets.find(ticket => ticket.ticketId === ticketId);
    console.log(ticket);
    if (ticket) {
      if (reaction.emoji.name !== '⚪') {
        await reaction.users.remove(user);
        return;
      }
      // 해당 티켓이 이미 할당되었는지 확인
      if (ticket.assignee !== "") {
        console.log(`${user.tag} already assigned this ticket.`);
        await reaction.users.remove(user);
        return;
      }

      // 해당 유저가 이미 다른 티켓을 할당받았는지 확인
      const existingAssignees = tickets
        .filter(t => t.assignee === userId)
        .filter(t => t.contextId === ticket.contextId);

      if (existingAssignees.length > 0) {
        console.log(`${user.tag} already assigned another ticket.`);
        await reaction.users.remove(user);
        return;
      }

      ticket.assignee = userId;
      fs.writeFileSync(`data/${guildId}/tickets.json`, JSON.stringify(tickets, null, 2));

      const embed = ticket2Embed(ticket);
      await reaction.message.edit({ embeds: [embed] });
      await reaction.message.reactions.removeAll();
      await reaction.message.react('✅');
    }
  } catch (error) {
    console.error('Error processing ticket:', error);
  }
});

const sendRemind = async (ticket, leftTime) => {
  const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);
  const assignee = await guild.members.fetch(ticket.assignee).catch(() => null);
  const url = `https://discord.com/channels/${ticket.guildId}/${ticket.channelId}/${ticket.ticketId}`;

  if (!assignee?.send) {
    return;
  }

  await assignee.send({
    content: `⏰ **[Remind]** Deadline of **${ticket.title}** is **${leftTime}** left.\n🔗 [Ticket Link](${url})`,
  });
};

const checkDueDate = async () => {
  const now = new Date();

  const guildsPath = path.join(__dirname, '../data');
  const guilds = fs.readdirSync(guildsPath);
  for (const guild of guilds) {
    const tickets = loadTickets(guild);
    for (const ticket of tickets) {
      const dueDate = new Date(ticket.due_date);
      let diff = Math.floor((dueDate - now) / 1000 / 60);
      console.log(ticket.title, ticket.due_date, diff);

      if (diff == 5) {
        sendRemind(ticket, "5 minutes");
      } else if (diff == 30) {
        sendRemind(ticket, "30 minutes");
      } else if (diff == 60) {
        sendRemind(ticket, "1 hour");
      } else if (diff == 60 * 24) {
        sendRemind(ticket, "1 day");
      } else if (diff == 60 * 24 * 7) {
        sendRemind(ticket, "1 week");
      } else if (diff == 60 * 24 * 30) {
        sendRemind(ticket, "1 month");
      }
    }
  }
}

setTimeout(checkDueDate, 1000);
setInterval(checkDueDate, 60 * 1000);

client.on('interactionCreate', async (interaction) => {
  if (interaction.isMessageContextMenuCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Error occurred while executing this command!', ephemeral: true });
    }
  }
});