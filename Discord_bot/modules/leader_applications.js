const {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ChannelType,
  PermissionFlagsBits,
  Routes,
} = require('discord.js');
const db = require('../utils/db');

const VERIFICATION_CHANNEL = '1530663326659383367';

function encodeId(...parts) {
  return parts.join(':');
}

function decodeId(str) {
  return str.split(':');
}

async function buildVerificationMenu(client) {
  const channel = client.channels.cache.get(VERIFICATION_CHANNEL);
  if (!channel) {
    console.error('Канал верификации не найден:', VERIFICATION_CHANNEL);
    return;
  }

  await channel.send({
    flags: 1 << 15,
    components: [
      new ContainerBuilder()
        .setAccentColor(0x5865F2)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# Система верификации лидера')
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            'Для получения роли лидера на сайте нажмите кнопку ниже и заполните заявку.\n' +
            'После рассмотрения заявки вам будет выдана роль.'
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setDivider(true).setSpacing(2)
        )
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('**Подать заявку на роль лидера**')
            )
            .setButtonAccessory(
              new ButtonBuilder()
                .setCustomId('verify_start')
                .setLabel('Подать заявку')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📝')
            )
        ),
    ],
  });
}

function registerHandlers(client) {
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isButton()) {
        await handleButton(client, interaction);
      } else if (interaction.isModalSubmit()) {
        await handleModal(client, interaction);
      }
    } catch (err) {
      console.error('Verification handler error:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Произошла ошибка.', flags: 64 }).catch(() => {});
      }
    }
  });
}

async function handleButton(client, interaction) {
  const id = interaction.customId;

  if (id === 'verify_start') {
    const [existingUser] = await db.execute(
      'SELECT id FROM users WHERE discord_id = ?',
      [interaction.user.id]
    );

    if (!existingUser.length) {
      return interaction.reply({
        content: 'Вы не авторизованы на сайте. Сначала войдите через Discord:\nhttps://state-forms.site/auth/discord',
        flags: 64,
      });
    }

    const [departments] = await db.execute('SELECT id, name, short_name FROM departments ORDER BY id');
    if (!departments.length) {
      return interaction.reply({ content: 'Нет доступных ведомств.', flags: 64 });
    }

    const deptOptions = departments.map((d) => ({
      label: d.name,
      value: String(d.id),
      description: d.short_name,
    }));

    const modalPayload = {
      type: 9,
      data: {
        custom_id: encodeId('verify_modal', interaction.user.id),
        title: 'Заявка на роль лидера',
        components: [
          {
            type: 18,
            id: 1,
            label: 'Ваше ведомство',
            description: 'Выберите ведомство в котором вы хотите стать лидером',
            component: {
              type: 3,
              id: 11,
              custom_id: 'dept_select',
              placeholder: 'Выберите ведомство',
              options: deptOptions,
              required: true,
            },
          },
          {
            type: 18,
            id: 2,
            label: 'Ссылка на Discord фракции',
            description: 'Укажите ссылку на Discord сервер вашей фракции',
            component: {
              type: 4,
              id: 12,
              custom_id: 'faction_link',
              style: 1,
              min_length: 5,
              placeholder: 'https://discord.gg/...',
              required: true,
            },
          },
        ],
      },
    };

    await client.rest.post(
      Routes.interactionCallback(interaction.id, interaction.token),
      { body: modalPayload }
    );
  }

  if (id.startsWith('verify_approve:') || id.startsWith('verify_reject:')) {
    const [action, applicantId, deptId] = decodeId(id);

    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Только администраторы могут одобрять/отклонять заявки.', flags: 64 });
    }

    const [dept] = await db.execute('SELECT name, short_name FROM departments WHERE id = ?', [deptId]);
    const deptName = dept.length ? dept[0].name : 'Неизвестно';
    const deptShort = dept.length ? dept[0].short_name : '???';

    const topic = interaction.channel.topic || '';
    const factionLinkMatch = topic.match(/faction_link:(.*?)\|/);
    const factionLink = factionLinkMatch ? factionLinkMatch[1] : 'Не указано';

    let applicantUser;
    try {
      applicantUser = await client.users.fetch(applicantId);
    } catch (e) {
      console.error('Не удалось получить пользователя:', e.message);
    }

    if (action === 'verify_approve') {
      const [updateResult] = await db.execute(
        'UPDATE users SET role = ?, department_id = ? WHERE discord_id = ?',
        ['leader', deptId, applicantId]
      );

      const statusContainer = new ContainerBuilder()
        .setAccentColor(0x57F287)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`<@&1529978629151396023>`)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## Верификация одобрена`)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setDivider(true).setSpacing(1)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**Ведомство:**\n• ${deptName} (${deptShort})\n\n` +
            `**Ссылка на фракцию:**\n• ${factionLink}`
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setDivider(true).setSpacing(1)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`Одобрено: ${interaction.user}`)
        );

      await interaction.update({ content: '', components: [statusContainer] });

      if (applicantUser) {
        await applicantUser.send(`Ваша заявка на роль лидера в **${deptName}** одобрена. Роль выдана на сайте.`).catch(() => {});
      }

      if (updateResult.affectedRows === 0) {
        await interaction.followUp({
          content: 'Пользователь не найден в базе данных. Возможно, он не авторизовывался на сайте.',
          flags: 64,
        });
      }

      setTimeout(async () => {
        try {
          await interaction.channel.delete('Заявка одобрена — удаление через 5 минут');
        } catch (e) {
          console.error('Ошибка удаления канала:', e.message);
        }
      }, 5 * 60 * 1000);
    }

    if (action === 'verify_reject') {
      const statusContainer = new ContainerBuilder()
        .setAccentColor(0xED4245)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`<@&1529978629151396023>`)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## Верификация отклонена`)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setDivider(true).setSpacing(1)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**Ведомство:**\n• ${deptName} (${deptShort})\n\n` +
            `**Ссылка на фракцию:**\n• ${factionLink}`
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setDivider(true).setSpacing(1)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`Отклонено: ${interaction.user}`)
        );

      await interaction.update({ content: '', components: [statusContainer] });

      if (applicantUser) {
        await applicantUser.send(`Ваша заявка на роль лидера в **${deptName}** отклонена.`).catch(() => {});
      }

      setTimeout(async () => {
        try {
          await interaction.channel.delete('Заявка отклонена');
        } catch (e) {
          console.error('Ошибка удаления канала:', e.message);
        }
      }, 5 * 60 * 1000);
    }
  }
}

