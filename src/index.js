const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, REST, Routes } = require('discord.js');
const dotenv = require('dotenv');

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
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
  console.log(`준비 완료! ${client.user?.tag}으로 로그인됨`);
});

client.login(process.env.TOKEN).catch(error => {
  console.error('봇 로그인 중 오류 발생:', error);
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
    console.log(`티켓 할당됨: 티켓 ID ${ticketId}`);
    console.log(`할당된 유저: ${userName} (ID: ${userId})`);

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
        console.error('할당 데이터 로드 중 오류:', error);
      }
    }

    // 새 할당 데이터 추가
    assignments.push(userAssignments);

    // 파일에 저장
    try {
      fs.writeFileSync(assignmentsFile, JSON.stringify(assignments, null, 2));
    } catch (error) {
      console.error('할당 데이터 저장 중 오류:', error);
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

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
})();

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isModalSubmit()) return;

  // Get the data entered by the user
  const title = interaction.fields.getTextInputValue('ticket-form-title');
  const description = interaction.fields.getTextInputValue('ticket-form-description');
  console.log({ title, description });

  fetch(`${process.env.API_URL}/api/v1/process`, {
    method: 'POST',
    body: JSON.stringify({ title, description }),
  }).then(res => res.json()).then(async (data) => {
    await interaction.reply({ content: 'Process created' });
  }).catch(async (err) => {
    await interaction.reply({ content: `Error creating process: ${err}` });
  });
});

client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;

  console.log(`${user.tag}가 반응: ${reaction.emoji.name}`);
  // 처리 로직
  const ticketId = reaction.message.id;
  const userId = user.id;

  const existingTickets = fs.readFileSync(`data/${reaction.message.guild.id}/tickets.jsonl`, 'utf8');
  const tickets = jsonlines.parse(existingTickets);

  const ticket = tickets.find(ticket => ticket.ticketId === ticketId);
  if (ticket) {
    // 해당 유저가 이미 다른 티켓을 먹었는지 확인
    const existingAssignees = tickets
      .filter(ticket => ticket.assignee === userId)
      .filter(ticket => ticket.contextId === ticket.contextId);
    if (existingAssignees.length > 0) {
      console.log(`${user.tag}가 이미 다른 티켓을 먹었습니다.`);
      await reaction.users.remove(user);
      return;
    }

    // 해당 티켓이 선점되었는지 확인
    const occupied = ticket.assignee !== "";
    if (occupied) {
      console.log(`${user.tag}가 이미 이 티켓을 선점했습니다.`);
      await reaction.users.remove(user);
      return;
    }

    ticket.assignee = userId;
    fs.writeFileSync(`data/${reaction.message.guild.id}/tickets.jsonl`, jsonlines.stringify(tickets));
    const embed = new EmbedBuilder()
      .setColor(ticket.color)
      .setTitle(`:pencil: [${ticket.title}]`)
      .addFields(
        { name: `Assignee`, value: `:bust_in_silhouette: <@${ticket.assignee}>`, inline: true },
        { name: `Due Date`, value: `:alarm_clock: ${ticket.dueDate.toLocaleString()}`, inline: true },
        { name: `Priority`, value: `:memo: ${ticket.priority}`, inline: true },
      )
      .addFields(
        { name: `Description`, value: `${ticket.description}`, inline: false },
      )
    await reaction.message.edit({ embeds: [embed] });

    // remove reaction from message by all users
    await reaction.users.remove(user);
  }
});