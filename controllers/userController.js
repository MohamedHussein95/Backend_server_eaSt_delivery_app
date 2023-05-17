import cloudinary from 'cloudinary';
import { config } from 'dotenv';
import asyncHandler from 'express-async-handler';
import { validationResult } from 'express-validator';
import gravatar from 'gravatar';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import nodemailer from 'nodemailer';
import {
	generateBackupCodes,
	sendVerificationEmail,
} from '../helpers/helper.js';
import { User } from '../models/UserModel.js';
import cloudinaryConfig from '../utils/cloudinary.js';
import generateToken from '../utils/generateToken.js';
config();
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
	const { password: _, __v, backupCodes: c, resetCode, ...rest } = user._doc;

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
	// Check if the request user ID matches the target user ID
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
	// create reusable transporter object using the default SMTP transport
	let transporter = nodemailer.createTransport({
		host: 'smtp.gmail.com',
		port: 465,
		secure: true, // true for 465, false for other ports
		auth: {
			user: process.env.SENDER_EMAIL,
			pass: process.env.SENDER_PASSWORD,
		},
	});

	// Generate reset code
	const resetCode = nanoid(6);

	// Set the expiration date for the reset code (e.g., 1 hour from now)
	const expiration = new Date();
	expiration.setHours(expiration.getHours() + 1);

	// Store the reset code and its expiration date in the user document
	user.resetCode = {
		code: resetCode,
		expiration,
	};
	await user.save();

	// prepare email and Send reset password email to the user
	await transporter.sendMail({
		from: `"eaSt 🍟🍖" ${process.env.SENDER_EMAIL}`,
		to: email,
		subject: 'Your eaSt Password Reset Code',
		html: `   <html>
   
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your eaSt Password Reset Code</title>
        <style>
            /* Add your own CSS styles here */
            body {
                font-family: Arial, sans-serif;
                background-color: #f0f0f0;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #F6F6F6;
                padding: 20px;
                border-radius: 10px;
            }
            .logo {
                display: block;
                margin: 0 auto;
                width: 100px;
                height: 100px;
            }
            .logoText {
                display: block;
                margin: 0 auto;
                font-size: 72px;
                font-weight: bold;
                color: #F05600;
                text-align: center;
                text-shadow: 2px 2px #F05600;
            }
            .reset-code {
                font-size: 36px;
                font-weight: bold;
                color:#ff0000;
                text-align: center;
            }
            .instructions {
                font-size: 16px;
                line-height: 1.5;
                color: #333333;
            }
        </style>
    </head>
    <body>
        <div class="container">        
            <h1>Forgot Password</h1>
            <p class="instructions">You have requested to reset your password for your eaSt account. Please use the following code to verify your identity and create a new password:</p>
            <p class="reset-code">${resetCode}</p>
            <p class="instructions">If you did not request a password reset, please ignore this email or contact our support team if you have any questions.</p>
        </div>
    </body>
    </html>`,
	});

	// Return success message
	res.status(200).json({
		message: 'Reset code sent to your email',
	});
});

// Reset password
const resetPassword = asyncHandler(async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		res.status(400);
		throw new Error(errors.array());
	}

	const { email, new_password } = req.body;

	// Find user based on email
	const user = await User.findOne({ email });
	if (!user) {
		res.status(400);
		throw new Error('No user found!');
	}

	// Set the new password and reset the resetCode
	user.password = new_password;
	user.resetCode = null;
	await user.save();

	// Return success message
	res.json({ message: 'Password reset successfully' });
});
const validateResetCode = asyncHandler(async (req, res) => {
	const { resetCode, email } = req.body;

	// Find the user based on the email
	const user = await User.findOne({ email });
	if (!user) {
		res.status(400);
		throw new Error('Email is invalid!');
	}

	// Check if the reset code matches the one associated with the user
	if (user.resetCode.code !== resetCode) {
		res.status(400);
		throw new Error('Reset code is invalid!');
	}

	// Check if the reset code has expired
	const resetCodeExpiration = user.resetCode.expiration;
	if (resetCodeExpiration && resetCodeExpiration < Date.now()) {
		res.status(400);
		throw new Error('Reset code has expired!');
	}
	// Return success message
	res.status(200).json({
		message: 'Reset Code is validated ',
	});
});

