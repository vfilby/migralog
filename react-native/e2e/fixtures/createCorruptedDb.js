#!/usr/bin/env node

/**
 * Create a corrupted SQLite database for testing error handling
 *
 * This script creates a database with intentional data corruption to trigger
 * database errors that should show error toasts in the UI.
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'corrupted.db');

// Remove existing corrupted DB if present
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
}

const db = new sqlite3.Database(DB_PATH);

// Import the schema from the app
const schemaPath = path.join(__dirname, '../../src/database/schema.ts');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

// Extract CREATE TABLE statements from schema.ts
const createTableRegex = /CREATE TABLE[^;]+;/g;
const createStatements = schemaContent.match(createTableRegex) || [];

console.log('Creating database with schema...');

db.serialize(() => {
  // Create tables
  createStatements.forEach((stmt) => {
    console.log(`Executing: ${stmt.split('\n')[0]}...`);
    db.run(stmt, (err) => {
      if (err) {
        console.error('Error creating table:', err);
      }
    });
  });

  // Create valid test data first
  const medicationId = 'corrupt-test-med-' + Date.now();
  const doseId = 'corrupt-test-dose-' + Date.now();

  console.log('\nInserting valid medication...');
  db.run(
    `INSERT INTO medications (
      id, name, type, dosage_amount, dosage_unit,
      active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      medicationId,
      'Corrupt Test Med',
      'rescue',
      50.0,
      'mg',
      1,
      Date.now(),
      Date.now()
    ],
    (err) => {
      if (err) {
        console.error('Error inserting medication:', err);
        return;
      }

      console.log('Inserting valid dose...');
      db.run(
        `INSERT INTO medication_doses (
          id, medication_id, timestamp, amount,
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          doseId,
          medicationId,
          Date.now(),
          1.0,
          'taken',
          Date.now()
        ],
        (err) => {
          if (err) {
            console.error('Error inserting dose:', err);
            return;
          }

          console.log('\nNow corrupting the database...');

          // Strategy 1: Delete the medication but leave the dose (orphaned foreign key)
          // This is normally prevented by CASCADE DELETE, but we'll disable foreign keys
          db.run('PRAGMA foreign_keys = OFF', (err) => {
            if (err) {
              console.error('Error disabling foreign keys:', err);
              return;
            }

            db.run(
              `DELETE FROM medications WHERE id = ?`,
              [medicationId],
              (err) => {
                if (err) {
                  console.error('Error deleting medication:', err);
                  return;
                }

                // Re-enable foreign keys
                db.run('PRAGMA foreign_keys = ON', (err) => {
                  if (err) {
                    console.error('Error re-enabling foreign keys:', err);
                  }

                  console.log('\n✅ Corrupted database created successfully!');
                  console.log(`   Location: ${DB_PATH}`);
                  console.log(`   Corruption: Orphaned dose (${doseId}) references deleted medication (${medicationId})`);
                  console.log('\nThis database has:');
                  console.log('- 1 orphaned medication_dose record');
                  console.log('- Foreign key constraint that will fail when accessed');

                  db.close((err) => {
                    if (err) {
                      console.error('Error closing database:', err);
                    }
                  });
                });
              }
            );
          });
        }
      );
    }
  );
});
