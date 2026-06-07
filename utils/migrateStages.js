/**
 * One-time migration: convert old LaunchPad stage values to new 6-stage system.
 * Runs automatically on server start, only if old stage values exist.
 */
const OLD_TO_NEW = {
  'Idea':        'SUBMITTED',
  'Review':      'IDEA_VALIDATION',
  'Planning':    'PITCH_PREPARATION',
  'Development': 'MVP_EARLY_TRACTION',
  'Launched':    'SEED_FUNDING_CLOSURE',
};

const VALID = ['SUBMITTED','IDEA_VALIDATION','MVP_EARLY_TRACTION','PITCH_PREPARATION','INVESTOR_OUTREACH','SEED_FUNDING_CLOSURE'];

async function migrateStages() {
  try {
    const mongoose = require('mongoose');
    const collection = mongoose.connection.collection('launchpads');

    let total = 0;
    for (const [oldStage, newStage] of Object.entries(OLD_TO_NEW)) {
      const result = await collection.updateMany(
        { stage: oldStage },
        { $set: { stage: newStage } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[migrateStages] "${oldStage}" → "${newStage}": ${result.modifiedCount} docs`);
        total += result.modifiedCount;
      }
    }

    // Fix any remaining invalid stages
    const fallback = await collection.updateMany(
      { stage: { $nin: VALID } },
      { $set: { stage: 'SUBMITTED' } }
    );
    if (fallback.modifiedCount > 0) {
      console.log(`[migrateStages] unknown stages → "SUBMITTED": ${fallback.modifiedCount} docs`);
      total += fallback.modifiedCount;
    }

    if (total > 0) {
      console.log(`[migrateStages] Migration complete. ${total} documents updated.`);
    } else {
      console.log('[migrateStages] No migration needed — all stage values are current.');
    }
  } catch (err) {
    console.error('[migrateStages] Error:', err.message);
  }
}

module.exports = migrateStages;