// Download user data
const downloadUserData = asyncHandler(async (req, res) => {
	// Check if the request user ID matches the target user ID
	if (req.params.id !== req.user.id) {
		res.status(401);
		throw new Error('Not Authorized!');
	}

	const user = await User.findById(req.params.id);
	if (!user) {
		res.status(404);
		throw new Error('No user found');
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
	// Check if the request user ID matches the target user ID
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

// Delete a user
const deleteUser = asyncHandler(async (req, res) => {
	// Check if the request user ID matches the target user ID
	if (req.params.id !== req.user.id) {
		res.status(401);
		throw new Error('Not Authorized!');
	}

	// Check if the user has a cloudinary ID
	if (req.user.cloudinary_id) {
		// Delete image from cloudinary
		await cloudinaryConfig.uploader.destroy(req.user.cloudinary_id);
	}

	// Delete the user from the database
	await User.deleteOne({ _id: req.params.id });

	// Clear the JWT cookie
	res.cookie('jwt', '', {
		httpOnly: true,
		expires: new Date(0),
	});

	// Return the deleted user ID
	res.json({ id: req.params.id });
});

// Update user
const updateUser = asyncHandler(async (req, res) => {
	const { firstName, lastName, email, password } = req.body;

	// Check if the request user ID matches the target user ID
	if (req.params.id !== req.user.id) {
		res.status(401);
		throw new Error('Not Authorized!');
	}

	// Find the user by ID
	const user = await User.findById(req.user.id);
	if (!user) {
		res.status(404);
		throw new Error('User not found!');
	}

	// Update user properties with provided values or keep existing values
	user.firstName = firstName || user.firstName;
	user.lastName = lastName || user.lastName;
	user.fullName = `${firstName || user.firstName} ${
		lastName || user.lastName || ''
	}`;
	user.phoneNumber = req.body.phoneNumber || user.phoneNumber;

	// Update email if provided
	if (email) {
		user.email = email;
		user.emailVerified = false;
		const title = 'You updated your Email-Address';
		const message = `If this isn't you,<a href="${process.env.HOST}/api/users/update_password/${req.user.id}" >click here to change your password.</a>`;
		await sendVerificationEmail(email, title, message);
	}

	// Update password if provided
	if (password) {
		user.password = password;
	}

	// Save the updated user to the database
	const updatedUser = await user.save();

	// Exclude sensitive fields from the response
	const {
		password: p,
		cloudinary_id,
		verificationToken,
		resetCode,
		__v,
		backupCodes,
		...rest
	} = updatedUser._doc;

	// Return the updated user information
	res.status(200).json(rest);
});

// Update password
const updatePassword = asyncHandler(async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		res.status(400);
		throw new Error(errors.array());
	}

	// Check if the request user ID matches the target user ID to ensure that the user is authorized to update their own password.
	if (req.params.id !== req.user.id) {
		res.status(401);
		throw new Error('Not Authorized!');
	}

	// Find the user by ID
	const user = await User.findById(req.user.id);
	if (!user) {
		res.status(404);
		throw new Error('User not found!');
	}

	// Get the updated user information from the request body
	const { password, new_password } = req.body;

	// Check if the old password is correct
	if (!(await user.comparePasswords(password))) {
		res.status(400);
		throw new Error('Invalid Credentials');
	}

	// Update the password
	user.password = new_password;

	// Save the updated user information to the database
	await user.save();

	// Exclude sensitive fields from the response
	const {
		password: p,
		cloudinary_id,
		verificationToken,
		resetCode,
		__v,
		backupCodes,
		...rest
	} = user._doc;

	// Return the updated user information
	res.status(200).json(rest);
});
// Upload profile photo
const uploadProfile = asyncHandler(async (req, res) => {
	// Check if the request user ID matches the target user ID to ensure that the user is authorized to upload their profile photo.
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

	// If the user already has a profile photo, delete the previous image from cloudinary
	if (user.cloudinary_id) {
		await cloudinaryConfig.uploader.destroy(user.cloudinary_id);
	}

	// Upload the new image to cloudinary
	const result = await cloudinary.v2.uploader.upload(req.file.path, {
		folder: 'uploaded/profile_photos',
		resource_type: 'auto',
	});

	// Update the user with the new profile photo details
	user.cloudinary_id = result.public_id;
	user.avatar = result.secure_url;

	// Save the updated user information to the database
	await user.save();

	// Exclude sensitive fields from the response
	const {
		password,
		cloudinary_id,
		verificationToken,
		resetCode,
		__v,
		backupCodes,
		...rest
	} = user._doc;

	// Return the updated user information in the response
	return res.json(rest);
});

// Verify Email
const verifyEmail = asyncHandler(async (req, res) => {
	// Extract the token from the request parameters
	const { token } = req.params;

	// Verify the token using JWT and the JWT secret
	const verifiedToken = await jwt.verify(token, process.env.JWT_SECRET);
	const { secret } = await verifiedToken;

	// Find the user with the matching verification token
	const user = await User.findOne({ verificationToken: secret });
	if (!user) {
		res.status(400);
		throw new Error('Invalid token');
	}

	// Mark the user's email as verified and remove the verification token
	user.emailVerified = true;
	user.verificationToken = null;
	await user.save();

	// Return the success message
	return res.status(200).json({ msg: 'Email verified successfully' });
});

// Request Email Verification
const requestEmailVerification = asyncHandler(async (req, res) => {
	// Check if the request user ID matches the target user ID to ensure that the user is authorized to request email verification
	if (req.params.id !== req.user.id) {
		res.status(401);
		throw new Error('Not Authorized!');
	}

	// Check if the user's email is already verified
	if (req.user.emailVerified) {
		res.status(400);
		throw new Error('Email already verified');
	}

	// Create the verification email content
	const title = 'You requested for Verification';
	const message = `If you did not request for verification,<a href="${process.env.HOST}/api/users/update_password/${req.user.id}" >click here to change your password.</a>`;

	// Send the verification email to the user's email address
	await sendVerificationEmail(req.user.email, title, message);

	// Return the success message
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
	validateResetCode,
};
