/**
 * Run once to migrate old LaunchPad stage values to the new 6-stage system.
 * Usage: node migrate-stages.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const OLD_TO_NEW = {
  'Idea':        'SUBMITTED',
  'Review':      'IDEA_VALIDATION',
  'Planning':    'PITCH_PREPARATION',
  'Development': 'MVP_EARLY_TRACTION',
  'Launched':    'SEED_FUNDING_CLOSURE',
};

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const collection = mongoose.connection.collection('launchpads');
  let total = 0;

  for (const [oldStage, newStage] of Object.entries(OLD_TO_NEW)) {
    const result = await collection.updateMany(
      { stage: oldStage },
      { $set: { stage: newStage } }
    );
    if (result.modifiedCount > 0) {
      console.log(`  "${oldStage}" → "${newStage}": ${result.modifiedCount} documents updated`);
      total += result.modifiedCount;
    }
  }

  // Set default for any null/undefined/unknown stage values
  const fallback = await collection.updateMany(
    { stage: { $nin: ['SUBMITTED','IDEA_VALIDATION','MVP_EARLY_TRACTION','PITCH_PREPARATION','INVESTOR_OUTREACH','SEED_FUNDING_CLOSURE'] } },
    { $set: { stage: 'SUBMITTED' } }
  );
  if (fallback.modifiedCount > 0) {
    console.log(`  Unknown stages → "SUBMITTED": ${fallback.modifiedCount} documents updated`);
    total += fallback.modifiedCount;
  }

  console.log(`\nMigration complete. Total: ${total} documents updated.`);
  await mongoose.disconnect();
}

migrate().catch(err => { console.error(err); process.exit(1); });
