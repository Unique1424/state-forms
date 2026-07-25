require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const mysql = require('mysql2/promise');
const path = require('path');
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!text) return null;
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

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
      role ENUM('user', 'deputy_leader', 'leader', 'developer') DEFAULT 'user',
      department_id INT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
    try { await db.execute("ALTER TABLE users ADD COLUMN role ENUM('user', 'leader', 'developer') DEFAULT 'user'"); } catch (e) {}
    try { await db.execute("ALTER TABLE users MODIFY COLUMN role ENUM('user', 'deputy_leader', 'leader', 'developer') DEFAULT 'user'"); } catch (e) {}
    try { await db.execute("ALTER TABLE users ADD COLUMN department_id INT UNSIGNED DEFAULT NULL"); } catch (e) {}
    try { await db.execute("ALTER TABLE users DROP COLUMN is_deputy"); } catch (e) {}

    await db.execute(`CREATE TABLE IF NOT EXISTS forms (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      department_id INT UNSIGNED NOT NULL,
      name VARCHAR(255) NOT NULL,
      webhook_url TEXT,
      created_by BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS form_fields (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      form_id INT UNSIGNED NOT NULL,
      label VARCHAR(255) NOT NULL,
      type ENUM('short_text', 'long_text', 'select', 'date', 'datetime') NOT NULL,
      options JSON DEFAULT NULL,
      required TINYINT(1) DEFAULT 0,
      order_index INT UNSIGNED DEFAULT 0,
      FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
    )`);

    try { await db.execute("ALTER TABLE forms ADD COLUMN form_url VARCHAR(500) DEFAULT NULL"); } catch (e) {}
    try { await db.execute("ALTER TABLE forms ADD COLUMN slug VARCHAR(255) DEFAULT NULL"); } catch (e) {}
    try { await db.execute("ALTER TABLE forms ADD COLUMN message_template TEXT DEFAULT NULL"); } catch (e) {}
    try { await db.execute("ALTER TABLE forms ADD COLUMN embed_color VARCHAR(7) DEFAULT '#5865F2'"); } catch (e) {}
    try { await db.execute("ALTER TABLE form_responses MODIFY COLUMN user_id BIGINT UNSIGNED DEFAULT NULL"); } catch (e) {}
    try { await db.execute("ALTER TABLE form_responses DROP FOREIGN KEY form_responses_ibfk_2"); } catch (e) {}
    try { await db.execute("ALTER TABLE form_responses ADD CONSTRAINT form_responses_ibfk_2 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL"); } catch (e) {}

    await db.execute(`CREATE TABLE IF NOT EXISTS form_responses (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      form_id INT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED DEFAULT NULL,
      answers JSON NOT NULL,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )`);

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
        ['Министерство Юстиции', 'MOJ', '#6C3483'],
        ['Министерство Безопасности', 'MOB', '#922B21'],
        ['Министерство Здравоохранения', 'MOH', '#148F77'],
        ['Министерство Финансов', 'MOF', '#B7950B'],
        ['Министерство Обороны', 'MOD', '#4D5656'],
        ['Министерство Культуры', 'MOC', '#AF7AC5'],
        ['Мэрия округа Лос-Сантос', 'LSMD', '#2E86C1'],
        ['Мэрия округа Блэйн', 'BCMD', '#28B463'],
        ['Судебная власть', 'JUD', '#7B7D7D']
      ];
      for (const [name, short, color] of defaults) {
        await db.execute('INSERT INTO departments (name, short_name, color) VALUES (?, ?, ?)', [name, short, color]);
      }
    }
  })
  .catch(err => console.error('MySQL connection failed:', err.message));

