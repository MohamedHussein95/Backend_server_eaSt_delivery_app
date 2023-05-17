import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import { User } from '../models/UserModel.js';
import dotenv from 'dotenv';
dotenv.config();

// Middleware to protect routes and validate JWT token
const protect = asyncHandler(async (req, res, next) => {
	let token = req.cookies.jwt;

	if (!token) {
		// If token is not present, user is not authorized
		res.status(401);
		throw new Error('Not authorized, no token!');
	}

	try {
		// Verify the JWT token
		const decoded = jwt.verify(token, process.env.JWT_SECRET);

		// Find the user based on the decoded user ID
		req.user = await User.findById(decoded.userId).select(
			'-password -cloudinary_id -verificationToken -resetCode -__v -backupCodes'
		);

		next();
	} catch (error) {
		// If token is invalid or expired, user is not authorized
		res.status(401);
		throw new Error('Not authorized, invalid token!');
	}
});

export { protect };
