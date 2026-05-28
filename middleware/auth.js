const admin = require('../utils/firebaseAdmin');
const User = require('../models/User');

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ message: 'Not authorized' });

  try {
    const idToken = authHeader.split(' ')[1];
    // Verify Firebase ID token
    const decoded = await admin.auth().verifyIdToken(idToken);
    // Look up the user in MongoDB by their Firebase UID (stored as firebaseUid)
    const user = await User.findOne({ firebaseUid: decoded.uid }).select('-password');
    if (!user) return res.status(401).json({ message: 'User not found in system' });
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(401).json({ message: 'Token invalid or expired' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ message: 'Access denied' });
  next();
};

module.exports = { protect, authorize };
