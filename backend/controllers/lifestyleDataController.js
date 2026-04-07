const db = require('../models/db');


// Fetch the last 3 Lifestyle Data entries for a Specific User
const getLifestyleData = async (req, res) => {
  const { user_id } = req.params;

  if (isNaN(user_id)) {
    return res.status(400).json({ message: 'Invalid user ID: ID must be a number.' });
  }

  try {
    const { rows } = await db.query(
      `
      SELECT lifestyle_id, user_id, date, stress, sleep, soreness, calories, weight, notes_to_trainer
      FROM Lifestyle_Data 
      WHERE user_id = $1 
      ORDER BY date DESC
      LIMIT 3
      `,
      [user_id]
    );

    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching lifestyle data:', err.message);
    res.status(500).json({
      message: 'An error occurred while fetching lifestyle data.',
      details: err.message,
    });
  }
};


// Add New Lifestyle Data
const addLifestyleData = async (req, res) => {
  const { user_id } = req.user; // Make sure `user_id` is extracted from the decoded token
  const { stress, sleep, soreness, calories, weight } = req.body;

  if (!user_id) {
    return res.status(400).json({ message: 'User ID is required and was not provided' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO Lifestyle_Data (user_id, stress, sleep, soreness, calories, weight, date)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *;`,
      [user_id, stress, sleep, soreness, calories, weight]
    );
    res.status(201).json({ message: 'Lifestyle data added successfully', data: rows[0] });
  } catch (err) {
    console.error('Error adding lifestyle data:', err.message);
    res.status(500).json({ message: 'Internal Server Error', details: err.message });
  }
};

  

module.exports = { getLifestyleData, addLifestyleData };
