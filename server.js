const express = require('express');
const dotenv = require('dotenv').config();
const cors = require('cors');
const connectDB = require('./config/db');

//connect to Mongo db
connectDB();

const app = express();
const port = process.env.PORT || 8001;
//const host = process.env.HOST || 'http://localhost';

app.use(express.json({ extended: false }));
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(express.static('public'));
app.use('/api/auth', require('./routes/auth'));
app.get('/', (req, res) => {
	res.status(200).send('eaSt Server is running');
});

app.listen(port, () => console.log(`server is listening on port:${port} `));
