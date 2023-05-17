import jwt from 'jsonwebtoken';

// Function to generate a JWT token and set it as a cookie in the response
const generateToken = (res, userId) => {
	// Retrieve the JWT_SECRET and NODE_ENV values from the environment variables
	const { JWT_SECRET, NODE_ENV } = process.env;

	// Generate the JWT token with the provided userId and JWT_SECRET
	const token = jwt.sign({ userId }, JWT_SECRET, {
		expiresIn: '30d',
	});

	// Set the JWT token as a cookie in the response
	res.cookie('jwt', token, {
		httpOnly: true,
		secure: NODE_ENV !== 'development',
		sameSite: 'strict',
		maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
	});
};

export default generateToken;
