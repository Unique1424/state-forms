# State Forms

Система кастомных форм с интеграцией в Discord. Позволяет создавать формы для департаментов с автоматической отправкой ответов в Discord webhooks.

## 🚀 Возможности

- 📝 Создание кастомных форм с различными типами полей
- 🔐 Авторизация через Discord OAuth2
- 👥 Система ролей (User, Deputy Leader, Leader, Developer)
- 📊 Статистика ответов по департаментам
- 🌓 Темная и светлая тема
- 📱 Адаптивный дизайн
- 🖼️ Загрузка и оптимизация изображений

## 📋 Требования

- **Node.js** 18.x или выше
- **MySQL** 8.0 или выше
- **Discord Application** с настроенным OAuth2

## 🛠️ Установка

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd state-forms
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка переменных окружения

```bash
cp .env.example .env
```

Отредактируйте `.env` файл и заполните необходимые значения:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=state_forms

# Discord OAuth2 (получить на https://discord.com/developers/applications)
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=http://localhost:3001/auth/discord/callback

# Сгенерировать случайные ключи:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=your_random_session_secret
ENCRYPTION_KEY=your_random_encryption_key

PORT=3001
NODE_ENV=development
```

### 4. Настройка Discord Application

1. Перейдите на [Discord Developer Portal](https://discord.com/developers/applications)
2. Создайте новое приложение или используйте существующее
3. В разделе **OAuth2** добавьте Redirect URL:
   - Development: `http://localhost:3001/auth/discord/callback`
   - Production: `https://your-domain.com/auth/discord/callback`
4. Скопируйте **Client ID** и **Client Secret** в `.env`

### 5. Настройка базы данных

Создайте базу данных MySQL:

```sql
CREATE DATABASE state_forms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Таблицы будут созданы автоматически при первом запуске сервера.

## 🎯 Запуск

### Development режим

```bash
npm start
```

Сервер запустится на `http://localhost:3001`

### Staging режим

```bash
npm run start:staging
```

### Production режим

```bash
NODE_ENV=production npm start
```

## 📁 Структура проекта

```
state-forms/
├── main/                 # Production фронтенд
│   ├── index.html
│   ├── department.html
│   ├── forms.html
│   └── ...
├── staging/              # Staging фронтенд
├── uploads/              # Загруженные изображения
├── Discord_bot/          # Discord бот (опционально)
├── server.js             # Главный сервер
├── server-staging.js     # Staging сервер
├── package.json
└── .env
```

## 🔐 Безопасность

- Все SQL-запросы используют параметризованные запросы
- Сессии хранятся в MySQL с шифрованием
- Пароли и секреты шифруются через AES-256-CBC
- Rate limiting для защиты от DDoS (см. ниже)
- CORS настроен для безопасных запросов

## 🚢 Деплой

### С использованием PM2

```bash
# Установить PM2
npm install -g pm2

# Запустить приложение
pm2 start ecosystem.config.js

# Автозапуск при перезагрузке
pm2 startup
pm2 save
```

### С использованием Docker (опционально)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

## 🧪 Git Workflow

Проект использует Conventional Commits и Git Flow:

### Структура веток

- `main` — production-ready код
- `staging` — тестирование перед продакшеном
- `feature/*` — разработка новых фич
- `hotfix/*` — срочные исправления

### Формат коммитов

```
<type>: <description>

[optional body]

[optional footer]
```

**Типы:**
- `feat` — новая функциональность
- `fix` — исправление бага
- `docs` — документация
- `style` — форматирование
- `refactor` — рефакторинг
- `test` — тесты
- `chore` — рутинные задачи

**Примеры:**
```bash
git commit -m "feat: добавлена статистика департамента"
git commit -m "fix: исправлена ошибка загрузки форм в Safari"
git commit -m "docs: обновлен README с инструкцией по установке"
```

### Процесс разработки

1. Создайте feature-ветку:
```bash
git checkout -b feature/new-feature
```

2. Внесите изменения и закоммитьте:
```bash
git add .
git commit -m "feat: добавлена новая фича"
```

3. Отправьте в staging для тестирования:
```bash
git checkout staging
git merge feature/new-feature
git push origin staging
```

4. После тестирования отправьте в main:
```bash
git checkout main
git merge staging
git tag v1.x.x
git push origin main --tags
```

## 📝 API Endpoints

### Авторизация
- `GET /auth/discord` — начало OAuth2 flow
- `GET /auth/discord/callback` — callback после авторизации
- `GET /auth/logout` — выход из системы

### Пользователи
- `GET /api/me` — текущий пользователь
- `GET /api/users` — список пользователей (только admin)

### Департаменты
- `GET /api/departments` — список департаментов
- `GET /api/departments/:id` — информация о департаменте
- `GET /api/departments/:id/stats` — статистика департамента

### Формы
- `GET /api/forms` — список форм
- `POST /api/forms` — создание формы
- `GET /api/forms/:id` — информация о форме
- `PUT /api/forms/:id` — обновление формы
- `DELETE /api/forms/:id` — удаление формы
- `POST /api/forms/:id/submit` — отправка ответа

### Изображения
- `POST /api/images/upload` — загрузка изображения
- `GET /i/:id` — получение изображения
- `DELETE /i/:id` — удаление изображения

## 🐛 Troubleshooting

### Ошибка подключения к БД

```
Error: ER_ACCESS_DENIED_ERROR
```

**Решение:** Проверьте `DB_USER`, `DB_PASSWORD` и права доступа MySQL.

### Ошибка Discord OAuth

```
Error: invalid_client
```

**Решение:** Проверьте `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` и Redirect URL.

### Порт уже занят

```
Error: listen EADDRINUSE: address already in use :::3001
```

**Решение:** Измените `PORT` в `.env` или остановите процесс на порту 3001.

## 📄 Лицензия

Private project

## 👤 Автор

**zxcscared**
- Email: sviatoslav0809@gmail.com
- GitHub: [@zxcscared](https://github.com/zxcscared)

## 🙏 Благодарности

- [Express.js](https://expressjs.com/)
- [MySQL2](https://github.com/sidorares/node-mysql2)
- [Sharp](https://sharp.pixelplumbing.com/)
- [Discord.js](https://discord.js.org/)
