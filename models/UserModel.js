import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Define the User schema
const UserSchema = mongoose.Schema(
	{
		firstName: {
			type: String,
			required: true,
		},
		lastName: {
			type: String,
			required: true,
		},
		fullName: {
			type: String,
			required: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
		},
		phoneNumber: {
			type: String,
			unique: true,
		},
		password: {
			type: String,
			required: true,
		},
		backupCodes: {
			type: [String],
			required: true,
		},
		avatar: {
			type: String,
		},
		cloudinary_id: {
			type: String,
		},
		emailVerified: {
			type: Boolean,
			default: false,
		},
		phoneNumberVerified: {
			type: Boolean,
			default: false,
		},
		verificationToken: {
			type: String,
		},
		resetCode: {
			type: String,
		},
	},
	{
		timestamps: true,
	}
);

// Pre-save hook to hash the password before saving
UserSchema.pre('save', async function (next) {
	if (!this.isModified('password')) next();

	const salt = await bcrypt.genSalt(10);
	this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
UserSchema.methods.comparePasswords = async function (password) {
	return await bcrypt.compare(password, this.password);
};

// Create the User model
const User = mongoose.model('User', UserSchema);

export { User };
