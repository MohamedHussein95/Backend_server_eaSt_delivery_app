import multer from 'multer';
import path from 'path';

const fileSizeLimit = 1024 * 1024; // 1MB
const allowedFileExtensions = ['.jpg', '.jpeg', '.png'];

// Configure the storage for uploaded files
const storage = multer.diskStorage({
	filename: (req, file, cb) => {
		// Generate a unique filename for the uploaded file
		const uniqueFilename = `${file.fieldname}-${Date.now()}${path.extname(
			file.originalname
		)}`;
		cb(null, uniqueFilename);
	},
});

// Define the file filter function to allow only specific file types
const fileFilter = (req, file, cb) => {
	const ext = path.extname(file.originalname);
	if (!allowedFileExtensions.includes(ext)) {
		// If the file type is not supported, create an error and reject the file
		const error = new Error('File type is not supported');
		cb(error, false);
		return;
	}
	// File type is supported, accept the file
	cb(null, true);
};

// Create a multer instance with the configured options
const upload = multer({
	storage,
	limits: { fileSize: fileSizeLimit },
	fileFilter,
});

export default upload;
