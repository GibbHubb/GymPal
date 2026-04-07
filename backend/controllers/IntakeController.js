const db = require('../models/db');

// Fetch Intake Data for a Specific User
const getIntakeData = async (req, res) => {
  const { user_id } = req.params;

  if (isNaN(user_id)) {
    return res.status(400).json({ message: 'Invalid user ID: ID must be a number.' });
  }

  try {
    const { rows } = await db.query(
      `
      SELECT * 
      FROM Intake 
      WHERE user_id = $1;  -- ✅ Fixed: Using user_id instead of id
      `,
      [user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No intake data found for this user.' });
    }

    res.status(200).json(rows[0]); // ✅ Return single object instead of array
  } catch (err) {
    console.error('Error fetching intake data:', err.message);
    res.status(500).json({
      message: 'An error occurred while fetching intake data.',
      details: err.message,
    });
  }
};

// Add New Intake Data
const addIntakeData = async (req, res) => {
  const {
    client_name, sex, age, fat_percentage, height_cm, weight_category,
    bmi, ffmi, athleticism_score, movement_shoulder, movement_hips,
    movement_ankles, movement_thoracic, genetics
  } = req.body;
  const user_id = req.user.id; // Ensure authenticated user

  if (!user_id || !client_name || !sex || !age) {
    return res.status(400).json({ message: 'User ID, client name, sex, and age are required.' });
  }

  try {
    // Check if intake data already exists
    const existing = await db.query(`SELECT * FROM Intake WHERE user_id = $1;`, [user_id]);

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Intake data already exists for this user.' });
    }

    // Insert intake data
    const { rows } = await db.query(
      `INSERT INTO Intake (
        user_id, client_name, sex, age, fat_percentage, height_cm, weight_category, bmi, ffmi, 
        athleticism_score, movement_shoulder, movement_hips, movement_ankles, movement_thoracic, genetics
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *;`,
      [
        user_id, client_name, sex, age, fat_percentage, height_cm, weight_category, bmi, ffmi,
        athleticism_score, movement_shoulder, movement_hips, movement_ankles, movement_thoracic, genetics
      ]
    );

    res.status(201).json({ message: 'Intake data added successfully', data: rows[0] });
  } catch (err) {
    console.error('Error adding intake data:', err.message);
    res.status(500).json({ message: 'Internal Server Error', details: err.message });
  }
};

module.exports = { getIntakeData, addIntakeData };
