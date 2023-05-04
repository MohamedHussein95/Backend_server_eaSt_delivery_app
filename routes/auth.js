const express = require('express');
const { Router } = express;
const { body, validationResult } = require('express-validator');
const User = require('../models/user');
const { hashPassword, comparePasswords } = require('../helpers/auth');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv').config();
const gravatar = require('gravatar');
const nodemailer = require('nodemailer');
const auth = require('../middlewares/auth');
const nanoid = import('nanoid');

const router = Router();

router.post(
	'/register',
	[
		body('name').notEmpty().withMessage('Name is required'),
		body('email').notEmpty().withMessage('Email is required'),
		body('password')
			.isLength({ min: 6 })
			.withMessage('Password must be at least 6 characters long'),
	],
	async (req, res) => {
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
			const { password: _, ...rest } = user._doc;
			return res.json({ token, user: rest });
		} catch (error) {
			console.error(error);
			res.status(500).send('Server Error');
		}
	}
);

router.post(
	'/login',
	[
		body('email').notEmpty().withMessage('Email is required'),
		body('password').exists().withMessage('Password is required'),
	],
	async (req, res) => {
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
				return res
					.status(400)
					.json({ errors: [{ msg: 'Invalid Password' }] });
			}

			const payload = { user: { id: user.id } };
			const token = jwt.sign(payload, process.env.JWT_SECRET, {
				expiresIn: '7d',
			});
			const { password: _, ...rest } = user._doc;
			return res.json({ token, user: rest });
		} catch (error) {
			console.error(error);
			res.status(500).send('Server Error');
		}
	}
);
router.post(
	'/forgot_password',
	[body('email').notEmpty().withMessage('Email is required')],
	async (req, res) => {
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
					<div class="container"><h1 class="logoText">eaSt</h1><h1>Forgot Password</h1>  <p class="instructions">You have requested to reset your password for your eaSt account. Please use the following code to verify your identity and create a new password.</p><p class="reset-code">${resetCode}</p><p class="instructions">If you did not request a password reset, please ignore this email or contact our support team if you have any questions.</p> </div></body></html>`, // html body
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
	}
);
router.post(
	'/reset_password',
	[
		body('resetCode').notEmpty().withMessage('reset Code is required'),
		body('email').notEmpty().withMessage('email is required'),
		body('password')
			.isLength({ min: 6 })
			.withMessage('Password must be at least 6 characters long'),
	],
	async (req, res) => {
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
	}
);
router.get('/me', auth, async (req, res) => {
	try {
		let user = await User.findById(req.user.id).select(
			'-password,-resetCode'
		);
		res.json(user);
	} catch (error) {
		console.error(error.message);
		res.status(500).send('Server Error');
	}
});

module.exports = router;
