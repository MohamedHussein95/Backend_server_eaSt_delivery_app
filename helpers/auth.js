const bcrypt = require('bcryptjs');
const User = require('../models/User');
const nanoid = import('nanoid');
const dotenv = require('dotenv').config();
const nodemailer = require('nodemailer');
const hashPassword = async (password) => {
	const salt = 10;
	const hashedPassword = await bcrypt.hash(password, salt);

	return hashedPassword;
};
const comparePasswords = async (password, hashedPassword) => {
	return await bcrypt.compare(password, hashedPassword);
};
const sendVerificationEmail = async (email) => {
	// generate token
	const code = await nanoid;
	const token = await code.nanoid(5).toUpperCase();

	let user = await User.findOneAndUpdate(email, {
		verificationToken: token,
	});

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

		// prepare email
		await transporter.sendMail({
			from: `"eaSt 🍟🍖" ${process.env.SENDER_EMAIL}`, // sender address
			to: email, // list of receivers
			subject: 'Verify your email address', // Subject line
			html: `<p>Hi ${user.name},</p><p>Please click the following link to verify your email address:</p><p><a href="http://localhost:8001/api/auth/verify_email/${token}">Verify Email Address</a></p>`,
		});
	} catch (error) {
		console.log(error);
	}
};

module.exports = { hashPassword, comparePasswords, sendVerificationEmail };
