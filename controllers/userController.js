import { config } from 'dotenv';
config();

import { validationResult } from 'express-validator';
import { User } from '../models/UserModel.js';
import asyncHandler from 'express-async-handler';
import generateToken from '../utils/generateToken.js';
import gravatar from 'gravatar';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import nodemailer from 'nodemailer';
import {
	sendVerificationEmail,
	generateBackupCodes,
} from '../helpers/helper.js';
import cloudinaryConfig from '../utils/cloudinary.js';
cloudinaryConfig();

// Register a new user
const registerUser = asyncHandler(async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		res.status(400);
		throw new Error(errors.array());
	}

	const { firstName, lastName, email, phoneNumber, password } = req.body;

	// Check if user with the same email or phone number already exists
	const userExists = await User.findOne({ $or: [{ email }, { phoneNumber }] });
	if (userExists) {
		res.status(400);
		throw new Error('Email or phone number is already taken!');
	}

	// Generate backup codes and avatar using gravatar
	const backupCodes = generateBackupCodes();
	const avatar = gravatar.url(email, { s: '200', r: 'pg', d: 'mm' });

	// Create the user
	const user = await User.create({
		firstName,
		lastName,
		fullName: `${firstName} ${lastName}`,
		email,
		phoneNumber,
		password,
		avatar,
		backupCodes,
	});

	// Generate and set JWT token in response header
	generateToken(res, user._id);

	// Exclude sensitive data from the response
	const { password: _, __v, backupCodes: c, ...rest } = user._doc;

	// Send verification email to the user
	const title = 'Welcome to eaSt';
	const message =
		'If you did not create an account with eaSt, please ignore this email';
	await sendVerificationEmail(user.email, title, message);

	console.log('reached here');

	// Return the user data in the response
	res.status(200).json(rest);
});

// Login user
const loginUser = asyncHandler(async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		res.status(400);
		throw new Error(errors.array());
	}

	const { email, password } = req.body;

	// Find user by email
	const user = await User.findOne({ email });

	// Check if user exists and the password is correct
	if (user && (await user.comparePasswords(password))) {
		// Generate and set JWT token in response header
		generateToken(res, user._id);

		// Exclude sensitive data from the response
		const {
			password: _,
			cloudinary_id,
			verificationToken,
			resetCode,
			__v,
			backupCodes,
			...rest
		} = user._doc;

		// Return the user data in the response
		res.status(200).json(rest);
	} else {
		res.status(401);
		throw new Error('Invalid email or password!');
	}
});

// Get user profile
const getUserProfile = asyncHandler(async (req, res) => {
	if (req.user.id !== req.params.id) {
		res.status(401);
		throw new Error('Not Authorized!');
	}

	// Return the user data in the response
	res.status(200).json(req.user);
});

// Forgot password
const forgotPassword = asyncHandler(async (req, res) => {
	const { email } = req.body;

	// Find user by email
	const user = await User.findOne({ email });

	if (!user) {
		res.status(404);
		throw new Error('User not found!');
	}

	// Generate reset code
	const resetCode = nanoid(6);

	// Set the reset code and save the user
	user.resetCode = resetCode;
	await user.save();

	// Send reset password email to the user
	const title = 'Reset Password';
	const message = `To reset your password, use the following code: ${resetCode}`;
	await sendVerificationEmail(user.email, title, message);

	// Return success message
	res.status(200).json({ message: 'Reset code sent to your email' });
});

// Reset password
const resetPassword = asyncHandler(async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		res.status(400);
		throw new Error(errors.array());
	}

	const { email, password, resetCode } = req.body;

	// Find user based on email and resetCode
	const user = await User.findOne({ email, resetCode });
	if (!user) {
		res.status(400);
		throw new Error('Email or reset code is invalid!');
	}

	// Set the new password and reset the resetCode
	user.password = password;
	user.resetCode = null;
	await user.save();

	// Return success message
	res.json({ message: 'Password reset successfully' });
});

// Download user data
const downloadUserData = asyncHandler(async (req, res) => {
	if (req.params.id !== req.user.id) {
		res.status(401);
		throw new Error('Not Authorized!');
	}

	const user = await User.findById(req.params.id);
	if (!user) {
		res.status(404);
		throw new Error('No User found');
	}

	const fileName = user.email;

	// Convert the user's information to a text file
	const textData = JSON.stringify(user);

	// Set the response headers to indicate that we are sending a file
	res.setHeader('Content-disposition', `attachment; filename=${fileName}.txt`);
	res.set('Content-Type', 'text/plain');

	// Send the file to the client
	res.send(textData);
});

// Logout user
const logOutUser = asyncHandler(async (req, res) => {
	if (req.params.id !== req.user.id) {
		res.status(401);
		throw new Error('Not Authorized!');
	}

	// Clear the JWT token cookie
	res.cookie('jwt', '', {
		httpOnly: true,
		expires: new Date(0),
	});

	// Return success message
	res.status(200).json({ message: 'User logged out' });
});

// Delete user
const deleteUser = asyncHandler(async (req, res) => {
	if (req.params.id !== req.user.id) {
		res.status(401);
		throw new Error('Not Authorized!');
	}

	if (req.user.cloudinary_id) {
		// Delete image from cloudinary
		await cloudinaryConfig.uploader.destroy(req.user.cloudinary_id);
	}

	// Delete user from db
	await User.deleteOne({ _id: req.params.id });

	// Clear cookies
	res.cookie('jwt', '', {
		httpOnly: true,
		expires: new Date(0),
	});

	// Return the deleted user ID
	res.json({ id: req.params.id });
});

