const upload = require('../utils/multer');
const express = require('express');
const { Router } = express;
const { body } = require('express-validator');
const auth = require('../middlewares/auth');

const {
	register,
	login,
	forgotPassword,
	resetPassword,
	updatePassword,
	uploadProfile,
	verifyEmail,
	requestEmailVerification,
	getUser,
	downloadUser,
	deleteUser,
	updateUser,
	downloadProfile,
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

router.put(
	'/update_password/:id',
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
router.post(
	'/upload_profile/:id',
	[auth, upload.single('image')],
	uploadProfile
);
router.get('/verify_email/:token', verifyEmail);
router.post('/request_verification/:id', auth, requestEmailVerification);
router.get('/:id', auth, getUser);
router.post('/download_user/:id', auth, downloadUser);
router.get('/download_profile/:id', downloadProfile);
router.delete('/delete/:id', auth, deleteUser);
router.put('/update/:id', [auth, upload.single('image')], updateUser);
module.exports = router;
