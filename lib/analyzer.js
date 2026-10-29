const path = require('path');
const fs = require('fs');

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.flv', '.m4v', '.3gp', '.ts']);
const TEXT_EXTENSIONS = new Set(['.txt', '.json', '.caption', '.md']);

const COMMON_STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can',
  'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down',
  'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t',
  'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it',
  'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s',
  'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were',
  'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s',
  'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re',
  'you\'ve', 'your', 'yours', 'yourself', 'yourselves', 'video', 'file', 'mp4', 'mkv', 'clip', 'recording'
]);

function isVideoFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return VIDEO_EXTENSIONS.has(ext);
}

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

function cleanTag(tag) {
  if (!tag) return '';
  return String(tag)
    .replace(/[#@]/g, '')
    .trim()
    .replace(/[\s\.\,\/\\:\;\(\)\[\]\{\}\<\>\"\'\?\!\*\+\=\&\|\%\$\^\`\~]+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .substring(0, 35);
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

  // Check if it's JSON
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const data = JSON.parse(text);
      if (data.title) title = String(data.title);
      if (data.description) description = String(data.description);
      if (data.caption) caption = String(data.caption);
      
      const rawTags = data.tags || data.keywords || [];
      if (Array.isArray(rawTags)) {
        rawTags.forEach(t => {
          const cleaned = cleanTag(String(t));
          if (cleaned) tagsSet.add(cleaned);
        });
      } else if (typeof rawTags === 'string') {
        rawTags.split(/[,;\n|]/).forEach(t => {
          const cleaned = cleanTag(t);
          if (cleaned) tagsSet.add(cleaned);
        });
      }
      if (tagsSet.size > 0) {
        return { title, description: description || caption, caption, tags: Array.from(tagsSet) };
      }
    } catch (e) {
      // Fallback to text parsing
    }
  }

  // Check explicit headers like "Keywords:", "Tags:", "Title:", "Description:"
  const lines = text.split(/\r?\n/);
  let explicitTagsFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Title match
    const titleMatch = line.match(/^(?:title|name|video title)\s*[:=-]\s*(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }

    // Description match
    const descMatch = line.match(/^(?:description|desc|details?|caption|summary)\s*[:=-]\s*(.+)$/i);
    if (descMatch) {
      description = descMatch[1].trim();
      continue;
    }

    // Tags/Keywords match
    const tagsMatch = line.match(/^(?:keywords?|tags?|hashtags?|keys?)\s*[:=-]\s*(.+)$/i);
    if (tagsMatch) {
      explicitTagsFound = true;
      const rawList = tagsMatch[1].split(/[,;\t|]/);
      for (const t of rawList) {
        const cleaned = cleanTag(t);
        if (cleaned) tagsSet.add(cleaned);
      }
      continue;
    }

    // Hashtags anywhere in line
    const hashtags = line.match(/#([a-zA-Z0-9_\u0900-\u097F]+)/g);
    if (hashtags && hashtags.length > 0) {
      for (const ht of hashtags) {
        const cleaned = cleanTag(ht.replace(/^#/, ''));
        if (cleaned) tagsSet.add(cleaned);
      }
    }
  }

  // If no explicit tags were found, extract from comma-separated format or raw text
  if (tagsSet.size === 0) {
    if (text.includes(',') && !text.includes('\n\n')) {
      // Looks like a comma-separated list of keywords
      const parts = text.split(/[,;\n]/);
      for (const part of parts) {
        const cleaned = cleanTag(part);
        if (cleaned && cleaned.length <= 40) {
          tagsSet.add(cleaned);
        }
      }
    } else {
      // General paragraph text: extract smart keywords
      const derived = deriveTagsFromText(text);
      derived.forEach(t => tagsSet.add(t));
      if (!description) {
        description = text.substring(0, 300);
      }
    }
  }

  // Also include words from title if tags are sparse
  if (tagsSet.size < 3 && title) {
    deriveTagsFromText(title).forEach(t => tagsSet.add(t));
  }

  return {
    title: title || fallbackTitle,
    description: description || caption || text.substring(0, 300),
    caption: caption || title || fallbackTitle,
    tags: Array.from(tagsSet).slice(0, 30) // Cloudinary allows up to several tags, 30 is great
  };
}

function deriveTagsFromText(text) {
  if (!text) return [];
  // Tokenize words (support english, numbers, hindi/unicode)
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s_\-\u0900-\u097F]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !COMMON_STOP_WORDS.has(w) && !/^\d+$/.test(w));

  // Count frequencies
  const counts = new Map();
  for (const w of words) {
    counts.set(w, (counts.get(w) || 0) + 1);
  }

  // Sort by frequency
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0])
    .slice(0, 15);
}

function matchVideosWithText(allFiles) {
  const videoFiles = [];
  const textFiles = [];

  for (const f of allFiles) {
    if (isVideoFile(f.relativePath)) {
      videoFiles.push(f);
    } else if (isTextFile(f.relativePath)) {
      textFiles.push(f);
    }
  }

  const results = [];

  for (const video of videoFiles) {
    const videoDir = path.dirname(video.relativePath);
    const videoBase = path.basename(video.relativePath, path.extname(video.relativePath)).toLowerCase();

    let matchedTextFile = null;

    // 1. Exact base name match in same directory
    matchedTextFile = textFiles.find(t => {
      const tDir = path.dirname(t.relativePath);
      const tBase = path.basename(t.relativePath, path.extname(t.relativePath)).toLowerCase();
      return tDir === videoDir && tBase === videoBase;
    });

    // 2. Exact base name match in ANY directory
    if (!matchedTextFile) {
      matchedTextFile = textFiles.find(t => {
        const tBase = path.basename(t.relativePath, path.extname(t.relativePath)).toLowerCase();
        return tBase === videoBase;
      });
    }

    // 3. Same directory text file if only 1 text file in that directory
    if (!matchedTextFile) {
      const sameDirTexts = textFiles.filter(t => path.dirname(t.relativePath) === videoDir);
      if (sameDirTexts.length === 1) {
        matchedTextFile = sameDirTexts[0];
      }
    }

    // 4. Base name fuzzy or startsWith / contains
    if (!matchedTextFile) {
      matchedTextFile = textFiles.find(t => {
        const tBase = path.basename(t.relativePath, path.extname(t.relativePath)).toLowerCase();
        return (videoBase.includes(tBase) || tBase.includes(videoBase)) && tBase.length > 3;
      });
    }

    // 5. Global info.txt / metadata.txt in root
    if (!matchedTextFile) {
      matchedTextFile = textFiles.find(t => {
        const tBase = path.basename(t.relativePath, path.extname(t.relativePath)).toLowerCase();
        return ['info', 'metadata', 'details', 'tags', 'keywords'].includes(tBase);
      });
    }

    let parsedMeta = null;
    let textContent = '';

    if (matchedTextFile) {
      try {
        textContent = fs.readFileSync(matchedTextFile.absolutePath, 'utf8');
      } catch (e) {
        textContent = '';
      }
    }

    const fallbackTitle = path.basename(video.relativePath, path.extname(video.relativePath)).replace(/[_-]+/g, ' ');
    parsedMeta = parseTextMetadata(textContent, fallbackTitle);

    results.push({
      videoPath: video.absolutePath,
      relativePath: video.relativePath,
      fileName: path.basename(video.relativePath),
      fileSize: video.size || 0,
      matchedTextFile: matchedTextFile ? matchedTextFile.relativePath : null,
      metadata: parsedMeta
    });
  }

  return results;
}

module.exports = {
  isVideoFile,
  isTextFile,
  parseTextMetadata,
  deriveTagsFromText,
  matchVideosWithText
};
