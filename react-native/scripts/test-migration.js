/**
 * Test Migration Script
 *
 * Tests the dosage snapshot migration against a real user database
 * to verify data integrity and catch edge cases.
 *
 * Usage: node scripts/test-migration.js <path-to-backup.db>
 */

const sqlite3 = require('sqlite3').verbose();

// Get database path from command line
const dbPath = process.argv[2];

if (!dbPath) {
  console.error('Usage: node scripts/test-migration.js <path-to-backup.db>');
  process.exit(1);
}

console.log('📊 Testing migration against real database...');
console.log('Database:', dbPath);
console.log('');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
});

// Helper to run queries as promises
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function analyzeDatabase() {
  try {
    // Check current schema version
    const version = await get('SELECT version FROM schema_version WHERE id = 1');
    console.log('📋 Current schema version:', version?.version || 'unknown');
    console.log('');

    // Check if dosage snapshot columns exist
    const columns = await query("PRAGMA table_info(medication_doses)");
    const hasSnapshotCols = columns.some(col => col.name === 'dosage_amount');

    console.log('🔍 Schema Analysis:');
    console.log('   Dosage snapshot columns exist:', hasSnapshotCols ? '✅' : '❌');
    console.log('');

    // Analyze medications
    const medications = await query('SELECT * FROM medications WHERE active = 1');
    console.log('💊 Active Medications:', medications.length);

    if (medications.length > 0) {
      console.log('');
      medications.forEach(med => {
        console.log(`   - ${med.name}: ${med.dosage_amount}${med.dosage_unit} (default: ${med.default_dosage || 1})`);
      });
    }
    console.log('');

    // Analyze doses
    const totalDoses = await get('SELECT COUNT(*) as count FROM medication_doses');
    console.log('📝 Total Doses:', totalDoses.count);

    if (totalDoses.count > 0) {
      // Check if any doses have snapshot data (only if columns exist)
      if (hasSnapshotCols) {
        const dosesWithSnapshot = await get(
          'SELECT COUNT(*) as count FROM medication_doses WHERE dosage_amount IS NOT NULL'
        );
        console.log('   With snapshot data:', dosesWithSnapshot.count);
        console.log('   Without snapshot data:', totalDoses.count - dosesWithSnapshot.count);
        console.log('');
      }

      // Sample some doses to show the issue
      const sampleDoses = await query(`
        SELECT
          d.id,
          d.medication_id,
          d.timestamp,
          d.amount,
          ${hasSnapshotCols ? 'd.dosage_amount,' : 'NULL as dosage_amount,'}
          ${hasSnapshotCols ? 'd.dosage_unit,' : 'NULL as dosage_unit,'}
          m.name as med_name,
          m.dosage_amount as current_dosage,
          m.dosage_unit as current_unit
        FROM medication_doses d
        JOIN medications m ON d.medication_id = m.id
        ORDER BY d.timestamp DESC
        LIMIT 10
      `);

      console.log('📊 Recent Doses (showing potential issues):');
      console.log('');

      sampleDoses.forEach(dose => {
        const timestamp = new Date(dose.timestamp).toLocaleDateString();
        const stored = dose.dosage_amount
          ? `${dose.amount} × ${dose.dosage_amount}${dose.dosage_unit}`
          : `${dose.amount} pills`;
        const calculated = `${dose.amount} × ${dose.current_dosage}${dose.current_unit}`;
        const matches = dose.dosage_amount === dose.current_dosage;
        const icon = matches || !dose.dosage_amount ? '✅' : '⚠️';

        console.log(`   ${icon} ${dose.med_name} (${timestamp})`);
        console.log(`      Stored: ${stored}`);
        console.log(`      Current calc: ${calculated}`);
        if (!matches && dose.dosage_amount) {
          console.log(`      🔴 MISMATCH: Medication dosage changed!`);
        }
        console.log('');
      });

      // Check for medications with changed dosages (only if snapshot columns exist)
      if (hasSnapshotCols) {
        const changedDosages = await query(`
          SELECT DISTINCT
            m.name,
            m.dosage_amount as current_dosage,
            m.dosage_unit,
            COUNT(DISTINCT d.dosage_amount) as different_dosages,
            GROUP_CONCAT(DISTINCT d.dosage_amount) as historical_dosages
          FROM medications m
          JOIN medication_doses d ON m.id = d.medication_id
          WHERE d.dosage_amount IS NOT NULL
            AND d.dosage_amount != m.dosage_amount
          GROUP BY m.id
        `);

        if (changedDosages.length > 0) {
          console.log('⚠️  Medications with Changed Dosages:');
          console.log('');
          changedDosages.forEach(med => {
            console.log(`   ${med.name}`);
            console.log(`      Current: ${med.current_dosage}${med.unit}`);
            console.log(`      Historical: ${med.historical_dosages}`);
            console.log('');
          });
        }
      }
    }

    // Summary of what migration will do
    console.log('');
    console.log('🔧 Migration Impact:');
    if (!hasSnapshotCols) {
      console.log('   ✅ Will add dosage_amount and dosage_unit columns');
      console.log(`   ✅ Will backfill ${totalDoses.count} existing doses with current medication dosages`);
      console.log('   ⚠️  Backfill assumes medication dosages haven\'t changed');
      console.log('   ✅ Future doses will capture exact dosage at time of logging');
    } else {
      console.log('   ✅ Migration already applied');
      const incomplete = totalDoses.count - (await get('SELECT COUNT(*) as count FROM medication_doses WHERE dosage_amount IS NOT NULL')).count;
      if (incomplete > 0) {
        console.log(`   ⚠️  ${incomplete} doses still need snapshot data`);
      }
    }

  } catch (error) {
    console.error('❌ Error analyzing database:', error.message);
    throw error;
  } finally {
    db.close();
  }
}

// Run the analysis
analyzeDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
