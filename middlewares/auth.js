const jwt = require('jsonwebtoken');
const auth = (req, res, next) => {
	//get token from header
	const token = req.header('x-auth-token');
	//check if token exists
	if (!token) {
		return res
			.status(401)
			.json({ errors: [{ msg: 'No token , authorization denied!' }] });
	}

	//verify token
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		req.user = decoded.user;
		//call the next middleware or function
		next();
	} catch (error) {
		console.log(error);
		res.status(401).json({ msg: 'token is not valid' });
	}
};

module.exports = auth;
