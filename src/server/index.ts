import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import crypto from 'crypto';
import cors from 'cors';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { format, parseISO, subDays, subMonths } from 'date-fns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

// Ensure required directories exist
['uploads', 'processed', 'temp'].forEach(dir => {
  fs.ensureDirSync(dir);
});

app.use(cors());
app.use(express.json());

interface FileMetadata {
  hash: string;
  timestamp: string;
  devices: string[];
  metrics: string[];
}

const fileMetadata = new Map<string, FileMetadata>();

function calculateFileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

function normalizeMetricName(filename: string): string {
  // Remove file numbering like (1), (2) etc.
  filename = filename.replace(/\s*\(\d+\)/, '');
  
  // Extract metric name from various Google Fit file patterns
  const patterns = [
    /derived_com\.google\.(.+?)_/,
    /com\.google\.(.+?)\./,
    /fitness\.(.+?)\./,
    /(.+?)\.json$/
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      return match[1]
        .replace(/_/g, ' ')
        .replace(/\./g, ' ')
        .split(/(?=[A-Z])/).join(' ') // Split camelCase
        .toLowerCase()
        .trim();
    }
  }
  return filename;
}

function findFitDataDirectory(baseDir: string): string[] {
  const fitDirs: string[] = [];
  
  function searchDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (item === 'Fit' || /fitness/i.test(item)) {
          fitDirs.push(fullPath);
        } else {
          searchDir(fullPath);
        }
      }
    }
  }
  
  searchDir(baseDir);
  return fitDirs;
}

async function processJsonFiles(extractPath: string, fileId: string): Promise<any> {
  const fitPaths = findFitDataDirectory(extractPath);
  if (fitPaths.length === 0) {
    throw new Error('Google Fit data not found in the uploaded ZIP file. Please ensure you\'ve uploaded a valid Google Takeout export containing Fit data.');
  }

  const results: any[] = [];
  const devices = new Set<string>();
  const metrics = new Set<string>();

  // Process all files in directory recursively
  async function processDirectory(dirPath: string) {
    const files = await fs.readdir(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fs.stat(filePath);
      
      if (stat.isDirectory()) {
        await processDirectory(filePath);
      } else if (file.toLowerCase().endsWith('.json')) {
        try {
          const fileContent = await fs.readFile(filePath, 'utf8');
          let data;
          try {
            data = JSON.parse(fileContent);
          } catch (e) {
            console.error(`Invalid JSON in file ${file}`);
            continue;
          }
          
          const metricName = normalizeMetricName(file);
          metrics.add(metricName);

          // Handle different data structures
          const dataPoints = Array.isArray(data) ? data : [data];
          
          for (const point of dataPoints) {
            if (!point) continue;

            // Extract device info
            let deviceInfo = 'Unknown Device';
            if (point.device) {
              if (typeof point.device === 'string') {
                deviceInfo = point.device;
              } else if (typeof point.device === 'object') {
                deviceInfo = point.device.name || 
                           point.device.manufacturer || 
                           point.device.model ||
                           point.device.type ||
                           'Unknown Device';
              }
            } else if (point.originDataSourceId) {
              deviceInfo = point.originDataSourceId;
            }
            devices.add(deviceInfo);

            // Extract value and timestamp
            let value = null;
            let timestamp = null;

            // Handle different value formats
            if (point.value !== undefined) {
              if (Array.isArray(point.value)) {
                const firstValue = point.value[0];
                if (firstValue) {
                  value = firstValue.intVal ?? firstValue.fpVal ?? firstValue.stringVal;
                }
              } else {
                value = point.value;
              }
            } else if (point.activity) {
              value = point.activity;
            } else if (point.sleepSegmentType) {
              value = point.sleepSegmentType;
            } else if (point.dataTypeName) {
              value = point.dataTypeName;
            } else if (point.steps !== undefined) {
              value = point.steps;
            } else if (point.distance !== undefined) {
              value = point.distance;
            } else if (point.calories !== undefined) {
              value = point.calories;
            }

            // Handle different timestamp formats
            timestamp = point.startTime || point.endTime || point.timestamp || point.modifiedTime || point.date;

            if (value !== null && timestamp) {
              results.push({
                timestamp,
                metric: metricName,
                value: String(value), // Convert all values to strings for CSV
                device: deviceInfo
              });
            }
          }
        } catch (error) {
          console.error(`Error processing file ${file}:`, error);
        }
      }
    }
  }

  // Process all found Fit directories
  for (const fitPath of fitPaths) {
    await processDirectory(fitPath);
  }

  if (results.length === 0) {
    throw new Error('No valid data found in the uploaded files. Please ensure the ZIP file contains Google Fit data in the correct format.');
  }

  // Sort results by timestamp
  results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Save processed data
  const processedPath = path.join('processed', fileId);
  await fs.ensureDir(processedPath);

  const csvPath = path.join(processedPath, 'processed_data.csv');
  const csvWriter = createObjectCsvWriter({
    path: csvPath,
    header: [
      { id: 'timestamp', title: 'Timestamp' },
      { id: 'metric', title: 'Metric' },
      { id: 'value', title: 'Value' },
      { id: 'device', title: 'Device' }
    ]
  });

  await csvWriter.writeRecords(results);

  // Store metadata
  const devicesArray = Array.from(devices);
  const metricsArray = Array.from(metrics);
  
  fileMetadata.set(fileId, {
    hash: calculateFileHash(csvPath),
    timestamp: new Date().toISOString(),
    devices: devicesArray,
    metrics: metricsArray
  });

  return {
    data: results,
    devices: devicesArray,
    metrics: metricsArray
  };
}

