import fs from 'fs';
import csv from 'csv-parser';

// Configuration
const inputCSV = './kabupaten-kota-dengan-koordinat-db.csv';
const outputSQL = './update-coordinates.sql';

// Create write stream for SQL output
const output = fs.createWriteStream(outputSQL);

// Add initial comment
output.write(`-- AUTO-GENERATED COORDINATE UPDATE SCRIPT\n`);
output.write(`-- Generated at ${new Date().toISOString()}\n\n`);

// Process CSV
fs.createReadStream(inputCSV)
  .pipe(csv({
    separator: ';', // Use semicolon delimiter
    headers: ['id', 'name', 'province_id', 'latitude', 'longitude'],
    skipLines: 1 // Skip header row
  }))
  .on('data', (row) => {
    // Generate UPDATE statement
    const sql = `UPDATE "public"."kabupaten-kota" SET 
      latitude = ${parseFloat(row.latitude)}, 
      longitude = ${parseFloat(row.longitude)}
      WHERE id = '${row.id}';\n`;
    
    output.write(sql);
  })
  .on('end', () => {
    console.log(`✅ Generated ${outputSQL}`);
    console.log(`⚠️ Review the SQL before executing in Supabase!`);
    output.end();
  })
  .on('error', (err) => {
    console.error('Error processing CSV:', err);
    process.exit(1);
  });