function translit(str) {
  const map = { 'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ts':'ts','ch':'ch','sh':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','yu':'yu','ya':'ya' };
  return str.toLowerCase().split('').map(c => map[c] || c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseTemplate(template, answers, fields) {
  if (!template) return null;
  let result = template;
  
  // Replace field placeholders: {0}, {1}, etc.
  fields.forEach((f, i) => {
    const value = answers[`field_${i}`] || '';
    result = result.replace(new RegExp(`\\{${i}\\}`, 'g'), value);
  });
  
  // Replace field name placeholders: {name0}, {name1}, etc.
  fields.forEach((f, i) => {
    result = result.replace(new RegExp(`\\{name${i}\\}`, 'g'), f.label);
  });
  
  // Parse Discord mentions: role[ID], channel[ID], user[ID]
  result = result.replace(/role\[(\d+)\]/g, '<@&$1>');
  result = result.replace(/channel\[(\d+)\]/g, '<#$1>');
  result = result.replace(/user\[(\d+)\]/g, '<@$1>');
  
  // Parse links: (text)[URL] - text in (), URL in []
  result = result.replace(/\(([^)]+)\)\[(https?:\/\/[^\]]+)\]/g, '[$1]($2)');
  
  return result;
}

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
  if (!['user', 'deputy_leader', 'leader', 'developer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
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

app.put('/api/departments/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  const [caller] = await db.execute('SELECT role FROM users WHERE discord_id = ?', [req.session.user.id]);
  if (!caller.length || caller[0].role !== 'developer') return res.status(403).json({ error: 'Forbidden' });
  const { name, short_name, color } = req.body;
  if (!name || !short_name) return res.status(400).json({ error: 'Name and short_name required' });
  try {
    await db.execute('UPDATE departments SET name = ?, short_name = ?, color = ? WHERE id = ?', [name, short_name, color || '#5865F2', req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id/deputy', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  const [caller] = await db.execute('SELECT role, department_id FROM users WHERE discord_id = ?', [req.session.user.id]);
  if (!caller.length) return res.status(403).json({ error: 'Forbidden' });
  const [target] = await db.execute('SELECT department_id, role FROM users WHERE id = ?', [req.params.id]);
  if (!target.length) return res.status(404).json({ error: 'User not found' });
  const isDeveloper = caller[0].role === 'developer';
  const isLeader = caller[0].role === 'leader';
  if (!isDeveloper && !isLeader) return res.status(403).json({ error: 'Forbidden' });
  const { action } = req.body;
  if (action === 'assign') {
    const deptId = caller[0].department_id;
    await db.execute('UPDATE users SET role = ?, department_id = ? WHERE id = ?', ['deputy_leader', deptId, req.params.id]);
  } else if (action === 'remove') {
    await db.execute('UPDATE users SET role = ?, department_id = NULL WHERE id = ?', ['user', req.params.id]);
  }
  res.json({ success: true });
});

app.get('/api/forms', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const [caller] = await db.execute('SELECT role, department_id FROM users WHERE discord_id = ?', [req.session.user.id]);
    if (!caller.length) return res.status(403).json({ error: 'Forbidden' });
    let query = `SELECT f.*, d.name as department_name, d.short_name as department_short, d.color as department_color,
      (SELECT COUNT(*) FROM form_responses WHERE form_id = f.id) as response_count
      FROM forms f JOIN departments d ON f.department_id = d.id`;
    let params = [];
    if (!['leader', 'deputy_leader', 'developer'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (caller[0].role !== 'developer') {
      query += ' WHERE f.department_id = ?';
      params.push(caller[0].department_id);
    }
    query += ' ORDER BY f.created_at DESC';
    const [rows] = await db.execute(query, params);
    for (const row of rows) {
      if (!row.slug) {
        const slug = translit(row.name);
        await db.execute('UPDATE forms SET slug = ? WHERE id = ?', [slug, row.id]);
        row.slug = slug;
      }
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/forms', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const [caller] = await db.execute('SELECT id, role, department_id FROM users WHERE discord_id = ?', [req.session.user.id]);
    if (!caller.length || !['leader', 'deputy_leader', 'developer'].includes(caller[0].role)) return res.status(403).json({ error: 'Forbidden' });
    const { name, webhook_url, slug, message_template, embed_color, fields } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const deptId = caller[0].role === 'developer' ? (req.body.department_id || caller[0].department_id) : caller[0].department_id;
    if (!deptId) return res.status(400).json({ error: 'Department required' });
    const formSlug = slug || translit(name);
    const colorHex = embed_color || '#5865F2';
    const colorInt = parseInt(colorHex.replace('#', ''), 16);
    const [result] = await db.execute('INSERT INTO forms (department_id, name, webhook_url, slug, message_template, embed_color, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [deptId, name, webhook_url ? encrypt(webhook_url) : null, formSlug, message_template || null, colorHex, caller[0].id]);
    const formId = result.insertId;
    if (fields && fields.length) {
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        await db.execute('INSERT INTO form_fields (form_id, label, type, options, required, order_index) VALUES (?, ?, ?, ?, ?, ?)',
          [formId, f.label, f.type, f.options ? JSON.stringify(f.options) : null, f.required ? 1 : 0, i]);
      }
    }
    res.json({ success: true, id: formId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/forms/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const [form] = await db.execute(`SELECT f.*, d.name as department_name, d.short_name as department_short, d.color as department_color
      FROM forms f JOIN departments d ON f.department_id = d.id WHERE f.id = ?`, [req.params.id]);
    if (!form.length) return res.status(404).json({ error: 'Not found' });
    const [fields] = await db.execute('SELECT * FROM form_fields WHERE form_id = ? ORDER BY order_index', [req.params.id]);
    const result = { ...form[0], fields };
    if (result.webhook_url) result.webhook_url = decrypt(result.webhook_url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/forms/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const [caller] = await db.execute('SELECT id, role, department_id FROM users WHERE discord_id = ?', [req.session.user.id]);
    if (!caller.length || !['leader', 'deputy_leader', 'developer'].includes(caller[0].role)) return res.status(403).json({ error: 'Forbidden' });
    const [form] = await db.execute('SELECT * FROM forms WHERE id = ?', [req.params.id]);
    if (!form.length) return res.status(404).json({ error: 'Not found' });
    if (caller[0].role !== 'developer' && form[0].department_id !== caller[0].department_id) return res.status(403).json({ error: 'Forbidden' });
    const { name, webhook_url, slug, message_template, embed_color, fields } = req.body;
    const formSlug = slug || (name ? translit(name) : form[0].slug);
    const encryptedWebhook = webhook_url !== undefined ? (webhook_url ? encrypt(webhook_url) : null) : form[0].webhook_url;
    const templateValue = message_template !== undefined ? (message_template || null) : form[0].message_template;
    const colorValue = embed_color !== undefined ? embed_color : (form[0].embed_color || '#5865F2');
    await db.execute('UPDATE forms SET name = ?, webhook_url = ?, slug = ?, message_template = ?, embed_color = ? WHERE id = ?', [name || form[0].name, encryptedWebhook, formSlug, templateValue, colorValue, req.params.id]);
    if (fields) {
      await db.execute('DELETE FROM form_fields WHERE form_id = ?', [req.params.id]);
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        await db.execute('INSERT INTO form_fields (form_id, label, type, options, required, order_index) VALUES (?, ?, ?, ?, ?, ?)',
          [req.params.id, f.label, f.type, f.options ? JSON.stringify(f.options) : null, f.required ? 1 : 0, i]);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/forms/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const [caller] = await db.execute('SELECT role, department_id FROM users WHERE discord_id = ?', [req.session.user.id]);
    if (!caller.length || !['leader', 'developer'].includes(caller[0].role)) return res.status(403).json({ error: 'Forbidden' });
    const [form] = await db.execute('SELECT * FROM forms WHERE id = ?', [req.params.id]);
    if (!form.length) return res.status(404).json({ error: 'Not found' });
    if (caller[0].role !== 'developer' && form[0].department_id !== caller[0].department_id) return res.status(403).json({ error: 'Forbidden' });
    await db.execute('DELETE FROM forms WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/forms/view/:deptSlug/:formSlug', async (req, res) => {
  try {
    const [dept] = await db.execute('SELECT * FROM departments WHERE short_name = ?', [req.params.deptSlug]);
    if (!dept.length) return res.status(404).json({ error: 'Department not found' });
    const [form] = await db.execute(`SELECT f.*, d.name as department_name, d.short_name as department_short, d.color as department_color
      FROM forms f JOIN departments d ON f.department_id = d.id WHERE f.department_id = ? AND f.slug = ?`, [dept[0].id, req.params.formSlug]);
    if (!form.length) return res.status(404).json({ error: 'Form not found' });
    const [fields] = await db.execute('SELECT * FROM form_fields WHERE form_id = ? ORDER BY order_index', [form[0].id]);
    res.json({ ...form[0], fields });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/forms/:id/submit', async (req, res) => {
  try {
    const { answers } = req.body;
    if (!answers) return res.status(400).json({ error: 'Answers required' });
    const [form] = await db.execute('SELECT * FROM forms WHERE id = ?', [req.params.id]);
    if (!form.length) return res.status(404).json({ error: 'Form not found' });
    const userId = req.session.user ? (await db.execute('SELECT id FROM users WHERE discord_id = ?', [req.session.user.id]))[0][0]?.id : null;
    await db.execute('INSERT INTO form_responses (form_id, user_id, answers) VALUES (?, ?, ?)',
      [req.params.id, userId, JSON.stringify(answers)]);
    if (form[0].webhook_url) {
      try {
        const webhookUrl = decrypt(form[0].webhook_url);
        const [fields] = await db.execute('SELECT * FROM form_fields WHERE form_id = ? ORDER BY order_index', [req.params.id]);
        
        const truncate = (str, len) => str && str.length > len ? str.slice(0, len - 3) + '...' : str;
        const embedTitle = truncate(form[0].name, 256);
        const embedColor = parseInt((form[0].embed_color || '#5865F2').replace('#', ''), 16);
        const embeds = [];
        let currentEmbed = { title: embedTitle, color: embedColor, fields: [] };
        let totalChars = embedTitle.length;
        let fieldCount = 0;

        function formatFieldValue(value, type) {
          if (!value || value === '—') return '—';
          if (type === 'date') {
            const parts = value.split('-');
            if (parts.length === 3 && parts[0].length === 4) {
              return `${parts[2]}.${parts[1]}.${parts[0]}`;
            }
            return value;
          }
          if (type === 'datetime') {
            const [datePart, timePart] = value.split('T');
            if (datePart && timePart) {
              const dParts = datePart.split('-');
              if (dParts.length === 3 && dParts[0].length === 4) {
                return `${dParts[2]}.${dParts[1]}.${dParts[0]} ${timePart}`;
              }
            }
            return value;
          }
          return value;
        }

        for (let i = 0; i < fields.length; i++) {
          const fieldName = truncate(fields[i].label, 256);
          const rawValue = answers[`field_${i}`] || '';
          const formattedValue = formatFieldValue(rawValue, fields[i].type);
          const fieldValue = truncate('• ' + (formattedValue || '—'), 1024);
          const fieldChars = fieldName.length + fieldValue.length;

          if (fieldCount >= 25 || totalChars + fieldChars > 5900) {
            embeds.push(currentEmbed);
            if (embeds.length >= 10) break;
            currentEmbed = { title: embedTitle, color: embedColor, fields: [] };
            totalChars = embedTitle.length;
            fieldCount = 0;
          }

          currentEmbed.fields.push({ name: fieldName, value: fieldValue, inline: false });
          totalChars += fieldChars;
          fieldCount++;
        }

        if (currentEmbed.fields.length > 0 && embeds.length < 10) {
          embeds.push(currentEmbed);
        }

        const content = parseTemplate(form[0].message_template, answers, fields);
        const body = { embeds };
        if (content) body.content = content.slice(0, 2000);

        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      } catch (e) { console.error('Webhook error:', e); }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/department', (req, res) => {
  res.sendFile(path.join(__dirname, 'main', 'department.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'main', 'admin.html'));
});

app.get('/:deptSlug/:formSlug', (req, res) => {
  res.sendFile(path.join(__dirname, 'main', 'form-view.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'main', 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