app.post('/upload', upload.single('file'), async (req, res) => {
  let extractPath: string | null = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.file.originalname.endsWith('.zip')) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'Please upload a ZIP file' });
    }

    const fileId = req.file.filename;
    extractPath = path.join('temp', fileId);
    
    // Extract ZIP file
    const zip = new AdmZip(req.file.path);
    zip.extractAllTo(extractPath, true);

    // Process the files
    const processedData = await processJsonFiles(extractPath, fileId);

    // Clean up
    await fs.remove(extractPath);
    await fs.remove(req.file.path);

    res.json({
      message: 'File processed successfully',
      fileId,
      ...processedData
    });
  } catch (error) {
    // Clean up on error
    if (extractPath) {
      await fs.remove(extractPath).catch(console.error);
    }
    if (req.file?.path) {
      await fs.remove(req.file.path).catch(console.error);
    }
    
    console.error('Error processing file:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Error processing file' 
    });
  }
});

app.get('/data/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const { timeRange } = req.query;
  
  const processedPath = path.join('processed', fileId, 'processed_data.csv');
  
  try {
    if (!await fs.pathExists(processedPath)) {
      return res.status(404).json({ error: 'Data not found' });
    }

    const csvContent = await fs.readFile(processedPath, 'utf8');
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const data = lines.slice(1)
      .filter(line => line.trim())
      .map(line => {
        const values = line.split(',');
        const obj: any = {};
        headers.forEach((header, i) => {
          obj[header] = values[i]?.trim();
        });
        return obj;
      });

    // Filter by time range if specified
    let filteredData = data;
    if (timeRange) {
      const now = new Date();
      let startDate: Date;
      
      switch (timeRange) {
        case '1d': startDate = subDays(now, 1); break;
        case '7d': startDate = subDays(now, 7); break;
        case '15d': startDate = subDays(now, 15); break;
        case '1m': startDate = subMonths(now, 1); break;
        case '3m': startDate = subMonths(now, 3); break;
        case '6m': startDate = subMonths(now, 6); break;
        case '12m': startDate = subMonths(now, 12); break;
        default: startDate = new Date(0);
      }
      
      filteredData = data.filter(item => {
        const itemDate = parseISO(item.timestamp);
        return itemDate >= startDate && itemDate <= now;
      });
    }

    res.json({
      data: filteredData,
      metadata: fileMetadata.get(fileId)
    });
  } catch (error) {
    console.error('Error reading data:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Error reading data' 
    });
  }
});

app.get('/verify/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const metadata = fileMetadata.get(fileId);
  
  if (!metadata) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  const processedPath = path.join('processed', fileId, 'processed_data.csv');
  
  try {
    const currentHash = calculateFileHash(processedPath);
    
    res.json({
      verified: metadata.hash === currentHash,
      originalHash: metadata.hash,
      currentHash: currentHash,
      timestamp: metadata.timestamp,
      devices: metadata.devices,
      metrics: metadata.metrics
    });
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Error verifying file integrity' 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});