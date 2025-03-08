import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import crypto from 'crypto';
import cors from 'cors';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.use(cors());
app.use(express.json());

// Serve static files from the client build directory
app.use(express.static(path.join(__dirname, '../../client')));

// Store file hashes for integrity verification
const fileHashes = new Map();

// Helper function to calculate file hash
function calculateFileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

// Helper function to process JSON files and convert to CSV
async function processJsonFiles(extractPath: string) {
  const fitPath = path.join(extractPath, 'Takeout', 'Fit', 'All Data');
  const results: any[] = [];
  
  if (!fs.existsSync(fitPath)) {
    throw new Error('Invalid Google Takeout structure - Fit data not found');
  }

  const files = fs.readdirSync(fitPath);
  
  for (const file of files) {
    if (file.endsWith('.json')) {
      const filePath = path.join(fitPath, file);
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        
        // Extract device information
        const deviceInfo = data.device || 'Unknown Device';
        
        // Process data points
        if (Array.isArray(data)) {
          data.forEach((point: any) => {
            if (point) {
              results.push({
                timestamp: point.startTime || point.timestamp,
                type: file.split('_')[0].replace('derived_com.google.', ''),
                value: point.value?.[0]?.intVal || point.value?.[0]?.fpVal || point.value,
                device: deviceInfo
              });
            }
          });
        }
      } catch (error) {
        console.error(`Error processing file ${file}:`, error);
      }
    }
  }

  if (results.length === 0) {
    throw new Error('No valid data found in the uploaded files');
  }

  // Write to CSV
  const csvWriter = createObjectCsvWriter({
    path: path.join(extractPath, 'processed_data.csv'),
    header: [
      { id: 'timestamp', title: 'Timestamp' },
      { id: 'type', title: 'Data Type' },
      { id: 'value', title: 'Value' },
      { id: 'device', title: 'Device' }
    ]
  });

  await csvWriter.writeRecords(results);
  return results;
}

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.file.originalname.endsWith('.zip')) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Please upload a ZIP file' });
    }

    // Calculate and store file hash
    const fileHash = calculateFileHash(req.file.path);
    fileHashes.set(req.file.filename, fileHash);

    // Extract zip file
    const zip = new AdmZip(req.file.path);
    const extractPath = path.join('uploads', req.file.filename + '_extracted');
    zip.extractAll(extractPath);

    // Process the files
    const processedData = await processJsonFiles(extractPath);

    res.json({
      message: 'File processed successfully',
      hash: fileHash,
      data: processedData
    });
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Error processing file' 
    });
  }
});

app.get('/verify/:fileId', (req, res) => {
  const { fileId } = req.params;
  const storedHash = fileHashes.get(fileId);
  
  if (!storedHash) {
    return res.status(404).json({ error: 'File not found' });
  }

  const filePath = path.join('uploads', fileId);
  const currentHash = calculateFileHash(filePath);
  
  res.json({
    verified: storedHash === currentHash,
    originalHash: storedHash,
    currentHash: currentHash
  });
});

// Catch-all route to serve the frontend for any unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});