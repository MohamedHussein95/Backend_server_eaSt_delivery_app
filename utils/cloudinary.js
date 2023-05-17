import cloudinary from 'cloudinary';

// Function to configure Cloudinary with the provided environment variables
const configureCloudinary = () => {
	// Retrieve the Cloudinary environment variables
	const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
		process.env;

	// Configure Cloudinary with the retrieved environment variables
	cloudinary.v2.config({
		cloud_name: CLOUDINARY_CLOUD_NAME,
		api_key: CLOUDINARY_API_KEY,
		api_secret: CLOUDINARY_API_SECRET,
	});
};

export default configureCloudinary;
