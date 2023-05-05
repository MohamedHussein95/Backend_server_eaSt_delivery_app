const mongoose = require('mongoose');

const UserSchema = mongoose.Schema(
	{
		name: {
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
		avatar: {
			type: String,
		},
		resetCode: { type: String },
	},
	{
		timestamps: true,
	}
);

const User = mongoose.model('User', UserSchema);

module.exports = User;
