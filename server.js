const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const { isVideoFile, isTextFile, matchVideosWithText } = require('./lib/analyzer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Directories
const UPLOADS_DIR = path.join(__dirname, 'temp_uploads');
const EXTRACTS_DIR = path.join(__dirname, 'temp_extracted');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(EXTRACTS_DIR)) fs.mkdirSync(EXTRACTS_DIR, { recursive: true });

// Active Cloudinary config in memory (or from .env)
let activeCloudinaryConfig = {
  cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
  api_key: (process.env.CLOUDINARY_API_KEY || '').trim(),
  api_secret: (process.env.CLOUDINARY_API_SECRET || '').trim(),
  isConfigured: false
};

// Check if initial env has credentials
if (activeCloudinaryConfig.cloud_name && activeCloudinaryConfig.api_key && activeCloudinaryConfig.api_secret) {
  cloudinary.config({
    cloud_name: activeCloudinaryConfig.cloud_name,
    api_key: activeCloudinaryConfig.api_key,
    api_secret: activeCloudinaryConfig.api_secret,
    secure: true
  });
  activeCloudinaryConfig.isConfigured = true;
}

// In-memory Job store & SSE clients
const jobs = new Map();
const sseClients = new Map(); // jobId -> [res]

function broadcastJobUpdate(jobId, event, data) {
  const clients = sseClients.get(jobId) || [];
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(message);
    } catch (e) {
      // client disconnected
    }
  }
}

function logJob(jobId, message, type = 'info') {
  const job = jobs.get(jobId);
  const logEntry = {
    time: new Date().toLocaleTimeString(),
    message,
    type
  };
  if (job) {
    job.logs.push(logEntry);
  }
  broadcastJobUpdate(jobId, 'log', logEntry);
}

// ---------------- CLOUDINARY AUTH ROUTES ----------------

