require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306,
  });

  const [rows] = await db.execute('SELECT NOW() as mysql_time, @@global.time_zone as global_tz, @@session.time_zone as session_tz');
  console.log('MySQL time info:', rows[0]);

  const [last] = await db.execute('SELECT submitted_at FROM form_responses ORDER BY submitted_at DESC LIMIT 1');
  console.log('Last submission:', last[0]);

  await db.end();
})();
