#!/usr/bin/env node

/**
 * Cleanup Script for Test Upload Files
 * 
 * This script removes test files from the uploads directory that were created during testing.
 * It only removes files that match test patterns to avoid deleting legitimate uploads.
 */

const fs = require('fs');
const path = require('path');

function cleanupTestUploads() {
  const uploadsDir = path.join(__dirname, 'uploads');
  
  if (!fs.existsSync(uploadsDir)) {
    console.log('✅ No uploads directory found - nothing to clean');
    return;
  }

  try {
    const files = fs.readdirSync(uploadsDir);
    let deletedCount = 0;
    let totalSize = 0;

    console.log(`🔍 Scanning uploads directory: ${uploadsDir}`);
    console.log(`📁 Found ${files.length} files`);

    for (const file of files) {
      // Only delete test files (safe patterns)
      const isTestFile = (
        file.match(/^test-\d+/) ||           // test-timestamp-filename
        file.match(/^document-\d+/) ||       // document-timestamp-filename  
        file.includes('test') ||             // any file with 'test' in name
        file.includes('admin-upload') ||     // admin test uploads
        file.endsWith('.tmp') ||             // temporary files
        file.match(/\d{13,}/)               // files with long timestamps
      );

      if (isTestFile) {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
        
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`🗑️  Deleted: ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
      } else {
        console.log(`⚠️  Kept: ${file} (not a test file)`);
      }
    }

    console.log(`\n✅ Cleanup complete!`);
    console.log(`📊 Deleted ${deletedCount} test files`);
    console.log(`💾 Freed ${(totalSize / 1024).toFixed(2)} KB of space`);
    
    if (deletedCount === 0) {
      console.log(`🎉 No test files found - uploads directory is already clean!`);
    }

  } catch (error) {
    console.error(`❌ Error during cleanup:`, error.message);
  }
}

// Run cleanup if this script is called directly
if (require.main === module) {
  cleanupTestUploads();
}

module.exports = { cleanupTestUploads };