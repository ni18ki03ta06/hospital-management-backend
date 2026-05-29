/**
 * create-admin.js
 * 
 * One-time script to create the admin (MAIN_DOCTOR) user in both
 * Firebase Authentication and MongoDB.
 * 
 * Usage:
 *   node create-admin.js
 * 
 * Make sure your .env is configured with:
 *   - MONGO_URI
 *   - FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *     (or FIREBASE_SERVICE_ACCOUNT_PATH)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const admin = require('./utils/firebaseAdmin');
const User = require('./models/User');

const ADMIN_EMAIL = 'admin@hospital.com';
const ADMIN_PASSWORD = 'Admin@1234';
const ADMIN_NAME = 'Admin';

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    // ── Step 1: Create or update Firebase Auth user ──────────────────
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        displayName: ADMIN_NAME,
        emailVerified: true,
      });
      } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        // User already exists — fetch and update password
        firebaseUser = await admin.auth().getUserByEmail(ADMIN_EMAIL);
        await admin.auth().updateUser(firebaseUser.uid, {
          password: ADMIN_PASSWORD,
          displayName: ADMIN_NAME,
          emailVerified: true,
        });
        } else {
        throw err;
      }
    }

    // ── Step 2: Create or update MongoDB user ────────────────────────
    let mongoUser = await User.findOne({ email: ADMIN_EMAIL });

    if (mongoUser) {
      // Update existing user
      mongoUser.firebaseUid = firebaseUser.uid;
      mongoUser.role = 'MAIN_DOCTOR';
      mongoUser.name = ADMIN_NAME;
      mongoUser.mustChangePassword = false;
      await mongoUser.save();
      } else {
      // Create new user (skip password hashing — Firebase handles auth)
      mongoUser = await User.create({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        firebaseUid: firebaseUser.uid,
        role: 'MAIN_DOCTOR',
        mustChangePassword: false,
        password: 'firebase-managed', // placeholder — not used for auth
      });
      }

    } catch (err) {
    console.error('❌ Error creating admin:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createAdmin();
