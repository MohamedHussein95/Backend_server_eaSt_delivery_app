const { validationResult } = require('express-validator');
const User = require('../models/User');
const {
	hashPassword,
	comparePasswords,
	sendVerificationEmail,
} = require('../helpers/auth');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv').config();
const gravatar = require('gravatar');
const nodemailer = require('nodemailer');
const nanoid = import('nanoid');
const cloudinary = require('../utils/cloudinary');
const axios = require('axios');
const register = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const { name, email, phoneNumber, password } = req.body;

		let user = await User.findOne({ $or: [{ email }, { phoneNumber }] });
		if (user) {
			return res.status(400).json({
				errors: [{ msg: 'Email or phone number is already taken!' }],
			});
		}

		const avatar = gravatar.url(email, { s: '200', r: 'pg', d: 'mm' });
		const hashedPassword = await hashPassword(password);
		user = new User({
			name,
			email,
			phoneNumber,
			password: hashedPassword,
			avatar,
		});
		await user.save();

		const payload = { user: { id: user.id } };
		const token = await jwt.sign(payload, process.env.JWT_SECRET, {
			expiresIn: '7d',
		});
		const { password: _, resetCode, ...rest } = user._doc;
		await sendVerificationEmail(user.email);
		return res.json({ token, user: rest });
	} catch (error) {
		console.error(error);
		res.status(500).send('Server Error');
	}
};

