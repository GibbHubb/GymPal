const db = require('../models/db');

const getTemplates = async (req, res) => {
  const trainerId = req.user.user_id;
  try {
    const { rows } = await db.query(
      'SELECT * FROM workout_templates WHERE trainer_id = $1 ORDER BY created_at DESC',
      [trainerId]
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching templates:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const createTemplate = async (req, res) => {
  const trainerId = req.user.user_id;
  const { name, exercises } = req.body;

  if (!name || !Array.isArray(exercises) || exercises.length === 0) {
    return res.status(400).json({ message: 'Name and exercises array are required.' });
  }

  try {
    const { rows } = await db.query(
      'INSERT INTO workout_templates (trainer_id, name, exercises) VALUES ($1, $2, $3) RETURNING *',
      [trainerId, name, JSON.stringify(exercises)]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating template:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteTemplate = async (req, res) => {
  const trainerId = req.user.user_id;
  const { id } = req.params;

  try {
    const { rowCount } = await db.query(
      'DELETE FROM workout_templates WHERE id = $1 AND trainer_id = $2',
      [id, trainerId]
    );
    if (rowCount === 0) {
      return res.status(404).json({ message: 'Template not found or not owned by you.' });
    }
    res.status(200).json({ message: 'Template deleted.' });
  } catch (err) {
    console.error('Error deleting template:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { getTemplates, createTemplate, deleteTemplate };