// Verify Cloudinary credentials
app.post('/api/cloudinary/verify', async (req, res) => {
  let { cloud_name, api_key, api_secret, cloudinary_url } = req.body;

  // Sanitize input (strip extra quotes, spaces, CLOUDINARY_URL= prefixes)
  if (cloudinary_url) {
    cloudinary_url = cloudinary_url.replace(/^CLOUDINARY_URL\s*=\s*/i, '').replace(/['"]/g, '').trim();
    const match = cloudinary_url.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
    if (match) {
      api_key = match[1].trim();
      api_secret = match[2].trim();
      cloud_name = match[3].replace(/\/.*$/, '').trim();
    }
  }

  if (cloud_name) cloud_name = cloud_name.replace(/['"]/g, '').trim();
  if (api_key) api_key = api_key.replace(/['"]/g, '').trim();
  if (api_secret) api_secret = api_secret.replace(/['"]/g, '').trim();

  if (!cloud_name || !api_key || !api_secret) {
    return res.status(400).json({
      success: false,
      error: 'Cloud Name, API Key, aur API Secret sabhi zaroori hain.'
    });
  }

  try {
    cloudinary.config({
      cloud_name,
      api_key,
      api_secret,
      secure: true
    });

    // Test API call
    const pingRes = await cloudinary.api.ping();

    if (pingRes && (pingRes.status === 'ok' || pingRes.status === 200)) {
      activeCloudinaryConfig = {
        cloud_name,
        api_key,
        api_secret,
        isConfigured: true
      };

      try {
        const envContent = `CLOUDINARY_CLOUD_NAME=${activeCloudinaryConfig.cloud_name}\nCLOUDINARY_API_KEY=${activeCloudinaryConfig.api_key}\nCLOUDINARY_API_SECRET=${activeCloudinaryConfig.api_secret}\n`;
        fs.writeFileSync(path.join(__dirname, '.env'), envContent, 'utf8');
      } catch (err) {
        console.warn('Could not write to .env', err.message);
      }

      return res.json({
        success: true,
        message: 'Cloudinary successfully connected and verified!',
        cloud_name: activeCloudinaryConfig.cloud_name
      });
    } else {
      return res.status(401).json({
        success: false,
        error: 'Cloudinary response unexpected. Please check credentials.'
      });
    }
  } catch (err) {
    const errorMsg = err.error?.message || err.message || 'Invalid Cloudinary credentials. Please verify your Cloud Name, API Key and API Secret.';
    return res.status(401).json({
      success: false,
      error: errorMsg
    });
  }
});

// Check current config status
app.get('/api/cloudinary/status', (req, res) => {
  res.json({
    isConfigured: activeCloudinaryConfig.isConfigured,
    cloud_name: activeCloudinaryConfig.cloud_name || '',
    masked_key: activeCloudinaryConfig.api_key
      ? activeCloudinaryConfig.api_key.substring(0, 4) + '...' + activeCloudinaryConfig.api_key.slice(-3)
      : ''
  });
});

// Disconnect / logout
app.post('/api/cloudinary/disconnect', (req, res) => {
  activeCloudinaryConfig = {
    cloud_name: '',
    api_key: '',
    api_secret: '',
    isConfigured: false
  };
  try {
    if (fs.existsSync(path.join(__dirname, '.env'))) {
      fs.unlinkSync(path.join(__dirname, '.env'));
    }
  } catch (e) {}
  res.json({ success: true, message: 'Disconnected from Cloudinary.' });
});

// ---------------- MULTI-ZIP UPLOAD & PROCESSING ----------------

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 * 1024 }, // 10GB limit total
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.zip') {
      return cb(new Error('Sirf ZIP file upload karein (.zip only)'));
    }
    cb(null, true);
  }
});

// Step 1: Upload Multiple ZIPs
app.post('/api/upload-zip', upload.array('zipFiles', 50), (req, res) => {
  if (!activeCloudinaryConfig.isConfigured) {
    // Delete files if not configured
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(f => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
    }
    return res.status(400).json({
      success: false,
      error: 'Pehle Cloudinary account connect karein (Credentials required)'
    });
  }

  const uploadedFiles = req.files || (req.file ? [req.file] : []);

  if (uploadedFiles.length === 0) {
    return res.status(400).json({ success: false, error: 'Koi ZIP file select nahi hui.' });
  }

  const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const targetFolder = (req.body.folderName || 'zip_uploads').trim().replace(/[^a-zA-Z0-9_/-]/g, '_');
  const createSubfolders = req.body.createSubfolders === 'true' || req.body.createSubfolders === true;

  const totalSize = uploadedFiles.reduce((acc, f) => acc + f.size, 0);

  const newJob = {
    id: jobId,
    zipFiles: uploadedFiles.map(f => ({
      originalName: f.originalname,
      path: f.path,
      size: f.size
    })),
    extractBaseDir: path.join(EXTRACTS_DIR, jobId),
    targetFolder,
    createSubfolders,
    status: 'uploaded', // 'uploaded', 'extracting', 'analyzing', 'uploading', 'completed', 'failed'
    progressPercent: 0,
    totalZipCount: uploadedFiles.length,
    totalVideos: 0,
    completedVideos: 0,
    failedVideos: 0,
    matchedPairs: [],
    results: [],
    logs: [],
    createdAt: new Date().toISOString()
  };

  jobs.set(jobId, newJob);

  res.json({
    success: true,
    jobId,
    zipCount: uploadedFiles.length,
    totalSize,
    files: uploadedFiles.map(f => ({ name: f.originalname, size: f.size })),
    message: `${uploadedFiles.length} ZIP files upload ho gayi. Processing shuru karne ke liye taiyaar hai.`
  });
});

// Step 2: SSE endpoint for real-time progress
app.get('/api/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!sseClients.has(jobId)) {
    sseClients.set(jobId, []);
  }
  sseClients.get(jobId).push(res);

  // Send initial state
  res.write(`event: init\ndata: ${JSON.stringify(job || { status: 'not_found' })}\n\n`);

  req.on('close', () => {
    const clients = sseClients.get(jobId) || [];
    const idx = clients.indexOf(res);
    if (idx !== -1) clients.splice(idx, 1);
  });
});

// Step 3: Trigger Extraction & Processing
app.post('/api/process/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ success: false, error: 'Job nahi mila.' });
  }

  if (['extracting', 'analyzing', 'uploading'].includes(job.status)) {
    return res.status(400).json({ success: false, error: 'Job pehle se hi process ho raha hai.' });
  }

  // Respond immediately, continue in background
  res.json({ success: true, message: 'Processing shuru ho gayi hai.' });

  // Run async pipeline
  runPipeline(job);
});

