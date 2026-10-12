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

  console.log(`Connected to: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  
  const [rows] = await db.execute(`
    SELECT id, form_id, submitted_at, 
    CONVERT_TZ(submitted_at, '+00:00', '+03:00') as msk_time
    FROM form_responses 
    ORDER BY submitted_at DESC 
    LIMIT 10
  `);
  
  console.log('\nLast 10 submissions:');
  rows.forEach(r => {
    console.log(`ID: ${r.id}, Form: ${r.form_id}, UTC: ${r.submitted_at.toISOString()}, MSK: ${r.msk_time}`);
  });

  await db.end();
})();
