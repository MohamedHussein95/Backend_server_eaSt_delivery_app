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
		userName: {
			type: String,
			unique: true,
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
		isAdmin: {
			type: Boolean,
			default: false,
		},
		profileData: {
			coverPicture: {
				type: String,
			},
			about: {
				type: String,
			},
			livesIn: {
				type: String,
			},
			worksAt: {
				type: String,
			},
			relationship: {
				type: String,
			},
			country: {
				type: String,
			},
			followers: [Number],
			following: [Number]
		},
		resetCode: {
			code: {
				type: String,
			},
			expiration: {
				type: Date,
			},
		},
	},
	{
		timestamps: true,
	}
);

// Virtual property for the userName
UserSchema.virtual('username').get(function () {
	return `@${this.firstName.toLowerCase()}${this.lastName.toLowerCase()}`;
});

// Pre-save hook to generate a unique userName before saving
UserSchema.pre('save', async function (next) {
	if (this.isModified('password')) {
		const salt = await bcrypt.genSalt(10);
		this.password = await bcrypt.hash(this.password, salt);
	}

	if (this.isNew) {
		let baseUsername = `@${this.firstName.toLowerCase()}${this.lastName.toLowerCase()}`;
		let username = baseUsername;
		let count = 1;
		while (await this.constructor.findOne({ userName: username })) {
			username = `${baseUsername}${count}`;
			count++;
		}

		this.userName = username;
	}

	next();
});

// Method to compare passwords
UserSchema.methods.comparePasswords = async function (password) {
	return await bcrypt.compare(password, this.password);
};

// Create the User model
const User = mongoose.model('User', UserSchema);

export { User };
