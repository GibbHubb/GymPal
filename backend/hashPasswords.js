const bcrypt = require('bcrypt');
const { Pool } = require('pg'); // PostgreSQL client

// Configure your PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:12qwaszx@localhost:5432/fitness_app_db',
});

const hashPasswords = async () => {
    try {
        // Fetch all users and their current passwords
        const { rows: users } = await pool.query('SELECT user_id, password FROM Users');

        for (const user of users) {
            const hashedPassword = await bcrypt.hash(user.password, 10); // Hash the plain text password

            // Update the user record with the hashed password
            await pool.query('UPDATE Users SET password = $1 WHERE user_id = $2', [
                hashedPassword,
                user.user_id,
            ]);

            console.log(`Password for user ${user.user_id} has been hashed.`);
        }

        console.log('All passwords have been updated successfully.');
    } catch (err) {
        console.error('Error hashing passwords:', err.message);
    } finally {
        await pool.end(); // Close the database connection
    }
};

// Run the hashing process
hashPasswords();
