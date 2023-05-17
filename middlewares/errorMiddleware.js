import dotenv from 'dotenv';
dotenv.config();

// Middleware for handling "Not Found" errors
const notFound = (req, res, next) => {
	const error = new Error(`Not Found - ${req.originalUrl}`);
	res.status(400);
	next(error);
};

// Middleware for handling general errors
const errorHandler = (err, req, res, next) => {
	let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
	let message = err.message;

	if (err.name === 'CastError' || err.kind === 'ObjectId') {
		// If the error is a CastError or ObjectId error, set the status code to 404 and the message to 'Resource not found'
		statusCode = 404;
		message = 'Resource not found';
	}

	res.status(statusCode).json({
		message,
		stack: process.env.NODE_ENV === 'production' ? null : err.stack, // Include stack trace in development mode only
	});
};

export { notFound, errorHandler };
