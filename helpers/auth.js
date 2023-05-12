const bcrypt = require('bcryptjs');
const User = require('../models/User');
const nanoid = import('nanoid');
const dotenv = require('dotenv');
dotenv.config();
const jwt = require('jsonwebtoken');
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
	const nano = await nanoid;
	const randomToken = await nano.nanoid();

	const payload = { secret: randomToken };
	const VerificationToken = await jwt.sign(payload, process.env.JWT_SECRET, {
		expiresIn: '1h',
	});

	let user = await User.findOneAndUpdate(email, {
		verificationToken: randomToken,
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
				user: process.env.SENDER_EMAIL,
				pass: process.env.SENDER_PASSWORD,
			},
		});

		// prepare email
		await transporter.sendMail({
			from: `"eaSt 🍟🍖" ${process.env.SENDER_EMAIL}`,
			to: email,
			subject: 'Verify your email address',
			html: `
        <html>
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>eaSt Email Verification</title>
            </head>
            <body style="font-family: Arial, sans-serif;">
                <div style="background-color: #F6F6F6; padding: 30px;">
                    <h1 style="color: #F05600; text-align: center;">Welcome to eaSt 🍟🍖</h1>
                    <p style="color: #333;">Hi ${user.name},</p>
                    <p style="color: #333;">Please click the following link to verify your email address:</p>
                    <p style="text-align: center;"><a href="${process.env.HOST}/api/auth/verify_email/${VerificationToken}" style="background-color: #F05600; color: #fff; text-decoration: none; padding: 10px; border-radius: 5px;">Verify Email Address</a></p>
                    <p style="color: #333;">If you did not create an account with eaSt, please ignore this email.</p>
                </div>
            </body>
        </html>
    `,
		});
	} catch (error) {
		console.log(error);
	}
};

module.exports = { hashPassword, comparePasswords, sendVerificationEmail };
