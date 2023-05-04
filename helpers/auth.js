const bcrypt = require('bcryptjs');

const hashPassword = async (password) => {
	const salt = 10;
	const hashedPassword = await bcrypt.hash(password, salt);

	return hashedPassword;
};
const comparePasswords = async (password, hashedPassword) => {
	return await bcrypt.compare(password, hashedPassword);
};

module.exports = { hashPassword, comparePasswords };
