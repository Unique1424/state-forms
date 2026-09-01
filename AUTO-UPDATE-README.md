# State Forms Auto-Update

Этот проект настроен на автоматическое обновление production версии при изменениях в ветке `main`.

## Варианты настройки

### Вариант 1: Cron Job (простой)

Автоматически проверяет обновления каждые 5 минут.

**Установка:**
```bash
cd /root/js/state-forms/state-forms
./setup-cron.sh
```

**Изменить интервал:**
```bash
crontab -e
# Измени */5 на нужное значение (например, */10 для 10 минут)
```

**Просмотр логов:**
```bash
tail -f /var/log/state-forms-auto-update.log
```

**Отключить:**
```bash
crontab -e
# Удали или закомментируй строку с auto-update-production.sh
```

### Вариант 2: GitHub Webhook (рекомендуется)

Мгновенное обновление при push в main.

**1. Запусти webhook сервер:**
```bash
cd /root/js/state-forms/state-forms
pm2 start webhook-server.js --name state-forms-webhook
pm2 save
```

**2. Настрой GitHub webhook:**
1. Перейди в репозиторий: https://github.com/Unique1424/state-forms/settings/hooks
2. Нажми "Add webhook"
3. Заполни:
   - **Payload URL**: `http://твой-сервер-ip:9000/webhook/github`
   - **Content type**: `application/json`
   - **Secret**: `change-me-to-secure-secret` (или измени в .env)
   - **Events**: выбери "Just the push event"
4. Нажми "Add webhook"

**3. (Опционально) Установи WEBHOOK_SECRET:**
```bash
echo "WEBHOOK_SECRET=твой-секретный-ключ" >> /root/js/state-forms/state-forms/.env
pm2 restart state-forms-webhook
```

**4. Настрой nginx reverse proxy (если нужен HTTPS):**
```nginx
location /webhook/github {
    proxy_pass http://localhost:9000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Как это работает

1. При push в `main` (или по расписанию):
2. Создается отдельный worktree с production версией
3. Frontend файлы копируются в `origin/main/`
4. Запускается `deploy.sh` → обновляется `/var/www/state-forms/`
5. PM2 перезапускает процесс `state-forms`

**Важно:** Твоя текущая ветка не меняется! Можешь работать на любой ветке, production обновляется независимо.

## Ручное обновление

Если нужно обновить production вручную:
```bash
/root/js/state-forms/state-forms/auto-update-production.sh
```

## Troubleshooting

**Проверить статус webhook сервера:**
```bash
pm2 logs state-forms-webhook
```

**Проверить cron:**
```bash
crontab -l
```

**Проверить логи обновлений:**
```bash
tail -100 /var/log/state-forms-auto-update.log
```

**Удалить production worktree:**
```bash
cd /root/js/state-forms/state-forms
git worktree remove /root/js/state-forms/production-worktree --force
```
