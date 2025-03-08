import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs-extra';
import extract from 'extract-zip';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

// Enable CORS
app.use(cors());

// Serve static files from the dist directory
app.use(express.static(join(__dirname, '../dist')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = join(__dirname, 'uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

// Store processed data in memory (replace with proper database in production)
const processedData = new Map();

// Helper function to calculate file hash
function calculateHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

// Helper function to process Google Fit data files
async function processGoogleFitData(extractPath) {
  const fitPath = join(extractPath, 'Takeout', 'Fit', 'Daily activity metrics');
  if (!fs.existsSync(fitPath)) {
    throw new Error('Invalid Google Takeout structure');
  }

  const data = {
    heartRate: [],
    steps: [],
    distance: [],
    calories: [],
    activeMinutes: [],
    sleep: [],
    devices: new Set(),
    fileHash: '',
  };

  const files = await fs.readdir(fitPath);
  
  for (const file of files) {
    if (file.endsWith('.json')) {
      const content = await fs.readJson(join(fitPath, file));
      
      // Extract device information
      if (content.device) {
        data.devices.add(content.device);
      }

      // Process different data types
      if (file.includes('heart_rate')) {
        content.data?.forEach(entry => {
          data.heartRate.push({
            time: new Date(entry.startTime).toISOString(),
            value: entry.value?.[0]?.fpVal || 0
          });
        });
      } else if (file.includes('step_count')) {
        content.data?.forEach(entry => {
          data.steps.push({
            time: new Date(entry.startTime).toISOString(),
            value: entry.value?.[0]?.intVal || 0
          });
        });
      }
      // Add more data type processing as needed
    }
  }

  // Convert devices Set to Array for JSON serialization
  data.devices = Array.from(data.devices);
  
  return data;
}

// Upload and process endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      throw new Error('No file uploaded');
    }

    const uploadedFilePath = req.file.path;
    const fileHash = calculateHash(uploadedFilePath);
    const extractPath = join(__dirname, 'extracted', fileHash);

    // Extract the ZIP file
    await extract(uploadedFilePath, { dir: extractPath });

    // Process the data
    const processedResult = await processGoogleFitData(extractPath);
    processedResult.fileHash = fileHash;

    // Store the processed data
    processedData.set(fileHash, processedResult);

    // Clean up
    await fs.remove(uploadedFilePath);
    await fs.remove(extractPath);

    res.json({
      success: true,
      fileHash,
      message: 'File processed successfully'
    });
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get processed data endpoint
app.get('/api/data/:fileHash', (req, res) => {
  const { fileHash } = req.params;
  const data = processedData.get(fileHash);
  
  if (!data) {
    res.status(404).json({
      success: false,
      error: 'Data not found'
    });
    return;
  }

  res.json({
    success: true,
    data
  });
});

// Handle client-side routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});