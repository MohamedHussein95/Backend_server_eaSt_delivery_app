const express = require('express');
const dotenv = require('dotenv').config();
const cors = require('cors');
const connectDB = require('./config/db');

const port = process.env.PORT || 8001;
const app = express();

app.use(express.json({ extended: false }));
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use('/api/auth', require('./routes/auth'));

connectDB();

app.get('/', (req, res) => {
	res.status(200).send('eaSt Server is running');
});
app.listen(port, () => console.log(`server is listening on port:${port}`));
