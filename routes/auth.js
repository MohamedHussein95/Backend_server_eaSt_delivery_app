const express = require('express');
const { Router } = express;
const { body } = require('express-validator');
const auth = require('../middlewares/auth');
const {
	register,
	login,
	getUserInfo,
	forgotPassword,
	downloadUserInfo,
	resetPassword,
} = require('../controllers/auth');

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
	register
);

router.post(
	'/login',
	[
		body('email').notEmpty().withMessage('Email is required'),
		body('password').exists().withMessage('Password is required'),
	],
	login
);
router.post(
	'/forgot_password',
	[body('email').notEmpty().withMessage('Email is required')],
	forgotPassword
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
	resetPassword
);
router.get('/me', auth, getUserInfo);
router.get('/me/download/:id', downloadUserInfo);

module.exports = router;
