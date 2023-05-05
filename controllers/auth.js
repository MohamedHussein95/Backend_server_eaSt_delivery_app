const { validationResult } = require('express-validator');
const User = require('../models/User');
const { hashPassword, comparePasswords } = require('../helpers/auth');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv').config();
const gravatar = require('gravatar');
const nodemailer = require('nodemailer');
const nanoid = import('nanoid');

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
			return res
				.status(400)
				.json({ errors: [{ msg: "User doesn't exist" }] });
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
const getUserInfo = async (req, res) => {
	try {
		let user = await User.findById(req.user.id).select(
			'-password -resetCode'
		);
		res.json(user);
	} catch (error) {
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
			return res.status(400).json({
				errors: [{ msg: 'user not found!' }],
			});
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
					<div class="container"><image src = '.././public/logo.png' alt ="eaSt logo" /><h1 class="logoText">eaSt</h1><h1>Forgot Password</h1>  <p class="instructions">You have requested to reset your password for your eaSt account. Please use the following code to verify your identity and create a new password.</p><p class="reset-code">${resetCode}</p><p class="instructions">If you did not request a password reset, please ignore this email or contact our support team if you have any questions.</p> </div></body></html>`, // html body
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
const downloadUserInfo = async (req, res) => {
	try {
		const user = await User.findById(req.params.id);
		if (!user) {
			return res.status(400).json({ errors: [{ msg: 'No User found' }] });
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
		res.status(400).json({
			errors: [{ msg: `Failed to Download ${error.message}` }],
		});
	}
};

module.exports = {
	register,
	login,
	getUserInfo,
	forgotPassword,
	resetPassword,
	downloadUserInfo,
};
