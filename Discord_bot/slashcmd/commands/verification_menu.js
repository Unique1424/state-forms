const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildVerificationMenu } = require('../../modules/leader_applications');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verification_menu')
    .setDescription('Отправить меню верификации в канал')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  run: async (client, interaction) => {
    try {
      await buildVerificationMenu(client);
      await interaction.reply({ content: 'Меню верификации отправлено.', flags: 64 });
    } catch (err) {
      console.error('Ошибка отправки меню верификации:', err);
      await interaction.reply({ content: 'Ошибка при отправке меню.', flags: 64 });
    }
  },
};
