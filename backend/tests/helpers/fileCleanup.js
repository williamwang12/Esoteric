// File upload test utilities with automatic cleanup
const fs = require('fs').promises;
const path = require('path');

class FileTestManager {
  constructor() {
    this.testUploadDir = './test-uploads';
    this.createdFiles = [];
    this.ensureTestEnvironment();
  }

  ensureTestEnvironment() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('FileTestManager can only be used in test environment!');
    }
  }

  async setupTestDirectory() {
    // Create isolated test upload directory
    try {
      await fs.access(this.testUploadDir);
    } catch {
      await fs.mkdir(this.testUploadDir, { recursive: true });
      console.log(`✅ Created test upload directory: ${this.testUploadDir}`);
    }
  }

  async createTestFile(filename, content = 'Test file content') {
    await this.setupTestDirectory();
    const filePath = path.join(this.testUploadDir, filename);
    await fs.writeFile(filePath, content);
    this.createdFiles.push(filePath);
    return filePath;
  }

  async cleanupTestFiles() {
    // Clean up all created test files
    for (const filePath of this.createdFiles) {
      try {
        await fs.unlink(filePath);
        console.log(`🗑️ Deleted test file: ${filePath}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(`⚠️ Failed to delete test file: ${filePath}`, error.message);
        }
      }
    }
    this.createdFiles = [];

    // Clean up any remaining files in test upload directory
    try {
      const files = await fs.readdir(this.testUploadDir);
      for (const file of files) {
        const filePath = path.join(this.testUploadDir, file);
        try {
          await fs.unlink(filePath);
          console.log(`🗑️ Cleaned up remaining file: ${filePath}`);
        } catch (error) {
          console.warn(`⚠️ Failed to clean remaining file: ${filePath}`, error.message);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('⚠️ Failed to clean test upload directory:', error.message);
      }
    }
  }

  // Generate test file buffers for uploads
  generateTestPDF(content = 'Test PDF Content') {
    // Create a minimal but valid PDF
    const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj
4 0 obj<</Length ${content.length + 20}>>stream
BT
/F1 12 Tf
100 700 Td
(${content}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000125 00000 n 
0000000200 00000 n 
trailer<</Size 5/Root 1 0 R>>
startxref
${300 + content.length}
%%EOF`;
    return Buffer.from(pdfContent);
  }

  generateTestImage() {
    // Minimal 1x1 PNG file (valid PNG signature and structure)
    return Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
      0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x46, 0xD0, 0x94, 0x97, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
      0x42, 0x60, 0x82 // IEND chunk
    ]);
  }

  generateTestTextFile(content = 'Test document content') {
    return Buffer.from(content);
  }

  generateLargePDF() {
    // Generate a PDF larger than typical limits for testing file size validation
    const largeContent = 'A'.repeat(1000000); // 1MB of 'A' characters
    return this.generateTestPDF(largeContent);
  }

  generateInvalidFile() {
    // Generate an invalid file for testing file validation
    return Buffer.from('This is not a valid PDF or image file');
  }

  // Helper to create test file with specific extension
  async createTestFileWithExtension(extension, content) {
    const filename = `test-${Date.now()}.${extension}`;
    let buffer;
    
    switch (extension.toLowerCase()) {
      case 'pdf':
        buffer = typeof content === 'string' ? this.generateTestPDF(content) : content;
        break;
      case 'png':
      case 'jpg':
      case 'jpeg':
        buffer = content || this.generateTestImage();
        break;
      case 'txt':
        buffer = this.generateTestTextFile(content);
        break;
      default:
        buffer = Buffer.from(content || 'Test file content');
    }

    await this.setupTestDirectory();
    const filePath = path.join(this.testUploadDir, filename);
    await fs.writeFile(filePath, buffer);
    this.createdFiles.push(filePath);
    
    return {
      path: filePath,
      filename: filename,
      buffer: buffer,
      size: buffer.length
    };
  }

  // Get test upload directory path
  getTestUploadDir() {
    return this.testUploadDir;
  }

  // Get list of created files for verification
  getCreatedFiles() {
    return [...this.createdFiles];
  }
}

module.exports = FileTestManager;