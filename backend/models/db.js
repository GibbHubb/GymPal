const { Pool } = require('pg'); // Import Pool from the pg package
require('dotenv').config(); // Load environment variables

// Create a new pool instance using the DATABASE_URL from the environment variables
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Export a query method to handle database interactions
module.exports = {
    query: async (text, params) => {
        try {
            const res = await pool.query(text, params); // Execute the query
            return res; // Return the query result
        } catch (err) {
            console.error('Database query error:', err.message); // Log detailed error
            throw err; // Re-throw error for higher-level handling
        }
    },
};
 