require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10
});

db.getConnection()
  .then(async conn => {
    conn.release();
    console.log('MySQL connected');
    await db.execute(`CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      discord_id VARCHAR(20) NOT NULL UNIQUE,
      username VARCHAR(100) NOT NULL,
      avatar VARCHAR(100),
      email VARCHAR(255),
      role ENUM('user', 'leader', 'developer') DEFAULT 'user',
      department_id INT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
    try { await db.execute("ALTER TABLE users ADD COLUMN role ENUM('user', 'leader', 'developer') DEFAULT 'user'"); } catch (e) {}
    try { await db.execute("ALTER TABLE users ADD COLUMN department_id INT UNSIGNED DEFAULT NULL"); } catch (e) {}

    await db.execute(`CREATE TABLE IF NOT EXISTS departments (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      short_name VARCHAR(30) NOT NULL,
      color VARCHAR(7) DEFAULT '#5865F2',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    const [depts] = await db.execute('SELECT COUNT(*) as c FROM departments');
    if (depts[0].c === 0) {
      const defaults = [
        ['Los Santos Police Department', 'LSPD', '#1E3A5F'],
        ['Los Santos County Sheriff Department', 'LSCSD', '#4A2D7A'],
        ['Federal Investigation Bureau', 'FIB', '#2C3E50'],
        ['San Andreas National Guard', 'SANG', '#556B2F'],
        ['Emergency Medical Services', 'EMS', '#C0392B'],
        ['Weazel News', 'Weazel News', '#E67E22'],
        ['Government of San Andreas', 'GOV', '#1A5276'],
        ['Министерство Юстиции', 'Мин. Юстиции', '#6C3483'],
        ['Министерство Безопасности', 'Мин. Безопасности', '#922B21'],
        ['Министерство Здравоохранения', 'Мин. Здравоохр.', '#148F77'],
        ['Министерство Финансов', 'Мин. Финансов', '#B7950B'],
        ['Министерство Обороны', 'Мин. Обороны', '#4D5656'],
        ['Министерство Культуры', 'Мин. Культуры', '#AF7AC5'],
        ['Мэрия округа Лос-Сантос', 'Мэрия ЛС', '#2E86C1'],
        ['Мэрия округа Блэйн', 'Мэрия Блэйн', '#28B463'],
        ['Судебная власть', 'Суд', '#7B7D7D']
      ];
      for (const [name, short, color] of defaults) {
        await db.execute('INSERT INTO departments (name, short_name, color) VALUES (?, ?, ?)', [name, short, color]);
      }
    }
  })
  .catch(err => console.error('MySQL connection failed:', err.message));

app.set('trust proxy', 1);

const sessionStore = new MySQLStore({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT) || 3306,
  clearExpired: true,
  checkExpirationInterval: 900000,
  expiration: 7 * 24 * 60 * 60 * 1000
});

app.use(session({
  key: 'state_forms_sid',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.use(express.json());

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

app.get('/auth/discord', (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20email`;
  res.redirect(url);
});

app.get('/auth/discord/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code provided');

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.status(400).send('Token exchange failed');

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const user = await userRes.json();
    req.session.user = {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      email: user.email
    };

    await db.execute(
      `INSERT INTO users (discord_id, username, avatar, email)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE username = VALUES(username), avatar = VALUES(avatar), email = VALUES(email)`,
      [user.id, user.username, user.avatar, user.email]
    );

    res.redirect('/');
  } catch (err) {
    console.error('OAuth error:', err);
    res.status(500).send('Authentication failed');
  }
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/api/me', async (req, res) => {
  if (!req.session.user) return res.json({ loggedIn: false });
  try {
    const [rows] = await db.execute(`
      SELECT u.role, u.department_id, d.name as department_name, d.short_name as department_short, d.color as department_color
      FROM users u LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.discord_id = ?`, [req.session.user.id]);
    const r = rows.length ? rows[0] : { role: 'user', department_id: null };
    res.json({ loggedIn: true, user: { ...req.session.user, role: r.role, department_id: r.department_id, department_name: r.department_name, department_short: r.department_short, department_color: r.department_color } });
  } catch (err) {
    res.json({ loggedIn: true, user: { ...req.session.user, role: 'user' } });
  }
});

app.get('/api/db-check', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT 1 + 1 AS result');
    res.json({ connected: true, result: rows[0].result });
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT u.id, u.discord_id, u.username, u.avatar, u.role, u.department_id,
             d.name as department_name, d.short_name as department_short, d.color as department_color
      FROM users u LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY u.created_at DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/count', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT COUNT(*) as count FROM users');
    res.json({ count: rows[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id/role', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  const [caller] = await db.execute('SELECT role, id FROM users WHERE discord_id = ?', [req.session.user.id]);
  if (!caller.length || caller[0].role !== 'developer') return res.status(403).json({ error: 'Forbidden' });
  if (caller[0].id == req.params.id) return res.status(403).json({ error: 'Cannot change own role' });
  const { role } = req.body;
  if (!['user', 'leader', 'developer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (role !== 'leader') {
    await db.execute('UPDATE users SET role = ?, department_id = NULL WHERE id = ?', [role, req.params.id]);
  } else {
    await db.execute('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
  }
  res.json({ success: true });
});

app.put('/api/users/:id/department', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  const [caller] = await db.execute('SELECT role FROM users WHERE discord_id = ?', [req.session.user.id]);
  if (!caller.length || caller[0].role !== 'developer') return res.status(403).json({ error: 'Forbidden' });
  const [target] = await db.execute('SELECT role FROM users WHERE id = ?', [req.params.id]);
  if (!target.length || target[0].role !== 'leader') return res.status(403).json({ error: 'Can only assign department to leader' });
  const { department_id } = req.body;
  await db.execute('UPDATE users SET department_id = ? WHERE id = ?', [department_id || null, req.params.id]);
  res.json({ success: true });
});

app.get('/api/departments', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM departments ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/departments/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const [dept] = await db.execute('SELECT * FROM departments WHERE id = ?', [req.params.id]);
    if (!dept.length) return res.status(404).json({ error: 'Not found' });
    const [members] = await db.execute('SELECT id, discord_id, username, avatar, role FROM users WHERE department_id = ?', [req.params.id]);
    res.json({ ...dept[0], members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(path.join(__dirname, 'main')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'main', 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
