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

const User = mongoose.model('user', UserSchema);

module.exports = User;
