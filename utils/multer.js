const multer = require('multer');
const path = require('path');

module.exports = multer({
	storage: multer.diskStorage({
		filename: function (req, file, cb) {
			cb(
				null,
				file.fieldname + '-' + Date.now() + path.extname(file.originalname)
			);
		},
	}),
	limits: { fileSize: 1024 * 1024 },
	fileFilter: (req, file, cb) => {
		let ext = path.extname(file.originalname);
		if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') {
			cb(new Error('File type is not supported'), false);
			return;
		}

		cb(null, true);
	},
});
