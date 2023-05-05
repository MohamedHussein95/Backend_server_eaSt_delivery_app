const express = require('express');
const dotenv = require('dotenv').config();
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();
const port = process.env.PORT || 8001;

app.use(express.json({ extended: false }));
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(express.static('public'));
app.use('/api/auth', require('./routes/auth'));
app.get('/', (req, res) => {
	res.status(200).send('eaSt Server is running');
});

connectDB();

app.listen(port, () => console.log(`server is listening on port:${port}`));
