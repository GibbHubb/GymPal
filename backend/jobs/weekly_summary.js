const cron = require('node-cron');
const db = require('../models/db');
const { getWeeklySummary } = require('../services/summary_service');
const emailService = require('../services/email_service');

// Initialise email transporter
emailService.init();

// Every Monday at 08:00 server time
cron.schedule('0 8 * * 1', async () => {
  console.log('📧 Running weekly summary cron...');

  try {
    const { rows: clients } = await db.query(
      `SELECT user_id, username, email, full_name
       FROM users
       WHERE role = 'client' AND email IS NOT NULL`
    );

    console.log(`  Found ${clients.length} client(s) with email.`);

    for (const client of clients) {
      try {
        const stats = await getWeeklySummary(client.user_id);
        await emailService.sendWeeklySummary(client, stats);
      } catch (err) {
        console.error(`  ❌ Error for user ${client.user_id}:`, err.message);
      }
    }

    console.log('📧 Weekly summary cron complete.');
  } catch (err) {
    console.error('❌ Weekly summary cron failed:', err.message);
  }
});

console.log('⏰ Weekly summary cron registered (Monday 08:00).');