async function handleModal(client, interaction) {
  if (!interaction.customId.startsWith('verify_modal:')) return;

  const [, applicantId] = decodeId(interaction.customId);

  const deptField = interaction.fields.getField('dept_select');
  const linkField = interaction.fields.getField('faction_link');

  const deptId = deptField?.values?.[0];
  const factionLink = linkField?.value;

  if (!deptId || !factionLink) {
    console.error('Missing fields — deptId:', deptId, 'factionLink:', factionLink);
    return interaction.reply({ content: 'Ошибка: не все поля заполнены.', flags: 64 });
  }

  const [dept] = await db.execute('SELECT name, short_name FROM departments WHERE id = ?', [deptId]);
  const deptName = dept.length ? dept[0].name : 'Неизвестно';
  const deptShort = dept.length ? dept[0].short_name : '???';

  const guild = interaction.guild;
  const channelName = `заявка-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9а-яё-]/gi, '').slice(0, 90);

  const overwrites = [
    {
      id: guild.roles.everyone,
      deny: BigInt(1024),
    },
    {
      id: applicantId,
      allow: BigInt(1024) | BigInt(2097152),
    },
    {
      id: client.user.id,
      allow: BigInt(1024) | BigInt(2097152) | BigInt(8),
    },
  ];

  const appChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    topic: `faction_link:${factionLink}|dept:${deptId}|user:${applicantId}`,
    permissionOverwrites: overwrites,
  });

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(encodeId('verify_approve', applicantId, deptId))
      .setLabel('Одобрить')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(encodeId('verify_reject', applicantId, deptId))
      .setLabel('Отклонить')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌')
  );

  const msgContainer = new ContainerBuilder()
    .setAccentColor(0x5865F2)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`<@&1529978629151396023>`)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## Верификация пользователя ${interaction.user}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(1)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Ведомство:**\n• ${deptName} (${deptShort})\n\n` +
        `**Ссылка на фракцию:**\n• ${factionLink}`
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(1)
    )
    .addActionRowComponents(actionRow);

  await appChannel.send({ flags: 1 << 15, components: [msgContainer] });

  await interaction.reply({
    content: `Ваша заявка создана: ${appChannel}`,
    flags: 64,
  });
}

module.exports = { buildVerificationMenu, registerHandlers };
