const express = require('express');
const { Router } = express;
const { body } = require('express-validator');
const auth = require('../middlewares/auth');
const {
	register,
	login,
	getUser,
	forgotPassword,
	downloadUser,
	resetPassword,
	deleteUser,
	updateUser,
	updatePassword,
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

router.get('/me', auth, getUser);
router.post('/me/download/:id', auth, downloadUser);
router.delete('/me/delete/:id', auth, deleteUser);
router.put(
	'/me/update/:id',
	[
		[
			body('name').notEmpty().withMessage('Name is required'),
			body('email').notEmpty().withMessage('Email is required'),
			body('phoneNumber').notEmpty().withMessage('Phone Number is required'),
		],
		auth,
	],
	updateUser
);
router.put(
	'/me/update_password/:id',
	[
		[
			body('password').exists().withMessage('Password is required'),
			body('new_password')
				.isLength({ min: 6 })
				.withMessage('Password must be at least 6 characters long'),
		],
		auth,
	],
	updatePassword
);

module.exports = router;
