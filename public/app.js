// Cloudinary Multi-ZIP Auto-Uploader
// Native Client-Side Streaming Engine: Extracts & Uploads As Files Are Unpacked

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const headerStatusBadge = document.getElementById('headerStatusBadge');
  const disconnectBtn = document.getElementById('disconnectBtn');

  // Auth Section
  const authSection = document.getElementById('authSection');
  const authConnectedCard = document.getElementById('authConnectedCard');
  const connectedCloudNameDisplay = document.getElementById('connectedCloudNameDisplay');
  const btnToggleAuthForm = document.getElementById('btnToggleAuthForm');
  const authFormWrapper = document.getElementById('authFormWrapper');
  const authForm = document.getElementById('authForm');
  const cloudNameInput = document.getElementById('cloudName');
  const apiKeyInput = document.getElementById('apiKey');
  const apiSecretInput = document.getElementById('apiSecret');
  const cloudinaryUrlInput = document.getElementById('cloudinaryUrl');
  const togglePwBtn = document.getElementById('togglePwBtn');
  const pwEyeIcon = document.getElementById('pwEyeIcon');
  const btnConnect = document.getElementById('btnConnect');
  const authAlert = document.getElementById('authAlert');

  // Upload Section
  const uploadSection = document.getElementById('uploadSection');
  const dropzone = document.getElementById('dropzone');
  const zipFileInput = document.getElementById('zipFileInput');
  const dropzoneEmpty = document.getElementById('dropzoneEmpty');
  const dropzoneSelected = document.getElementById('dropzoneSelected');
  const selectedZipCount = document.getElementById('selectedZipCount');
  const selectedTotalSize = document.getElementById('selectedTotalSize');
  const zipFilesList = document.getElementById('zipFilesList');
  const btnAddMoreZips = document.getElementById('btnAddMoreZips');
  const btnClearAllZips = document.getElementById('btnClearAllZips');
  const folderNameInput = document.getElementById('folderName');
  const subfolderToggle = document.getElementById('subfolderToggle');
  const autoStartToggle = document.getElementById('autoStartToggle');
  const btnStartUpload = document.getElementById('btnStartUpload');
  const uploadProgressContainer = document.getElementById('uploadProgressContainer');
  const uploadProgressLabel = document.getElementById('uploadProgressLabel');
  const uploadProgressPercent = document.getElementById('uploadProgressPercent');
  const uploadProgressBar = document.getElementById('uploadProgressBar');

  // Processing Section
  const processingSection = document.getElementById('processingSection');
  const jobStatusBadge = document.getElementById('jobStatusBadge');
  const completedCount = document.getElementById('completedCount');
  const totalCount = document.getElementById('totalCount');
  const failedCount = document.getElementById('failedCount');
  const overallPercent = document.getElementById('overallPercent');
  const pipelineProgressBar = document.getElementById('pipelineProgressBar');
  const terminalLogs = document.getElementById('terminalLogs');
  const clearLogsBtn = document.getElementById('clearLogsBtn');

  // Results Section
  const resultsSection = document.getElementById('resultsSection');
  const resultsGrid = document.getElementById('resultsGrid');
  const filterResultsInput = document.getElementById('filterResultsInput');
  const btnClearFilter = document.getElementById('btnClearFilter');
  const filterCountBadge = document.getElementById('filterCountBadge');
  const btnExportJson = document.getElementById('btnExportJson');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnNewBatch = document.getElementById('btnNewBatch');

  // State
  let selectedFiles = []; // Array of File objects
  let completedItems = [];
  let isProcessing = false;
  let cancelRequested = false;

  const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.flv', '.m4v', '.3gp', '.ts']);
  const TEXT_EXTENSIONS = new Set(['.txt', '.json', '.caption', '.md', '.sub', '.srt']);

  const COMMON_STOP_WORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are',
    'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
    'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for',
    'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
    'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'me', 'more',
    'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
    'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some',
    'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these',
    'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we',
    'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you',
    'your', 'yours', 'yourself', 'yourselves', 'video', 'file', 'mp4', 'mkv', 'clip', 'shorts', 'youtube'
  ]);

  // About Modal
  const btnOpenAboutModal = document.getElementById('btnOpenAboutModal');
  const btnCloseAboutModal = document.getElementById('btnCloseAboutModal');
  const aboutModal = document.getElementById('aboutModal');

  if (btnOpenAboutModal && aboutModal) {
    btnOpenAboutModal.addEventListener('click', () => {
      aboutModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      lucide.createIcons();
    });
  }

  if (btnCloseAboutModal && aboutModal) {
    btnCloseAboutModal.addEventListener('click', () => {
      aboutModal.classList.add('hidden');
      document.body.style.overflow = '';
    });
  }

  if (aboutModal) {
    aboutModal.addEventListener('click', (e) => {
      if (e.target === aboutModal) {
        aboutModal.classList.add('hidden');
        document.body.style.overflow = '';
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !aboutModal.classList.contains('hidden')) {
        aboutModal.classList.add('hidden');
        document.body.style.overflow = '';
      }
    });
  }

  // Initialize icons
  lucide.createIcons();

  // Load Saved Cloudinary Credentials
  loadSavedCredentials();

  function loadSavedCredentials() {
    const savedName = localStorage.getItem('cld_cloud_name');
    const savedKey = localStorage.getItem('cld_api_key');
    const savedSecret = localStorage.getItem('cld_api_secret');

    if (savedName) cloudNameInput.value = savedName;
    if (savedKey) apiKeyInput.value = savedKey;
    if (savedSecret) apiSecretInput.value = savedSecret;

    if (savedName && savedKey && savedSecret) {
      setCloudinaryConnected(savedName);
    }
  }

  function setCloudinaryConnected(cloudName) {
    headerStatusBadge.innerHTML = `
      <span class="status-dot online"></span>
      <span class="status-text">Connected: <strong>${escapeHtml(cloudName)}</strong></span>
      <button id="disconnectBtn" class="btn-sm btn-ghost" title="Disconnect Account">
        <i data-lucide="log-out"></i>
      </button>
    `;
    lucide.createIcons();

    document.getElementById('disconnectBtn').addEventListener('click', disconnectCloudinary);

    if (authConnectedCard && connectedCloudNameDisplay) {
      connectedCloudNameDisplay.textContent = cloudName;
      authConnectedCard.classList.remove('hidden');
      authFormWrapper.classList.add('hidden');
    }

    uploadSection.classList.remove('disabled-blur');
    cloudNameInput.value = cloudName;
  }

  // Toggle Edit/Change Auth Form
  if (btnToggleAuthForm) {
    btnToggleAuthForm.addEventListener('click', () => {
      authFormWrapper.classList.toggle('hidden');
      const isExpanded = !authFormWrapper.classList.contains('hidden');
      btnToggleAuthForm.innerHTML = isExpanded
        ? `<i data-lucide="chevron-up"></i> Close Form`
        : `<i data-lucide="settings-2"></i> Change Account`;
      lucide.createIcons();
    });
  }

  // Toggle Password Visibility
  togglePwBtn.addEventListener('click', () => {
    if (apiSecretInput.type === 'password') {
      apiSecretInput.type = 'text';
      pwEyeIcon.setAttribute('data-lucide', 'eye-off');
    } else {
      apiSecretInput.type = 'password';
      pwEyeIcon.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons();
  });

  // Handle CLOUDINARY_URL quick parse
  cloudinaryUrlInput.addEventListener('input', () => {
    let val = cloudinaryUrlInput.value.trim();
    val = val.replace(/^CLOUDINARY_URL\s*=\s*/i, '').replace(/['"]/g, '');
    const match = val.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
    if (match) {
      apiKeyInput.value = match[1].trim();
      apiSecretInput.value = match[2].trim();
      cloudNameInput.value = match[3].replace(/\/.*$/, '').trim();
    }
  });

  // SHA-1 Signature using Web Crypto API
  async function generateSignature(params, apiSecret) {
    const sortedKeys = Object.keys(params).sort();
    const toSign = sortedKeys.map(k => `${k}=${params[k]}`).join('&') + apiSecret;

    const encoder = new TextEncoder();
    const data = encoder.encode(toSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Auth Form Submit
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cloudName = cloudNameInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const apiSecret = apiSecretInput.value.trim();

    if (!cloudName || !apiKey || !apiSecret) {
      alert('Please enter Cloud Name, API Key, and API Secret.');
      return;
    }

    btnConnect.disabled = true;
    btnConnect.innerHTML = `<span class="spinner"></span> Verifying...`;
    authAlert.classList.add('hidden');

    try {
      // Test credentials with a signed 1x1 test verification
      const timestamp = Math.round(Date.now() / 1000);
      const testParams = {
        public_id: `_verify_test_${Date.now()}`,
        timestamp: String(timestamp)
      };

      const sig = await generateSignature(testParams, apiSecret);

      const tiny1px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAArows=';
      const byteString = atob(tiny1px.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const testBlob = new Blob([ab], { type: 'image/png' });

      const formData = new FormData();
      formData.append('file', testBlob);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp);
      formData.append('signature', sig);
      formData.append('public_id', testParams.public_id);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });

      const resData = await res.json();

      if (res.ok && resData.secure_url) {
        // Save in localStorage
        localStorage.setItem('cld_cloud_name', cloudName);
        localStorage.setItem('cld_api_key', apiKey);
        localStorage.setItem('cld_api_secret', apiSecret);

        setCloudinaryConnected(cloudName);
        authAlert.className = 'alert-message success';
        authAlert.textContent = `Connected to Cloudinary account: ${cloudName}`;
        authAlert.classList.remove('hidden');
      } else {
        throw new Error(resData.error?.message || 'Invalid Cloudinary credentials.');
      }

    } catch (err) {
      authAlert.className = 'alert-message error';
      authAlert.textContent = 'Connection Error: ' + err.message;
      authAlert.classList.remove('hidden');
    } finally {
      btnConnect.disabled = false;
      btnConnect.innerHTML = `<i data-lucide="shield-check"></i><span>Connect & Verify Account</span>`;
      lucide.createIcons();
    }
  });

  // Disconnect Cloudinary
  function disconnectCloudinary() {
    if (!confirm('Are you sure you want to disconnect your Cloudinary credentials?')) return;
    localStorage.removeItem('cld_cloud_name');
    localStorage.removeItem('cld_api_key');
    localStorage.removeItem('cld_api_secret');
    window.location.reload();
  }

  // Multi-File Dropzone & Selection
  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('.zip-file-item')) return;
    zipFileInput.click();
  });

  btnAddMoreZips.addEventListener('click', (e) => {
    e.stopPropagation();
    zipFileInput.click();
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  });

  zipFileInput.addEventListener('change', () => {
    if (zipFileInput.files && zipFileInput.files.length > 0) {
      handleFiles(Array.from(zipFileInput.files));
    }
  });

  function handleFiles(newFiles) {
    let nonZipCount = 0;
    for (const file of newFiles) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        nonZipCount++;
        continue;
      }
      const exists = selectedFiles.some(f => f.name === file.name && f.size === file.size);
      if (!exists) {
        selectedFiles.push(file);
      }
    }

    if (nonZipCount > 0) {
      alert(`${nonZipCount} non-ZIP file(s) were skipped.`);
    }

    updateSelectedUI();
  }

  function updateSelectedUI() {
    if (selectedFiles.length === 0) {
      dropzoneEmpty.classList.remove('hidden');
      dropzoneSelected.classList.add('hidden');
      btnStartUpload.disabled = true;
      zipFileInput.value = '';
      return;
    }

    dropzoneEmpty.classList.add('hidden');
    dropzoneSelected.classList.remove('hidden');
    btnStartUpload.disabled = false;

    selectedZipCount.textContent = `${selectedFiles.length} ZIP archive${selectedFiles.length > 1 ? 's' : ''} selected`;
    const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);
    selectedTotalSize.textContent = `${formatBytes(totalBytes)} total`;

    zipFilesList.innerHTML = '';
    // Show top 100 in DOM for performance if there are 700+ files
    const displayFiles = selectedFiles.slice(0, 100);
    displayFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'zip-file-item';
      item.innerHTML = `
        <div class="zip-file-info">
          <i data-lucide="archive"></i>
          <span class="zip-file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
        </div>
        <span class="zip-file-size">${formatBytes(file.size)}</span>
        <button type="button" class="btn-remove-single-zip" data-index="${index}" title="Remove this ZIP">
          <i data-lucide="x"></i>
        </button>
      `;
      zipFilesList.appendChild(item);
    });

    if (selectedFiles.length > 100) {
      const extraNotice = document.createElement('div');
      extraNotice.style.fontSize = '0.75rem';
      extraNotice.style.color = '#94a3b8';
      extraNotice.style.padding = '4px 8px';
      extraNotice.textContent = `...and ${selectedFiles.length - 100} more archives ready for ingestion`;
      zipFilesList.appendChild(extraNotice);
    }

    lucide.createIcons();

    document.querySelectorAll('.btn-remove-single-zip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        selectedFiles.splice(idx, 1);
        updateSelectedUI();
      });
    });
  }

  btnClearAllZips.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedFiles = [];
    updateSelectedUI();
  });

  // Natural Language & Metadata Analysis
  function cleanTag(tag) {
    if (!tag) return '';
    return tag.replace(/[#,\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function deriveTagsFromText(text) {
    if (!text) return [];
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s_\-\u0900-\u097F]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !COMMON_STOP_WORDS.has(w) && !/^\d+$/.test(w));

    const counts = new Map();
    for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0])
      .slice(0, 15);
  }

  function parseTextMetadata(rawText, fallbackTitle = '') {
    const text = (rawText || '').trim();
    const tagsSet = new Set();
    let title = fallbackTitle;
    let description = '';
    let caption = '';

    if (!text) {
      return {
        title,
        description,
        caption,
        tags: deriveTagsFromText(fallbackTitle)
      };
    }

    // Check JSON
    if (text.startsWith('{') && text.endsWith('}')) {
      try {
        const data = JSON.parse(text);
        if (data.title) title = String(data.title);
        if (data.description) description = String(data.description);
        if (data.caption) caption = String(data.caption);
        const rawTags = data.tags || data.keywords || [];
        if (Array.isArray(rawTags)) {
          rawTags.forEach(t => { const c = cleanTag(String(t)); if (c) tagsSet.add(c); });
        }
        if (tagsSet.size > 0) {
          return { title, description: description || caption, caption, tags: Array.from(tagsSet) };
        }
      } catch (e) {}
    }

    // Line by line extraction
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const titleMatch = trimmed.match(/^(?:title|name|video title)\s*[:=-]\s*(.+)$/i);
      if (titleMatch) { title = titleMatch[1].trim(); continue; }

      const descMatch = trimmed.match(/^(?:description|desc|details?|caption|summary)\s*[:=-]\s*(.+)$/i);
      if (descMatch) { description = descMatch[1].trim(); continue; }

      const tagsMatch = trimmed.match(/^(?:keywords?|tags?|hashtags?|keys?)\s*[:=-]\s*(.+)$/i);
      if (tagsMatch) {
        tagsMatch[1].split(/[,;\t|]/).forEach(t => {
          const c = cleanTag(t);
          if (c) tagsSet.add(c);
        });
        continue;
      }

      const hashtags = trimmed.match(/#([a-zA-Z0-9_\u0900-\u097F]+)/g);
      if (hashtags) {
        hashtags.forEach(ht => {
          const c = cleanTag(ht.replace(/^#/, ''));
          if (c) tagsSet.add(c);
        });
      }
    }

    if (tagsSet.size === 0) {
      if (text.includes(',') && !text.includes('\n\n')) {
        text.split(/[,;\n]/).forEach(p => {
          const c = cleanTag(p);
          if (c && c.length <= 40) tagsSet.add(c);
        });
      } else {
        deriveTagsFromText(text).forEach(t => tagsSet.add(t));
        if (!description) description = text.substring(0, 300);
      }
    }

    if (tagsSet.size < 3 && title) {
      deriveTagsFromText(title).forEach(t => tagsSet.add(t));
    }

    return {
      title: title || fallbackTitle,
      description: description || caption || text.substring(0, 300),
      caption: caption || title || fallbackTitle,
      tags: Array.from(tagsSet).slice(0, 30)
    };
  }

  function cleanContextVal(str, maxLen = 800) {
    if (!str) return '';
    return String(str)
      .replace(/[|=]/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, maxLen);
  }

  function buildContextString(meta, zipName = '') {
    const parts = [];
    const cleanTitle = cleanContextVal(meta.title, 250);
    const cleanDesc = cleanContextVal(meta.description, 800);
    const cleanCaption = cleanContextVal(meta.caption, 250);
    const cleanZip = cleanContextVal(zipName, 200);

    if (cleanTitle) parts.push(`title=${cleanTitle}`);
    if (cleanDesc) parts.push(`description=${cleanDesc}`);
    if (cleanCaption && cleanCaption !== cleanTitle) parts.push(`caption=${cleanCaption}`);
    if (cleanZip) parts.push(`source_zip=${cleanZip}`);

    return parts.join('|');
  }

  function getFileExt(filename) {
    const idx = filename.lastIndexOf('.');
    return idx === -1 ? '' : filename.substring(idx).toLowerCase();
  }

  function getFileBaseName(filename) {
    const name = filename.split('/').pop();
    const idx = name.lastIndexOf('.');
    return idx === -1 ? name : name.substring(0, idx);
  }

  // ---------------- STREAMING PIPELINE ----------------
  // Real-time Extraction -> Immediate Upload -> Real-Time Card Injection
  btnStartUpload.addEventListener('click', async () => {
    if (selectedFiles.length === 0 || isProcessing) return;

    const cloudName = localStorage.getItem('cld_cloud_name');
    const apiKey = localStorage.getItem('cld_api_key');
    const apiSecret = localStorage.getItem('cld_api_secret');

    if (!cloudName || !apiKey || !apiSecret) {
      alert('Please connect your Cloudinary account first.');
      return;
    }

    if (typeof JSZip === 'undefined') {
      alert('JSZip library is loading. Please check your internet connection and try again.');
      return;
    }

    isProcessing = true;
    btnStartUpload.disabled = true;
    cancelRequested = false;

    processingSection.classList.remove('hidden');
    processingSection.scrollIntoView({ behavior: 'smooth' });

    jobStatusBadge.textContent = 'STREAMING UPLOADS';
    jobStatusBadge.style.background = 'rgba(6, 182, 212, 0.15)';
    jobStatusBadge.style.color = '#06b6d4';

    terminalLogs.innerHTML = '';
    completedItems = [];
    resultsGrid.innerHTML = '';
    completedCount.textContent = '0';
    failedCount.textContent = '0';
    totalCount.textContent = 'Estimating...';

    const rootFolder = (folderNameInput.value.trim() || 'zip_uploads').replace(/[^a-zA-Z0-9_/-]/g, '_');
    const createSubfolders = subfolderToggle.checked;

    appendTerminalLog(nowTime(), `🚀 Starting Streaming Ingestion of ${selectedFiles.length} ZIP archives...`, 'info');

    let totalVideosDiscovered = 0;
    let completedVideosCount = 0;
    let failedVideosCount = 0;

    for (let zIdx = 0; zIdx < selectedFiles.length; zIdx++) {
      if (cancelRequested) break;

      const currentZipFile = selectedFiles[zIdx];
      const archiveNum = zIdx + 1;

      appendTerminalLog(nowTime(), `[Archive ${archiveNum}/${selectedFiles.length}] Unpacking "${currentZipFile.name}" (${formatBytes(currentZipFile.size)})...`, 'info');

      let zip;
      try {
        zip = await JSZip.loadAsync(currentZipFile);
      } catch (err) {
        appendTerminalLog(nowTime(), `Error reading ZIP "${currentZipFile.name}": ${err.message}`, 'error');
        failedVideosCount++;
        failedCount.textContent = failedVideosCount;
        continue;
      }

      // Collect all text entries and video entries in this archive
      const textFiles = [];
      const videoFiles = [];

      for (const [relativePath, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        const ext = getFileExt(relativePath);
        if (TEXT_EXTENSIONS.has(ext)) {
          textFiles.push({ relativePath, entry });
        } else if (VIDEO_EXTENSIONS.has(ext)) {
          videoFiles.push({ relativePath, entry });
        }
      }

      if (videoFiles.length === 0) {
        appendTerminalLog(nowTime(), `--> No video files found in "${currentZipFile.name}".`, 'warn');
        continue;
      }

      totalVideosDiscovered += videoFiles.length;
      totalCount.textContent = `${totalVideosDiscovered}+`;

      // Read all text files in memory
      const textContents = {};
      for (const tf of textFiles) {
        try {
          textContents[tf.relativePath] = await tf.entry.async('string');
        } catch (e) {
          textContents[tf.relativePath] = '';
        }
      }

      // AS EACH VIDEO IS EXTRACTED, IMMEDIATELY STREAM UPLOAD IT TO CLOUDINARY!
      for (let vIdx = 0; vIdx < videoFiles.length; vIdx++) {
        if (cancelRequested) break;

        const { relativePath, entry } = videoFiles[vIdx];
        const fileName = relativePath.split('/').pop();
        const baseName = getFileBaseName(fileName);

        // Find matching text file
        let matchedTextContent = '';
        let matchedTextPath = null;

        // 1. Exact base match in same dir
        for (const [tPath, content] of Object.entries(textContents)) {
          if (getFileBaseName(tPath).toLowerCase() === baseName.toLowerCase()) {
            matchedTextContent = content;
            matchedTextPath = tPath;
            break;
          }
        }
        // 2. Fallback to any text in archive
        if (!matchedTextContent && textFiles.length > 0) {
          const firstPath = textFiles[0].relativePath;
          matchedTextContent = textContents[firstPath] || '';
          matchedTextPath = firstPath;
        }

        const metadata = parseTextMetadata(matchedTextContent, baseName.replace(/[_-]+/g, ' '));

        appendTerminalLog(nowTime(), `Extracting "${fileName}" & preparing upload...`, 'info');

        // Extract video blob
        let videoBlob;
        try {
          videoBlob = await entry.async('blob');
        } catch (extractErr) {
          appendTerminalLog(nowTime(), `Failed to extract "${fileName}": ${extractErr.message}`, 'error');
          failedVideosCount++;
          failedCount.textContent = failedVideosCount;
          continue;
        }

        // Determine destination folder
        let folderPath = rootFolder;
        if (createSubfolders) {
          const cleanZipName = currentZipFile.name.replace(/\.zip$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
          folderPath = `${rootFolder}/${cleanZipName}`;
        }

        const cleanPublicId = `${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`;
        const tagsString = (metadata.tags || []).join(',');

        appendTerminalLog(nowTime(), `--> Uploading "${fileName}" to Cloudinary (Tags: [${metadata.tags.slice(0, 5).join(', ')}])...`, 'info');

        try {
          // Prepare signed parameters with Contextual Metadata
          const timestamp = Math.round(Date.now() / 1000);
          const contextString = buildContextString(metadata, currentZipFile.name);

          const uploadParams = {
            folder: folderPath,
            public_id: cleanPublicId,
            timestamp: String(timestamp)
          };
          if (tagsString) {
            uploadParams.tags = tagsString;
          }
          if (contextString) {
            uploadParams.context = contextString;
          }

          const signature = await generateSignature(uploadParams, apiSecret);

          // Build multipart form data
          const uploadFormData = new FormData();
          uploadFormData.append('file', videoBlob, fileName);
          uploadFormData.append('api_key', apiKey);
          uploadFormData.append('timestamp', timestamp);
          uploadFormData.append('signature', signature);
          uploadFormData.append('folder', folderPath);
          uploadFormData.append('public_id', cleanPublicId);
          if (tagsString) {
            uploadFormData.append('tags', tagsString);
          }
          if (contextString) {
            uploadFormData.append('context', contextString);
          }

          // Direct Cloudinary Upload via XHR
          const uploadResult = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, true);

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  resolve(JSON.parse(xhr.responseText));
                } catch (e) {
                  reject(new Error('Invalid response from Cloudinary'));
                }
              } else {
                try {
                  const errData = JSON.parse(xhr.responseText);
                  reject(new Error(errData.error?.message || `HTTP ${xhr.status}`));
                } catch (e) {
                  reject(new Error(`Upload failed with HTTP ${xhr.status}`));
                }
              }
            };

            xhr.onerror = () => reject(new Error('Network error during upload'));
            xhr.send(uploadFormData);
          });

          // Success item
          completedVideosCount++;
          completedCount.textContent = completedVideosCount;

          const itemData = {
            success: true,
            fileName: fileName,
            sourceZip: currentZipFile.name,
            public_id: uploadResult.public_id,
            secure_url: uploadResult.secure_url,
            format: uploadResult.format,
            bytes: uploadResult.bytes || videoBlob.size,
            duration: uploadResult.duration,
            tags: metadata.tags,
            title: metadata.title,
            description: metadata.description,
            matchedText: matchedTextPath
          };

          completedItems.push(itemData);
          appendResultCard(itemData);
          resultsSection.classList.remove('hidden');

          appendTerminalLog(nowTime(), `✅ Uploaded "${fileName}"! URL: ${uploadResult.secure_url}`, 'success');

        } catch (uploadError) {
          failedVideosCount++;
          failedCount.textContent = failedVideosCount;
          appendTerminalLog(nowTime(), `❌ Failed to upload "${fileName}": ${uploadError.message}`, 'error');
        }

        // Update overall percentage
        const overallFraction = (archiveNum / selectedFiles.length);
        const percent = Math.min(99, Math.round(overallFraction * 100));
        pipelineProgressBar.style.width = percent + '%';
        overallPercent.textContent = percent + '%';
      }
    }

    // Finished
    totalCount.textContent = totalVideosDiscovered;
    pipelineProgressBar.style.width = '100%';
    overallPercent.textContent = '100%';

    jobStatusBadge.textContent = 'COMPLETED';
    jobStatusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
    jobStatusBadge.style.color = '#34d399';

    appendTerminalLog(nowTime(), `🎉 All processing finished! ${completedVideosCount} video(s) uploaded successfully (${failedVideosCount} failed).`, 'success');
    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth' });

    isProcessing = false;
    btnStartUpload.disabled = false;
  });

  function nowTime() {
    return new Date().toLocaleTimeString();
  }

  // Terminal Log Append
  function appendTerminalLog(time, message, type = 'info') {
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-text">${escapeHtml(message)}</span>`;
    terminalLogs.appendChild(line);
    terminalLogs.scrollTop = terminalLogs.scrollHeight;
  }

  clearLogsBtn.addEventListener('click', () => {
    terminalLogs.innerHTML = '';
  });

  // Results Card
  function appendResultCard(item) {
    const card = document.createElement('div');
    card.className = 'result-card';

    const tagsHtml = (item.tags || [])
      .map(tag => `<span class="keyword-pill">#${escapeHtml(tag)}</span>`)
      .join('');

    const formattedBytes = formatBytes(item.bytes || 0);
    const durationSec = item.duration ? `${Math.round(item.duration)}s` : '';
    const sourceZipLabel = item.sourceZip ? escapeHtml(item.sourceZip) : '';
    const displayTitle = item.title || item.fileName;
    const descSnippet = item.description ? escapeHtml(item.description) : '';

    const searchBlob = `${displayTitle} ${item.description || ''} ${item.fileName || ''} ${(item.tags || []).join(' ')} ${item.sourceZip || ''}`.toLowerCase();
    card.setAttribute('data-search', searchBlob);

    card.innerHTML = `
      <div class="result-video-wrap">
        ${sourceZipLabel ? `<span class="source-zip-pill"><i data-lucide="archive"></i> ${sourceZipLabel}</span>` : ''}
        <video controls preload="metadata">
          <source src="${item.secure_url}" type="video/${item.format || 'mp4'}">
          Your browser does not support video playback.
        </video>
      </div>
      <div class="result-body">
        <div class="result-title" title="${escapeHtml(displayTitle)}">${escapeHtml(displayTitle)}</div>
        ${descSnippet ? `<div class="result-desc" title="${descSnippet}">${descSnippet}</div>` : ''}
        <div class="result-meta-row">
          <span><i data-lucide="hard-drive"></i> ${formattedBytes}</span>
          ${durationSec ? `<span><i data-lucide="clock"></i> ${durationSec}</span>` : ''}
          ${item.matchedText ? `<span><i data-lucide="file-text"></i> ${escapeHtml(item.matchedText)}</span>` : ''}
        </div>
        <div class="tags-container">
          ${tagsHtml || '<span class="text-muted" style="font-size:0.75rem">No tags attached</span>'}
        </div>
        <div class="result-actions">
          <button class="btn-sm btn-ghost btn-copy-url" data-url="${item.secure_url}">
            <i data-lucide="copy"></i> Copy URL
          </button>
          <a href="${item.secure_url}" target="_blank" rel="noopener noreferrer" class="btn-sm btn-primary">
            <i data-lucide="external-link"></i> View
          </a>
        </div>
      </div>
    `;

    resultsGrid.appendChild(card);
    lucide.createIcons();

    // Update filter count badge if active
    if (filterCountBadge) {
      const q = filterResultsInput ? filterResultsInput.value.trim().toLowerCase() : '';
      if (q) {
        applyResultsFilter(q);
      } else {
        const totalCards = resultsGrid.querySelectorAll('.result-card').length;
        filterCountBadge.textContent = `Showing all ${totalCards} videos`;
      }
    }

    card.querySelector('.btn-copy-url').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const url = btn.getAttribute('data-url');
      navigator.clipboard.writeText(url).then(() => {
        const oldHtml = btn.innerHTML;
        btn.innerHTML = `<i data-lucide="check"></i> Copied!`;
        lucide.createIcons();
        setTimeout(() => {
          btn.innerHTML = oldHtml;
          lucide.createIcons();
        }, 2000);
      });
    });
  }

  // Real-Time Results Filter by Title, Description & Tags
  if (filterResultsInput) {
    filterResultsInput.addEventListener('input', () => {
      const q = filterResultsInput.value.trim().toLowerCase();
      if (btnClearFilter) {
        btnClearFilter.classList.toggle('hidden', !q);
      }
      applyResultsFilter(q);
    });
  }

  if (btnClearFilter) {
    btnClearFilter.addEventListener('click', () => {
      filterResultsInput.value = '';
      btnClearFilter.classList.add('hidden');
      applyResultsFilter('');
    });
  }

  function applyResultsFilter(query) {
    const cards = resultsGrid.querySelectorAll('.result-card');
    let matchCount = 0;
    cards.forEach(card => {
      const searchData = card.getAttribute('data-search') || '';
      if (!query || searchData.includes(query)) {
        card.style.display = '';
        matchCount++;
      } else {
        card.style.display = 'none';
      }
    });

    if (filterCountBadge) {
      if (!query) {
        filterCountBadge.textContent = `Showing all ${cards.length} videos`;
      } else {
        filterCountBadge.textContent = `Showing ${matchCount} of ${cards.length} videos`;
      }
    }
  }

  // Export Results
  btnExportJson.addEventListener('click', () => {
    if (completedItems.length === 0) return alert('No results available to export.');
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(completedItems, null, 2));
    downloadFile(dataStr, `cloudinary_uploads_${Date.now()}.json`);
  });

  btnExportCsv.addEventListener('click', () => {
    if (completedItems.length === 0) return alert('No results available to export.');
    const headers = ['Title', 'Description', 'File Name', 'Source Archive', 'Cloudinary URL', 'Public ID', 'Keywords/Tags', 'Size (Bytes)', 'Duration (sec)', 'Matched Metadata File'];
    const rows = completedItems.map(item => [
      `"${(item.title || '').replace(/"/g, '""')}"`,
      `"${(item.description || '').replace(/"/g, '""')}"`,
      `"${(item.fileName || '').replace(/"/g, '""')}"`,
      `"${(item.sourceZip || '').replace(/"/g, '""')}"`,
      `"${item.secure_url || ''}"`,
      `"${item.public_id || ''}"`,
      `"${(item.tags || []).join(', ').replace(/"/g, '""')}"`,
      item.bytes || '',
      item.duration || '',
      `"${(item.matchedText || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadFile(encodeURI(csvContent), `cloudinary_uploads_${Date.now()}.csv`);
  });

  function downloadFile(uri, filename) {
    const link = document.createElement('a');
    link.setAttribute('href', uri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // New Batch Reset
  btnNewBatch.addEventListener('click', () => {
    if (!confirm('Start a new batch upload?')) return;
    selectedFiles = [];
    updateSelectedUI();
    processingSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    resultsGrid.innerHTML = '';
    completedItems = [];
    terminalLogs.innerHTML = '';
    completedCount.textContent = '0';
    totalCount.textContent = '0';
    failedCount.textContent = '0';
    pipelineProgressBar.style.width = '0%';
    overallPercent.textContent = '0%';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
