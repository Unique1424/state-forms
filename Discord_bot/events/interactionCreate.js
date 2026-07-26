module.exports = (client) => {
  client.on("interactionCreate", async (interaction) => {
    if (interaction.user.bot) return;

    // Slash commands
    if (interaction.isChatInputCommand()) {
      const isDM = !interaction.guild;
      const collection = isDM
        ? client.directcommands
        : client.slashcommands;

      const command = collection.get(interaction.commandName);
      if (!command) return;

      try {
        await command.run(client, interaction);
      } catch (error) {
        console.error(`Ошибка /${interaction.commandName} [${isDM ? 'ЛС' : 'Сервер'}]:`, error);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Произошла ошибка при выполнении команды.",
            ephemeral: true
          }).catch(() => {});
        } else if (interaction.deferred) {
          await interaction.editReply({
            content: "Произошла ошибка при выполнении команды."
          }).catch(() => {});
        }
      }
    }

    // Buttons, Select Menus, Modals — handled by modules
    // (leader_applications.js registers its own listener via client.on)
  });
};
