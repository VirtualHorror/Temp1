import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs-extra';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// Ensure directories exist
['uploads', 'extracted'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
});

function findFitFiles(dir: string): string[] {
  const results: string[] = [];
  
  function traverse(currentDir: string) {
    try {
      const files = fs.readdirSync(currentDir);
      
      for (const file of files) {
        const fullPath = path.join(currentDir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Look specifically for Takeout/Fit or similar directories
          if (file === 'Fit' || file === 'Takeout' || /fitness/i.test(file)) {
            traverse(fullPath);
          } else if (fullPath.includes('Takeout') || fullPath.includes('Fit')) {
            traverse(fullPath);
          }
        } else if (file.endsWith('.json')) {
          // Only include files that match Google Fit data patterns
          if (
            file.includes('derived_') ||
            file.includes('com.google.') ||
            file.includes('fitness.') ||
            fullPath.includes('/Fit/') ||
            fullPath.includes('/fitness/')
          ) {
            results.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`Error traversing directory ${currentDir}:`, error);
    }
  }
  
  traverse(dir);
  return results;
}

function parseMetricName(filename: string): string {
  // Remove file numbering and extension
  let name = filename.replace(/\s*\(\d+\)\.json$/, '');
  
  // Extract metric name from various patterns
  const patterns = [
    /derived_com\.google\.(.+?)_/,
    /com\.google\.(.+?)\./,
    /fitness\.(.+?)\./,
    /derived_(.+?)_/,
    /(.+?)\.json$/
  ];

  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      return match[1]
        .replace(/_/g, ' ')
        .replace(/\./g, ' ')
        .split(/(?=[A-Z])/)
        .join(' ')
        .toLowerCase()
        .trim();
    }
  }
  
  return name;
}

function extractValue(point: any): any {
  if (!point) return null;

  // Check for common value patterns
  if (point.value !== undefined) {
    if (Array.isArray(point.value)) {
      const firstValue = point.value[0];
      if (firstValue) {
        return firstValue.intVal ?? firstValue.fpVal ?? firstValue.stringVal ?? firstValue;
      }
      return point.value[0];
    }
    return point.value;
  }

  // Check for specific metric values
  const valueFields = [
    'activity',
    'steps',
    'distance',
    'calories',
    'heart_rate',
    'bpm',
    'speed',
    'power',
    'weight',
    'height',
    'sleepSegmentType'
  ];

  for (const field of valueFields) {
    if (point[field] !== undefined) {
      return point[field];
    }
  }

  // Check nested structures
  if (point.fitValue) {
    return point.fitValue.value ?? point.fitValue;
  }

  return null;
}

function getTimestamp(point: any): string | null {
  const timeFields = [
    'startTime',
    'endTime',
    'timestamp',
    'modifiedTime',
    'createTime',
    'lastModifiedTime',
    'originDataSourceId',
    'date'
  ];

  for (const field of timeFields) {
    if (point[field] && typeof point[field] === 'string') {
      const timestamp = new Date(point[field]);
      if (!isNaN(timestamp.getTime())) {
        return timestamp.toISOString();
      }
    }
  }

  return null;
}

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  let extractPath = '';

  try {
    if (!req.file.originalname.toLowerCase().endsWith('.zip')) {
      throw new Error('Please upload a ZIP file from Google Takeout');
    }

    const zip = new AdmZip(req.file.path);
    extractPath = path.join('extracted', req.file.filename);
    
    // Extract the zip file
    zip.extractAllTo(extractPath, true);
    
    // Find all JSON files in Fit directories
    const fitFiles = findFitFiles(extractPath);
    
    if (fitFiles.length === 0) {
      throw new Error('No Google Fit data found in the ZIP file. Please ensure you\'ve uploaded a valid Google Takeout export containing Fit data.');
    }

    console.log(`Found ${fitFiles.length} Fit data files`);

    const allData: any[] = [];
    const devices = new Set<string>();
    const metrics = new Set<string>();

    // Process each file
    for (const filePath of fitFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const metric = parseMetricName(path.basename(filePath));
        metrics.add(metric);
        
        const data = JSON.parse(content);
        const points = Array.isArray(data) ? data : [data];
        
        for (const point of points) {
          // Extract device info
          let device = 'Unknown Device';
          if (point.device) {
            device = typeof point.device === 'string' 
              ? point.device 
              : point.device.name || point.device.manufacturer || point.device.model || 'Unknown Device';
          } else if (point.originDataSourceId) {
            device = point.originDataSourceId;
          }
          devices.add(device);

          // Extract value and timestamp
          const value = extractValue(point);
          const timestamp = getTimestamp(point);

          if (value !== null && timestamp) {
            allData.push({
              timestamp,
              metric,
              value: String(value),
              device
            });
          }
        }
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
      }
    }

    // Clean up
    await fs.remove(req.file.path);
    await fs.remove(extractPath);

    if (allData.length === 0) {
      throw new Error('No valid data found in the files. Please ensure the ZIP file contains Google Fit data in the correct format.');
    }

    // Sort by timestamp
    allData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    console.log(`Processed ${allData.length} data points`);

    res.json({
      success: true,
      data: allData,
      devices: Array.from(devices),
      metrics: Array.from(metrics)
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});