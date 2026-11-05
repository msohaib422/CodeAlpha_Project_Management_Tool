const jwt = require('jsonwebtoken');

const generateToken = (id, tokenVersion = 0) => {
  return jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: '10m',
  });
};

module.exports = generateToken;