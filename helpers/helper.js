import { User } from '../models/UserModel.js';
import { nanoid } from 'nanoid';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

dotenv.config();

/**
 * Sends a verification email to the provided email address.
 * @param {string} email - The recipient's email address.
 * @param {string} title - The email subject/title.
 * @param {string} message - The email body message.
 */
const sendVerificationEmail = async (email, title, message) => {
	// Generate a verification token
	const token = nanoid(5).toUpperCase();

	const payload = { secret: token };
	const verificationToken = await jwt.sign(payload, process.env.JWT_SECRET, {
		expiresIn: '1h',
	});

	let user = await User.findOneAndUpdate({ email }, { verificationToken });

	if (!user) {
		throw new Error('No user found!');
	}

	try {
		// Create a reusable transporter object using the default SMTP transport
		let transporter = nodemailer.createTransport({
			host: 'smtp.gmail.com',
			port: 465,
			secure: true,
			auth: {
				user: process.env.SENDER_EMAIL,
				pass: process.env.SENDER_PASSWORD,
			},
		});

		// Prepare the email
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
              <h1 style="color: #F05600; text-align: center;">${title} 🍟🍖</h1>
              <h2 style="color: #333;">Hi 👋 , ${user.firstName},</h2>
              <p style="color: #333;">Please click the following link to verify your email address:</p>
              <p style="text-align: center;"><a href="${process.env.HOST}/api/users/verify_email/${verificationToken}" style="background-color: #F05600; color: #fff; text-decoration: none; padding: 10px; border-radius: 5px; margin-Top:20px; margin-Bottom:20px ">Verify Email Address</a></p>
              <p style="color: #333;">${message}</p>
            </div>
          </body>
        </html>
      `,
		});
	} catch (error) {
		throw new Error('Failed to send email.');
	}
};

/**
 * Generates backup codes.
 * @returns {string[]} - An array of backup codes.
 */
const generateBackupCodes = () => {
	const backupCodes = [];

	// Generate 4 unique backup codes
	for (let i = 0; i < 4; i++) {
		const code = nanoid();
		backupCodes.push(code);
	}

	return backupCodes;
};

export { sendVerificationEmail, generateBackupCodes };
