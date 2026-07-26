const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const fs = require("fs");
const { Routes } = require('discord-api-types/v10');
const { REST } = require('@discordjs/rest');
require('dotenv').config();

const client = new Client({
  partials: [
    Partials.Message, Partials.Channel, Partials.GuildMember,
    Partials.Reaction, Partials.GuildScheduledEvent, Partials.User, Partials.ThreadMember,
  ],
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildEmojisAndStickers, GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildWebhooks, GatewayIntentBits.GuildInvites, GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping, GatewayIntentBits.DirectMessages, GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping, GatewayIntentBits.MessageContent,
  ],
  rest: { timeout: 60_000 }
});

module.exports = client;

client.commands = new Collection();
client.slashcommands = new Collection();
client.directcommands = new Collection(); // ✅ Коллекция для ЛС
client.contextmenus = new Collection();
client.commandaliases = new Collection();

const slashcommands = [];

if (fs.existsSync('./slashcmd/')) {
  fs.readdirSync('./slashcmd/').forEach(folder => {
    const folderPath = `./slashcmd/${folder}`;
    if (!fs.statSync(folderPath).isDirectory()) return;

    const commands = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    for (const file of commands) {
      const command = require(`${folderPath}/${file}`);
      if (!command.data) continue;

      slashcommands.push(command.data.toJSON());

      // 🔀 Маршрутизация: папка direct_commands → в ЛС, остальные → на сервер
      if (folder.toLowerCase() === 'direct_commands') {
        client.directcommands.set(command.data.name, command);
      } else {
        client.slashcommands.set(command.data.name, command);
      }
    }
  });
}

// ✅ Передаём client явно, чтобы убрать require("..") и циклические зависимости
require("./events/message.js")(client);
require("./events/ready.js")
require("./events/interactionCreate.js")(client);



const rest = new REST({ version: '10' }).setToken(process.env.Discord_token);

client.on("ready", async () => {
  console.log(`🟢 Бот онлайн: ${client.user.tag}`);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: slashcommands }
    );
    console.log(`✅ Зарегистрировано ${slashcommands.length} команд глобально`);
  } catch (error) {
    console.error("❌ Ошибка регистрации команд:", error);
  }
});

client.login(process.env.Discord_token).catch(e => {
  console.log("Ошибка подключения к боту!");
  console.error(e);
}); 