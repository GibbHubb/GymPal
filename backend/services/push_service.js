/**
 * Expo Push Notification service.
 * Wraps expo-server-sdk to send push messages to client devices.
 * Requires expo_push_token column on the users table — run
 * migrations/add_push_token.sql once before first use.
 */
const { Expo } = require('expo-server-sdk');
const db = require('../models/db');

const expo = new Expo({ useFcmV1: true });

/**
 * Look up the Expo push token for a user and send a notification.
 * Silently skips if the user has no token stored.
 *
 * @param {number|string} userId
 * @param {string} title
 * @param {string} body
 * @param {object} [data]  Extra payload forwarded to the app on tap.
 */
async function sendToUser(userId, title, body, data = {}) {
  try {
    const { rows } = await db.query(
      'SELECT expo_push_token FROM users WHERE user_id = $1',
      [userId],
    );
    const token = rows[0]?.expo_push_token;
    if (!token) return;
    if (!Expo.isExpoPushToken(token)) {
      console.warn(`[push] Invalid Expo push token for user ${userId}: ${token}`);
      return;
    }

    const ticket = await expo.sendPushNotificationsAsync([
      { to: token, title, body, data, sound: 'default' },
    ]);
    console.log(`[push] Sent to user ${userId}:`, ticket[0]?.status ?? 'unknown');
  } catch (err) {
    // Never let push failures break the calling route
    console.error('[push] Error sending notification:', err.message);
  }
}

/**
 * Send to multiple user IDs (e.g. all participants in a workout).
 * Batches into a single Expo request.
 */
async function sendToUsers(userIds, title, body, data = {}) {
  if (!userIds || userIds.length === 0) return;
  try {
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await db.query(
      `SELECT expo_push_token FROM users WHERE user_id IN (${placeholders})`,
      userIds,
    );
    const messages = rows
      .map((r) => r.expo_push_token)
      .filter((t) => t && Expo.isExpoPushToken(t))
      .map((to) => ({ to, title, body, data, sound: 'default' }));

    if (messages.length === 0) return;
    const tickets = await expo.sendPushNotificationsAsync(messages);
    console.log(`[push] Sent ${tickets.length} notifications`);
  } catch (err) {
    console.error('[push] Error sending batch notifications:', err.message);
  }
}

module.exports = { sendToUser, sendToUsers };
