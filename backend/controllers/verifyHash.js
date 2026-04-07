const bcrypt = require('bcrypt');

const verifyHash = async () => {
    const plainTextPassword = 'password123'; // Replace this with the password you're testing
    const hashFromDB = '$2b$10$a8CQp91lpjA3x9eKmOpXFeS7VnT3Oe2p1wvyyiCsRDeU1XYi14Re2'; // Replace with the hash from DB

    const isMatch = await bcrypt.compare(plainTextPassword, hashFromDB);
    console.log(`Password match result: ${isMatch}`);
};

verifyHash();