const login = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const { email, password } = req.body;
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(404).json({ errors: [{ msg: 'No user found!' }] });
		}

		const passwordsMatch = await comparePasswords(password, user.password);
		if (!passwordsMatch) {
			return res.status(400).json({ errors: [{ msg: 'Invalid Password' }] });
		}

		const payload = { user: { id: user.id } };
		const token = jwt.sign(payload, process.env.JWT_SECRET, {
			expiresIn: '7d',
		});
		const { password: _, resetCode, ...rest } = user._doc;
		return res.json({ token, user: rest });
	} catch (error) {
		console.error(error);
		res.status(500).send('Server Error');
	}
};
const getUser = async (req, res) => {
	try {
		if (req.params.id !== req.user.id) {
			return res.status(401).json({ errors: [{ msg: 'Not Authorized!' }] });
		}

		let user = await User.findById(req.user.id).select(
			'-password -resetCode'
		);
		res.json(user);
	} catch (error) {
		if (error.kind === 'ObjectId') {
			return res.status(404).json({ errors: [{ msg: 'No User found' }] });
		}
		console.error(error.message);
		res.status(500).send('Server Error');
	}
};
const forgotPassword = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const { email } = req.body;

		let user = await User.findOne({ email });
		if (!user) {
			return res.status(404).json({ errors: [{ msg: 'No user found!' }] });
		}

		try {
			// create reusable transporter object using the default SMTP transport
			let transporter = nodemailer.createTransport({
				host: 'smtp.gmail.com',
				port: 465,
				secure: true, // true for 465, false for other ports
				auth: {
					user: process.env.SENDER_EMAIL, // generated ethereal user
					pass: process.env.SENDER_PASSWORD, // generated ethereal password
				},
			});
			// generate code
			const otp = await nanoid;
			const resetCode = otp.nanoid(5).toUpperCase();
			// save to db
			user.resetCode = resetCode;
			user.save();
			// prepare email
			let info = await transporter.sendMail({
				from: `"eaSt 🍟🍖" ${process.env.SENDER_EMAIL}`, // sender address
				to: email, // list of receivers
				subject: 'Your eaSt Password Reset Code', // Subject line
				html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Your eaSt Password Reset Code</title>    <style>/* Add your own CSS styles here */body {font-family: Arial,sans-serif;background-color: #f0f0f0;}.container {max-width:600px; margin: 0 auto;background-color: #ffffff;padding: 20px; border-radius: 10px;}.logo {display: block; margin: 0 auto;width: 100px; height: 100px;}.logoText{	display: block;margin: 0 auto;font-size: 72px;font-weight: bold;color: #F05600;text-align: center;	text-shadow: 2px 2px #F05600;}.reset-code {font-size: 36px;font-weight: bold;color:#ff0000;           text-align: center;}.instructions {font-size: 16px;line-height: 1.5;color: #333333; }</style></head><body>
					<div class="container"><image src = '/logo.png' alt ="eaSt logo" /><h1 class="logoText">eaSt</h1><h1>Forgot Password</h1>  <p class="instructions">You have requested to reset your password for your eaSt account. Please use the following code to verify your identity and create a new password.</p><p class="reset-code">${resetCode}</p><p class="instructions">If you did not request a password reset, please ignore this email or contact our support team if you have any questions.</p> </div></body></html>`, // html body
			});

			console.log('Message sent: %s', info.messageId);
			// Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
			res.send({ resetCode });
		} catch (error) {
			console.error(error);
			res.status(500).send('Sending email failed!');
		}
	} catch (error) {
		console.error(error.message);
		res.status(500).send('Server Error');
	}
};
const resetPassword = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const { email, password, resetCode } = req.body;
		// find user based on email and resetCode
		let user = await User.findOne({ email, resetCode });
		if (!user) {
			return res.status(400).json({
				errors: [{ msg: 'Email or reset code is invalid!' }],
			});
		}
		try {
			// hash password
			const hashedPassword = await hashPassword(password);
			user.password = hashedPassword;
			user.resetCode = '';
			user.save();
			return res.json({ ok: true });
		} catch (error) {
			console.error(error);
			res.status(500).send('failed to reset password!');
		}
	} catch (error) {
		console.error(error.message);
		res.status(500).send('Server Error');
	}
};
const downloadUser = async (req, res) => {
	try {
		if (req.params.id !== req.user.id) {
			return res.status(401).json({ errors: [{ msg: 'Not Authorized!' }] });
		}
		const user = await User.findById(req.params.id);
		if (!user) {
			return res.status(404).json({ errors: [{ msg: 'No User found' }] });
		}
		const fileName = user.name;
		// convert the user's information to a text file
		const textData = `${user}`;
		// set the response headers to indicate that we are sending a file
		res.setHeader(
			'Content-disposition',
			`attachment; filename=${fileName}.txt`
		);
		res.set('Content-Type', 'text/plain');
		// send the file to the client
		res.status(200).send(textData);
	} catch (error) {
		if (error.kind === 'ObjectId') {
			return res.status(404).json({ errors: [{ msg: 'No User found' }] });
		}
		res.status(500).json({
			errors: [{ msg: `Failed to Download ${error.message}` }],
		});
	}
};
const deleteUser = async (req, res) => {
	try {
		if (req.params.id !== req.user.id) {
			return res.status(401).json({ errors: [{ msg: 'Not Authorized!' }] });
		}
		// Find user by id
		const user = await User.findById(req.params.id);
		if (!user) {
			return res.status(404).json({ errors: [{ msg: 'No User found' }] });
		}
		if (user.cloudinary_id) {
			// Delete image from cloudinary
			await cloudinary.uploader.destroy(user.cloudinary_id);
		}
		// Delete user from db
		await User.deleteOne({ _id: req.params.id });
		res.json({ id: req.params.id });
	} catch (error) {
		if (error.kind === 'ObjectId') {
			return res.status(404).json({ errors: [{ msg: 'No User found' }] });
		}
		res.status(500).json({
			errors: [{ msg: error.message }],
		});
	}
};
const updateUser = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}
		// Check if the authenticated user is authorized to update the user
		if (req.params.id !== req.user.id) {
			return res.status(401).json({ errors: [{ msg: 'Not Authorized!' }] });
		}

		// Find the user by ID
		let user = await User.findById(req.params.id);
		if (!user) {
			return res.status(404).json({ errors: [{ msg: 'No User found' }] });
		}
		if (user.cloudinary_id) {
			// Delete image from cloudinary
			await cloudinary.uploader.destroy(user.cloudinary_id);
		}
		// Upload image to cloudinary
		const result = await cloudinary.uploader.upload(req.file.path, {
			folder: 'uploaded/profile_photos',
		});
		// Update the user information
		console.log(req.body);
		const data = {
			name: req.body?.name || user.name,
			avatar: result.secure_url || user.avatar,
			cloudinary_id: result.public_id || user.cloudinary_id,
			email: req.body?.email || user.email,
			phoneNumber: req.body?.phoneNumber || user.phoneNumber,
		};

		// Save the updated user information to the database
		user = await User.findByIdAndUpdate(req.params.id, data, {
			new: true,
		});

		// Return the updated user information
		const { password: _, resetCode, ...rest } = user._doc;
		return res.json({ user: rest });
	} catch (error) {
		if (error.kind === 'ObjectId') {
			return res.status(404).json({ errors: [{ msg: 'No User found' }] });
		}
		res.status(500).json({
			errors: [{ msg: error.message }],
		});
	}
};
const updatePassword = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}
		// Check if the authenticated user is authorized to update the user
		if (req.params.id !== req.user.id) {
			return res.status(401).json({ errors: [{ msg: 'Not Authorized!' }] });
		}

		// Get the updated user information from the request body
		const { password, new_password } = req.body;

		// Find the user by ID
		const user = await User.findById(req.params.id);
		if (!user) {
			return res.status(404).json({ errors: [{ msg: 'No User found' }] });
		}
		//check if old pass is correct
		const passwordsMatch = await comparePasswords(password, user.password);
		if (!passwordsMatch) {
			return res.status(400).json({ errors: [{ msg: 'Invalid Password' }] });
		}

		// Check if the password is being updated
		if (new_password) {
			const hashedPassword = await hashPassword(new_password);
			user.password = hashedPassword;
		}
		// Save the updated user information to the database
		await user.save();
		// Return the updated user information
		const { password: _, resetCode, ...rest } = user._doc;
		return res.json({ user: rest });
	} catch (error) {
		if (error.kind === 'ObjectId') {
			return res.status(404).json({ errors: [{ msg: 'No User found' }] });
		}
		res.status(500).json({
			errors: [{ msg: `Failed to update` }],
		});
	}
};
const uploadProfile = async (req, res) => {
	try {
		// Check if the authenticated user is authorized to update the user
		if (req.params.id !== req.user.id) {
			return res.status(401).json({ errors: [{ msg: 'Not Authorized!' }] });
		}

		// Find the user by ID
		const user = await User.findById(req.params.id);
		if (!user) {
			return res.status(404).json({ errors: [{ msg: 'No User found' }] });
		}

		try {
			if (user.cloudinary_id) {
				// Delete image from cloudinary
				await cloudinary.uploader.destroy(user.cloudinary_id);
			}
			// Upload image to cloudinary
			const result = await cloudinary.uploader.upload(req.file.path, {
				folder: 'uploaded/profile_photos',
			});

			// update user
			user.cloudinary_id = result.public_id;
			user.avatar = result.secure_url;

			// Save the updated user information to the database
			await user.save();
			// Return the updated user information
			const { password, resetCode, ...rest } = user._doc;
			return res.json({ user: rest });
		} catch (error) {
			console.log(error);
			return res.status(400).json({ errors: [{ msg: error.message }] });
		}
	} catch (error) {
		if (error.kind === 'ObjectId') {
			return res.status(404).json({ errors: [{ msg: 'No User found' }] });
		}
		res.status(500).json({
			errors: [{ msg: error.message }],
		});
	}
};
const verifyEmail = async (req, res) => {
	const { token } = req.params;
	try {
		const user = await User.findOne({ verificationToken: token });
		if (!user) {
			return res.status(400).json({ errors: [{ msg: 'Invalid token' }] });
		}
		user.emailVerified = true;
		user.verificationToken = null;
		await user.save();
		return res.status(200).json({ msg: 'Email verified successfully' });
	} catch (error) {
		console.error(error.message);
		return res.status(500).json({ errors: [{ msg: error.message }] });
	}
};
const requestEmailVerification = async (req, res) => {
	try {
		if (req.params.id !== req.user.id) {
			return res.status(401).json({ errors: [{ msg: 'Not Authorized!' }] });
		}
		// Find the user by ID
		let user = await User.findById(req.params.id);
		if (!user) {
			return res.status(404).json({ errors: [{ msg: 'No User found' }] });
		}
		if (user.emailVerified) {
			return res
				.status(400)
				.json({ errors: [{ msg: 'Email already verified' }] });
		}
		await sendVerificationEmail(user.email);
		res.json({ msg: 'Verification email sent' });
	} catch (error) {
		res.status(500).json({ errors: [{ msg: error.message }] });
	}
};
const downloadProfile = async (req, res) => {
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
			errors: [{ msg: 'internal server error' }],
		});
	}
};

module.exports = {
	register,
	login,
	getUser,
	forgotPassword,
	resetPassword,
	downloadUser,
	deleteUser,
	updateUser,
	updatePassword,
	uploadProfile,
	verifyEmail,
	requestEmailVerification,
	downloadProfile,
};