// Step 4: Get single job status
app.get('/api/job/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
  res.json({ success: true, job });
});

// Helper: Scan extracted folder recursively
function getAllFilesRecursive(dir, baseDir = dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllFilesRecursive(fullPath, baseDir));
    } else {
      results.push({
        absolutePath: fullPath,
        relativePath: path.relative(baseDir, fullPath).replace(/\\/g, '/'),
        size: stat.size
      });
    }
  }
  return results;
}

// Full execution pipeline for Multi-ZIP
async function runPipeline(job) {
  const jobId = job.id;

  try {
    job.status = 'extracting';
    job.progressPercent = 5;
    logJob(jobId, `Starting extraction of ${job.totalZipCount} ZIP archive(s)...`, 'info');
    broadcastJobUpdate(jobId, 'status', { status: job.status, percent: job.progressPercent });

    if (!fs.existsSync(job.extractBaseDir)) {
      fs.mkdirSync(job.extractBaseDir, { recursive: true });
    }

    const allVideoPairs = [];

    // 1. EXTRACT & SCAN EACH ZIP
    for (let zIdx = 0; zIdx < job.zipFiles.length; zIdx++) {
      const zipItem = job.zipFiles[zIdx];
      const zipNum = zIdx + 1;
      logJob(jobId, `[Archive ${zipNum}/${job.totalZipCount}] Extracting "${zipItem.originalName}"...`, 'info');

      const zipExtractDir = path.join(job.extractBaseDir, `zip_${zIdx}`);
      if (!fs.existsSync(zipExtractDir)) fs.mkdirSync(zipExtractDir, { recursive: true });

      try {
        const zip = new AdmZip(zipItem.path);
        zip.extractAllTo(zipExtractDir, true);

        // Scan this zip
        const zipFiles = getAllFilesRecursive(zipExtractDir);
        logJob(jobId, `--> Scanned ${zipFiles.length} files in "${zipItem.originalName}". Matching videos with metadata...`, 'info');

        const pairs = matchVideosWithText(zipFiles);
        // Tag with source zip info
        pairs.forEach(p => {
          p.sourceZip = zipItem.originalName;
          p.zipIndex = zIdx;
        });

        allVideoPairs.push(...pairs);
        logJob(jobId, `--> Found ${pairs.length} video(s) in "${zipItem.originalName}".`, 'success');

      } catch (zipErr) {
        logJob(jobId, `Error extracting "${zipItem.originalName}": ${zipErr.message}`, 'error');
      }

      const extractProgress = Math.round(5 + ((zIdx + 1) / job.totalZipCount) * 15);
      job.progressPercent = extractProgress;
      broadcastJobUpdate(jobId, 'status', { status: job.status, percent: job.progressPercent });
    }

    job.matchedPairs = allVideoPairs;
    job.totalVideos = allVideoPairs.length;

    if (allVideoPairs.length === 0) {
      logJob(jobId, 'Warning: No video files (.mp4, .mkv, .mov, etc.) were found inside the uploaded ZIP archives!', 'warn');
      job.status = 'completed';
      job.progressPercent = 100;
      broadcastJobUpdate(jobId, 'preview', { pairs: [], total: 0 });
      broadcastJobUpdate(jobId, 'finished', { job });
      cleanupFiles(job);
      return;
    }

    logJob(jobId, `Discovered ${allVideoPairs.length} total video(s) across all archives! Beginning Cloudinary upload stream...`, 'info');
    broadcastJobUpdate(jobId, 'preview', { pairs: allVideoPairs, total: allVideoPairs.length });

    // 2. UPLOAD ALL VIDEOS TO CLOUDINARY
    job.status = 'uploading';
    broadcastJobUpdate(jobId, 'status', { status: job.status, percent: 22 });

    for (let i = 0; i < allVideoPairs.length; i++) {
      const item = allVideoPairs[i];
      const videoNum = i + 1;

      // Determine folder: subfolder per zip or flat folder
      let folderPath = job.targetFolder;
      if (job.createSubfolders) {
        const cleanZipName = item.sourceZip.replace(/\.zip$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        folderPath = `${job.targetFolder}/${cleanZipName}`;
      }

      logJob(jobId, `[Video ${videoNum}/${allVideoPairs.length}] Uploading "${item.fileName}" (Archive: ${item.sourceZip})...`, 'info');

      if (item.matchedTextFile) {
        logJob(jobId, `--> Paired with text: "${item.matchedTextFile}" | Keywords: [${item.metadata.tags.slice(0, 6).join(', ')}${item.metadata.tags.length > 6 ? '...' : ''}]`, 'info');
      } else {
        logJob(jobId, `--> No explicit text file. Generated keywords from video name: [${item.metadata.tags.slice(0, 5).join(', ')}]`, 'info');
      }

      try {
        const cleanBaseName = path.basename(item.fileName, path.extname(item.fileName))
          .replace(/[^a-zA-Z0-9_-]/g, '_');

        const uploadOptions = {
          resource_type: 'video',
          folder: folderPath,
          public_id: `${cleanBaseName}_${Date.now()}`,
          use_filename: true,
          unique_filename: false,
          overwrite: false,
          tags: item.metadata.tags,
          context: {
            title: item.metadata.title || cleanBaseName,
            caption: item.metadata.caption || '',
            description: (item.metadata.description || '').substring(0, 1000),
            original_file: item.fileName,
            source_zip: item.sourceZip
          },
          chunk_size: 10 * 1024 * 1024 // 10MB chunked streaming upload
        };

        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_large(item.videoPath, uploadOptions, (error, result) => {
            if (error) reject(error);
            else resolve(result);
          });
        });

        const successItem = {
          success: true,
          fileName: item.fileName,
          sourceZip: item.sourceZip,
          public_id: uploadResult.public_id,
          secure_url: uploadResult.secure_url,
          playback_url: uploadResult.playback_url || uploadResult.secure_url,
          format: uploadResult.format,
          bytes: uploadResult.bytes,
          duration: uploadResult.duration,
          tags: item.metadata.tags,
          title: item.metadata.title,
          description: item.metadata.description,
          matchedText: item.matchedTextFile,
          folder: folderPath
        };

        job.results.push(successItem);
        job.completedVideos++;
        logJob(jobId, `Successfully uploaded "${item.fileName}"! URL: ${uploadResult.secure_url}`, 'success');

        broadcastJobUpdate(jobId, 'item_complete', successItem);

      } catch (uploadErr) {
        job.failedVideos++;
        const failItem = {
          success: false,
          fileName: item.fileName,
          sourceZip: item.sourceZip,
          error: uploadErr.error?.message || uploadErr.message || 'Upload failed'
        };
        job.results.push(failItem);
        logJob(jobId, `Failed to upload "${item.fileName}": ${failItem.error}`, 'error');
        broadcastJobUpdate(jobId, 'item_failed', failItem);
      }

      // Update progress
      const progressFraction = (i + 1) / allVideoPairs.length;
      job.progressPercent = Math.round(22 + progressFraction * 75);
      broadcastJobUpdate(jobId, 'status', { status: job.status, percent: job.progressPercent });
    }

    job.status = 'completed';
    job.progressPercent = 100;
    logJob(jobId, `Saara kaam poora ho gaya! Kul ${job.totalVideos} videos process hui (${job.completedVideos} successful, ${job.failedVideos} failed).`, 'success');
    broadcastJobUpdate(jobId, 'finished', { job });

  } catch (err) {
    job.status = 'failed';
    logJob(jobId, `Pipeline Error: ${err.message}`, 'error');
    broadcastJobUpdate(jobId, 'status', { status: 'failed', error: err.message });
  } finally {
    cleanupFiles(job);
  }
}

function cleanupFiles(job) {
  try {
    if (job.zipFiles && Array.isArray(job.zipFiles)) {
      job.zipFiles.forEach(f => {
        if (f.path && fs.existsSync(f.path)) {
          fs.unlinkSync(f.path);
        }
      });
    }
    if (job.extractBaseDir && fs.existsSync(job.extractBaseDir)) {
      fs.rmSync(job.extractBaseDir, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn('Cleanup error:', e.message);
  }
}

// Start Server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(` Cloudinary Video & Text Auto-Uploader Server Started! `);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