// Update user
const updateUser = asyncHandler(
	async (
		req,

		res
	) => {
		const { firstName, lastName, email, password } = req.body;

		if (req.params.id !== req.user.id) {
			res.status(401);
			throw new Error('Not Authorized!');
		}

		const user = await User.findById(req.user.id);
		if (!user) {
			res.status(404);
			throw new Error('User not found!');
		}

		user.firstName = firstName || user.firstName;
		user.lastName = lastName || user.lastName;
		user.fullName = `${firstName || user.firstName} ${
			lastName || user.lastName || ''
		}`;
		user.phoneNumber = req.body.phoneNumber || user.phoneNumber;

		if (email) {
			user.email = email;
			const title = 'Email Address Update';
			const message = `If this isn't you,<a href="${process.env.HOST}/api/users/update_password/${req.user.id}" >click here to change your password.</a>`;

			await sendVerificationEmail(email, title, message);
		}
		if (password) {
			user.password = password;
		}
		const updatedUser = await user.save();
		const {
			password: p,
			cloudinary_id,
			verificationToken,
			resetCode,
			__v,
			backupCodes,
			...rest
		} = updatedUser._doc;
		res.status(200).json(rest);
	}
);
const updatePassword = asyncHandler(async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		res.status(400);
		throw new Error(errors.array());
	}
	if (req.params.id !== req.user.id) {
		res.status(401);
		throw new Error('Not Authorized!');
	}
	const user = await User.findById(req.user.id);
	if (!user) {
		res.status(404);
		throw new Error('User not found!');
	}
	// Get the updated user information from the request body
	const { password, new_password } = req.body;
	//check if old pass is correct
	if (!(await user.comparePasswords(password))) {
		res.status(400);
		throw new Error('Invalid Credentials');
	}

	user.password = new_password;
	// Save the updated user information to the database
	await user.save();
	// Return the updated user information
	const {
		password: p,
		cloudinary_id,
		verificationToken,
		resetCode,
		__v,
		backupCodes,
		...rest
	} = user._doc;
	res.status(200).json(rest);
});
const uploadProfile = asyncHandler(async (req, res) => {
	if (req.params.id !== req.user.id) {
		res.status(401);
		throw new Error('Not Authorized!');
	}
	// Find the user by ID
	const user = await User.findById(req.user.id);
	if (!user) {
		res.status(404);
		throw new Error('No User found');
	}

	if (user.cloudinary_id) {
		// Delete image from cloudinary
		await cloudinaryConfig.uploader.destroy(user.cloudinary_id);
	}
	// Upload image to cloudinary
	const result = await cloudinary.v2.uploader.upload(req.file.path, {
		folder: 'uploaded/profile_photos',
		resource_type: 'auto',
	});

	// update user
	user.cloudinary_id = result.public_id;
	user.avatar = result.secure_url;

	// Save the updated user information to the database
	await user.save();
	// Return the updated user information
	const {
		password,
		cloudinary_id,
		verificationToken,
		resetCode,
		__v,
		backupCodes,
		...rest
	} = user._doc;
	return res.json(rest);
});
const verifyEmail = asyncHandler(async (req, res) => {
	const { token } = req.params;
	const verifiedToken = await jwt.verify(token, process.env.JWT_SECRET);
	const { secret } = await verifiedToken;
	const user = await User.findOne({ verificationToken: secret });
	if (!user) {
		res.status(400);
		throw new Error('Invalid token');
	}
	user.emailVerified = true;
	user.verificationToken = null;
	await user.save();
	return res.status(200).json({ msg: 'Email verified successfully' });
});
const requestEmailVerification = asyncHandler(async (req, res) => {
	if (req.params.id !== req.user.id) {
		res.status(401);
		throw new Error('Not Authorized!');
	}
	if (req.user.emailVerified) {
		res.status(400);
		throw new Error('Email already verified');
	}
	const title = 'You requested for Verification';
	const message = `If you did not requested for verification,<a href="${process.env.HOST}/api/users/update_password/${req.user.id}" >click here to change your password.</a>`;
	await sendVerificationEmail(req.user.email, title, message);
	res.json({ msg: 'Verification email sent' });
});
{
	/* const downloadProfile = async (req, res) => {
	try {
		const user = await User.findById(req.params.id);

		if (!user || !user.cloudinary_id) {
			return res.status(404).json({ errors: [{ msg: 'No user found' }] });
		}

		try {
			const secure_url = await cloudinary.api.resource(user.cloudinary_id, {
				type: 'fetch',
			});

			const response = await axios.get(secure_url, {
				responseType: 'arraybuffer',
			});

			res.writeHead(200, {
				'Content-Type': 'image/jpeg',
				'Content-Length': response.data.length,
			});

			res.end(response.data);
		} catch (error) {
			console.log(error);
			res.status(404).json({
				errors: [{ msg: `Failed to Download ${error.message}` }],
			});
		}
	} catch (error) {
		if (error.kind === 'ObjectId') {
			return res.status(404).json({ errors: [{ msg: 'No User found' }] });
		}
		res.status(500).json({
			errors: [{ msg: `internal server error ${error.message}` }],
		});
	}
}; */
}

export {
	registerUser,
	loginUser,
	getUserProfile,
	forgotPassword,
	resetPassword,
	downloadUserData,
	deleteUser,
	updateUser,
	updatePassword,
	uploadProfile,
	verifyEmail,
	requestEmailVerification,
	logOutUser,
};
