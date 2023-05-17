import express from 'express';
import dotenv from 'dotenv';
import userRoute from './routes/userRoute.js';
import { notFound, errorHandler } from './middlewares/errorMiddleware.js';
import cors from 'cors';
import connectDB from './config/db.js';
import cookieParser from 'cookie-parser';
dotenv.config();

connectDB();

const app = express();
const port = process.env.PORT || 8001;

app.use(express.json({ extended: false, limit: '4mb' })); // Parse JSON request bodies with a limit of 4MB
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded request bodies

app.use(cors()); // Enable Cross-Origin Resource Sharing (CORS)
app.use(cookieParser()); // Parse cookies in incoming requests
app.use(express.static('public')); // Serve static files from the 'public' directory

app.use('/api/users', userRoute); // Mount userRoute as middleware for '/api/users' endpoint

app.get('/', (req, res) => {
	res.status(200).send('eaSt0-auth-api Server is running'); // Respond with a simple message for the root route
});

app.use(notFound); // Handle 404 Not Found errors
app.use(errorHandler); // Custom error handler for other types of errors

app.listen(port, () => console.log(`server is listening on port:${port} `)); // Start the server and listen on the specified port
