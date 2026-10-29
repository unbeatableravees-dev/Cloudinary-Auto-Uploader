// Cloudinary Multi-ZIP Auto-Uploader Frontend Logic

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
  const btnExportJson = document.getElementById('btnExportJson');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnNewBatch = document.getElementById('btnNewBatch');

  // State
  let selectedFiles = []; // Array of File objects
  let activeEventSource = null;
  let currentJobId = null;
  let completedItems = [];

  // Intelligent API Base URL detection
  const isLocalOrigin = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  let apiBaseUrl = isLocalOrigin
    ? ''
    : (localStorage.getItem('cld_backend_url') || 'http://localhost:3000');

  // If on Firebase / remote host, display connection helper
  const remoteNoticeBanner = document.getElementById('remoteNoticeBanner');
  if (!isLocalOrigin && remoteNoticeBanner) {
    remoteNoticeBanner.classList.remove('hidden');
  }

  // Safe JSON fetch wrapper to prevent "Unexpected token '<'" errors
  async function safeFetchJson(url, options = {}) {
    const fullUrl = url.startsWith('http') ? url : (apiBaseUrl + url);
    let res;
    try {
      res = await fetch(fullUrl, options);
    } catch (netErr) {
      if (!isLocalOrigin) {
        throw new Error(`Cannot reach backend at ${apiBaseUrl}. Please ensure your local server is running (start.bat) or open http://localhost:3000 directly.`);
      }
      throw netErr;
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (!isLocalOrigin) {
        throw new Error(`Firebase Hosting is static-only. Video processing requires the Node.js backend. Please open http://localhost:3000 on your machine.`);
      }
      const rawText = await res.text();
      throw new Error(`Unexpected server response (${res.status}): ${rawText.substring(0, 100)}`);
    }

    const data = await res.json();
    return { res, data };
  }

  // Initialize icons
  lucide.createIcons();

  // 1. Check existing Cloudinary Status on Load
  checkCloudinaryStatus();

  async function checkCloudinaryStatus() {
    try {
      const { data } = await safeFetchJson('/api/cloudinary/status');
      if (data && data.isConfigured) {
        setCloudinaryConnected(data.cloud_name, data.masked_key);
      } else {
        const savedName = localStorage.getItem('cld_cloud_name');
        const savedKey = localStorage.getItem('cld_api_key');
        if (savedName) cloudNameInput.value = savedName;
        if (savedKey) apiKeyInput.value = savedKey;
      }
    } catch (e) {
      console.warn('Could not check Cloudinary status', e.message);
    }
  }

  function setCloudinaryConnected(cloudName, keyMask = '') {
    // Header badge
    headerStatusBadge.innerHTML = `
      <span class="status-dot online"></span>
      <span class="status-text">Connected: <strong>${escapeHtml(cloudName)}</strong></span>
      <button id="disconnectBtn" class="btn-sm btn-ghost" title="Disconnect Account">
        <i data-lucide="log-out"></i>
      </button>
    `;
    lucide.createIcons();

    document.getElementById('disconnectBtn').addEventListener('click', disconnectCloudinary);

    // Show compact connected summary card
    if (authConnectedCard && connectedCloudNameDisplay) {
      connectedCloudNameDisplay.textContent = cloudName;
      authConnectedCard.classList.remove('hidden');
      authFormWrapper.classList.add('hidden');
    }

    // Unlock upload workspace
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

  // 2. Auth Form Submit
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cloudName = cloudNameInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const apiSecret = apiSecretInput.value.trim();
    const cloudinaryUrl = cloudinaryUrlInput.value.trim();

    btnConnect.disabled = true;
    btnConnect.innerHTML = `<span class="spinner"></span> Verifying...`;
    authAlert.classList.add('hidden');

    try {
      const { data } = await safeFetchJson('/api/cloudinary/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
          cloudinary_url: cloudinaryUrl
        })
      });

      if (data.success) {
        localStorage.setItem('cld_cloud_name', cloudName);
        localStorage.setItem('cld_api_key', apiKey);
        setCloudinaryConnected(data.cloud_name);
      } else {
        authAlert.className = 'alert-message error';
        authAlert.textContent = data.error || 'Connection failed. Please check credentials.';
        authAlert.classList.remove('hidden');
      }
    } catch (err) {
      authAlert.className = 'alert-message error';
      authAlert.textContent = err.message;
      authAlert.classList.remove('hidden');
    } finally {
      btnConnect.disabled = false;
      btnConnect.innerHTML = `<i data-lucide="shield-check"></i><span>Connect & Verify Account</span>`;
      lucide.createIcons();
    }
  });

  // Disconnect Cloudinary
  async function disconnectCloudinary() {
    if (!confirm('Are you sure you want to disconnect your Cloudinary account?')) return;
    try {
      await safeFetchJson('/api/cloudinary/disconnect', { method: 'POST' });
      localStorage.removeItem('cld_cloud_name');
      localStorage.removeItem('cld_api_key');
      window.location.reload();
    } catch (e) {
      alert('Error disconnecting: ' + e.message);
    }
  }

  // 3. Multi-File Dropzone & Selection
  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('.zip-file-item')) {
      return;
    }
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
      alert(`${nonZipCount} non-ZIP file(s) were skipped. Only .zip archives are supported.`);
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

    // Render file list
    zipFilesList.innerHTML = '';
    selectedFiles.forEach((file, index) => {
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

    lucide.createIcons();

    // Attach individual remove handlers
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

  // 4. Start Upload & Multi-ZIP Processing
  btnStartUpload.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    btnStartUpload.disabled = true;
    uploadProgressContainer.classList.remove('hidden');
    uploadProgressBar.style.width = '0%';
    uploadProgressPercent.textContent = '0%';
    uploadProgressLabel.textContent = `Transferring ${selectedFiles.length} ZIP archive(s) to server...`;

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('zipFiles', file);
    });
    formData.append('folderName', folderNameInput.value.trim() || 'zip_uploads');
    formData.append('createSubfolders', subfolderToggle.checked ? 'true' : 'false');

    const xhr = new XMLHttpRequest();
    const uploadUrl = (apiBaseUrl ? apiBaseUrl : '') + '/api/upload-zip';
    xhr.open('POST', uploadUrl, true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        uploadProgressBar.style.width = percent + '%';
        uploadProgressPercent.textContent = percent + '%';
        uploadProgressLabel.textContent = `Uploading archives (${selectedFiles.length} files): ${formatBytes(e.loaded)} / ${formatBytes(e.total)}`;
      }
    };

    xhr.onload = async () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        currentJobId = data.jobId;
        uploadProgressLabel.textContent = `All ${data.zipCount} archives uploaded successfully! Initializing pipeline...`;

        // Reveal Step 3
        processingSection.classList.remove('hidden');
        processingSection.scrollIntoView({ behavior: 'smooth' });

        // Connect SSE for live logs and progress
        listenToProgress(currentJobId);

        // If autoStart, trigger process
        if (autoStartToggle.checked) {
          await triggerProcess(currentJobId);
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          alert('Upload failed: ' + (errData.error || 'Server error'));
        } catch (e) {
          alert('Upload failed with status: ' + xhr.status);
        }
        btnStartUpload.disabled = false;
      }
    };

    xhr.onerror = () => {
      alert('Network error while transferring ZIP files.');
      btnStartUpload.disabled = false;
    };

    xhr.send(formData);
  });

  async function triggerProcess(jobId) {
    try {
      await safeFetchJson(`/api/process/${jobId}`, { method: 'POST' });
    } catch (e) {
      console.error('Trigger process error', e);
    }
  }

  // 5. Server-Sent Events (SSE) Stream
  function listenToProgress(jobId) {
    if (activeEventSource) {
      activeEventSource.close();
    }

    const sseUrl = (apiBaseUrl ? apiBaseUrl : '') + `/api/progress/${jobId}`;
    activeEventSource = new EventSource(sseUrl);

    activeEventSource.addEventListener('init', (e) => {
      const data = JSON.parse(e.data);
      if (data) {
        if (data.totalVideos) totalCount.textContent = data.totalVideos;
        if (data.completedVideos) completedCount.textContent = data.completedVideos;
        if (data.failedVideos) failedCount.textContent = data.failedVideos;
        if (data.progressPercent) {
          pipelineProgressBar.style.width = data.progressPercent + '%';
          overallPercent.textContent = data.progressPercent + '%';
        }
        if (data.results && data.results.length > 0) {
          resultsGrid.innerHTML = '';
          completedItems = data.results;
          completedItems.forEach(item => appendResultCard(item));
          resultsSection.classList.remove('hidden');
        }
      }
    });

    activeEventSource.addEventListener('log', (e) => {
      const data = JSON.parse(e.data);
      appendTerminalLog(data.time, data.message, data.type);
    });

    activeEventSource.addEventListener('status', (e) => {
      const data = JSON.parse(e.data);
      if (data.percent !== undefined) {
        pipelineProgressBar.style.width = data.percent + '%';
        overallPercent.textContent = data.percent + '%';
      }
      if (data.status) {
        jobStatusBadge.textContent = data.status.toUpperCase();
      }
    });

    activeEventSource.addEventListener('preview', (e) => {
      const data = JSON.parse(e.data);
      const count = data.total || (data.pairs ? data.pairs.length : 0);
      totalCount.textContent = count;
    });

    activeEventSource.addEventListener('item_complete', (e) => {
      const item = JSON.parse(e.data);
      completedItems.push(item);
      completedCount.textContent = completedItems.length;
      appendResultCard(item);
      resultsSection.classList.remove('hidden');
    });

    activeEventSource.addEventListener('item_failed', (e) => {
      const item = JSON.parse(e.data);
      const curr = parseInt(failedCount.textContent, 10) || 0;
      failedCount.textContent = curr + 1;
    });

    activeEventSource.addEventListener('finished', (e) => {
      jobStatusBadge.textContent = 'COMPLETED';
      jobStatusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
      jobStatusBadge.style.color = '#34d399';
      pipelineProgressBar.style.width = '100%';
      overallPercent.textContent = '100%';

      appendTerminalLog(new Date().toLocaleTimeString(), 'Batch complete! All extracted videos have been processed and tagged in Cloudinary.', 'success');
      resultsSection.classList.remove('hidden');
      resultsSection.scrollIntoView({ behavior: 'smooth' });

      activeEventSource.close();
    });

    activeEventSource.onerror = () => {
      // Stream ended or connection lost
    };
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

  // 6. Results Gallery Card
  function appendResultCard(item) {
    const card = document.createElement('div');
    card.className = 'result-card';

    const tagsHtml = (item.tags || [])
      .map(tag => `<span class="keyword-pill">#${escapeHtml(tag)}</span>`)
      .join('');

    const formattedBytes = formatBytes(item.bytes || 0);
    const durationSec = item.duration ? `${Math.round(item.duration)}s` : '';
    const sourceZipLabel = item.sourceZip ? escapeHtml(item.sourceZip) : '';

    card.innerHTML = `
      <div class="result-video-wrap">
        ${sourceZipLabel ? `<span class="source-zip-pill"><i data-lucide="archive"></i> ${sourceZipLabel}</span>` : ''}
        <video controls preload="metadata">
          <source src="${item.secure_url}" type="video/${item.format || 'mp4'}">
          Your browser does not support video playback.
        </video>
      </div>
      <div class="result-body">
        <div class="result-title" title="${escapeHtml(item.fileName)}">${escapeHtml(item.fileName)}</div>
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

    // Copy URL handler
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

  // 7. Export Results (JSON / CSV)
  btnExportJson.addEventListener('click', () => {
    if (completedItems.length === 0) return alert('No results available to export.');
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(completedItems, null, 2));
    downloadFile(dataStr, `cloudinary_uploads_${Date.now()}.json`);
  });

  btnExportCsv.addEventListener('click', () => {
    if (completedItems.length === 0) return alert('No results available to export.');
    const headers = ['File Name', 'Source Archive', 'Cloudinary URL', 'Public ID', 'Keywords/Tags', 'Size (Bytes)', 'Duration (sec)', 'Matched Metadata File'];
    const rows = completedItems.map(item => [
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

  // 8. New Batch Reset
  btnNewBatch.addEventListener('click', () => {
    if (!confirm('Start a new batch upload?')) return;
    selectedFiles = [];
    updateSelectedUI();
    uploadProgressContainer.classList.add('hidden');
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

  // Helpers
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
