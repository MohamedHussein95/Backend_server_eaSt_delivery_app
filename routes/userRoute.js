import express from 'express';
import { body } from 'express-validator';
import { protect } from '../middlewares/authMiddlewar.js';
import upload from '../utils/multer.js';
import {
	deleteUser,
	downloadUserData,
	forgotPassword,
	getUserProfile,
	logOutUser,
	loginUser,
	registerUser,
	requestEmailVerification,
	resetPassword,
	updatePassword,
	updateUser,
	uploadProfile,
	validateResetCode,
	verifyEmail,
} from '../controllers/userController.js';

const router = express.Router();

// Register a new user
router.post(
	'/register',
	[
		body('firstName').notEmpty().withMessage('First Name is required'),
		body('lastName').notEmpty().withMessage('Last Name is required'),
		body('email').notEmpty().withMessage('Email is required'),
		body('password')
			.isLength({ min: 6 })
			.withMessage('Password must be at least 6 characters long'),
	],
	registerUser
);

// User login
router.post(
	'/login',
	[
		body('email').notEmpty().withMessage('Email is required'),
		body('password').exists().withMessage('Password is required'),
	],
	loginUser
);

// User logout
router.post('/logout/:id', protect, logOutUser);

// Request password reset
router.get(
	'/forgot_password',
	[body('email').notEmpty().withMessage('Email is required')],
	forgotPassword
);

// Reset user password
router.post(
	'/reset_password',
	[
		body('email').notEmpty().withMessage('Email is required'),
		body('new_password')
			.isLength({ min: 6 })
			.withMessage('Password must be at least 6 characters long'),
	],
	resetPassword
);

// Validate reset code
router.post(
	'/verify_resetcode',
	[
		body('email').notEmpty().withMessage('Email is required'),
		body('resetCode').notEmpty().withMessage('Reset Code is required'),
	],
	validateResetCode
);

// Update user password
router.put(
	'/update_password/:id',
	[
		body('password').exists().withMessage('Password is required'),
		body('new_password')
			.isLength({ min: 6 })
			.withMessage('New Password must be at least 6 characters long'),
	],
	protect,
	updatePassword
);

// Upload user profile image
router.put(
	'/upload_profile/:id',
	[protect, upload.single('image')],
	uploadProfile
);

// Verify user email
router.get('/verify_email/:token', verifyEmail);

// Request email verification
router.post('/request_verification/:id', protect, requestEmailVerification);

// Get user profile
router.get('/profile/:id', protect, getUserProfile);

// Download user data
router.post('/download/:id', protect, downloadUserData);

// Delete user account
router.delete('/delete/:id', protect, deleteUser);

// Update user information
router.put('/update/:id', [protect, upload.single('image')], updateUser);

export default router;
