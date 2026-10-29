# 🚀 Cloudinary Video & Text Auto-Uploader

Ek powerful automated web tool jo aapki ZIP file ko extract karke videos aur unke `.txt` files ko smartly match karta hai, text se keywords aur details extract karta hai, aur unhe Cloudinary par tags aur metadata ke sath chunked upload kar deta hai.

---

## ✨ Features

1. **🔐 Cloudinary Login / Setup Screen (Step 1)**:
   - Apne Cloudinary account ka **Cloud Name**, **API Key**, aur **API Secret** daalein.
   - Ya phir direct `CLOUDINARY_URL` paste karein (`cloudinary://api_key:api_secret@cloud_name`).
   - 1-Click Verification test karta hai ki credentials valid hain ya nahi.
   - Credentials local machine par securely save rehte hain taaki baar-baar type na karna pade.

2. **📦 ZIP File Upload & Extraction (Step 2)**:
   - Drag & drop ZIP file upload (badi files / high-volume video archives support karta hai).
   - Custom Cloudinary target folder specify kar sakte hain (e.g. `reels_batch_1`).
   - "Auto-Process on Upload" toggle: ZIP upload hote hi baki saara process bina kisi extra click ke start ho jata hai.

3. **🧠 Smart Text & Keyword Analyzer**:
   - Har video file (`.mp4`, `.mov`, `.mkv`, `.avi`, `.webm`, etc.) ko uski `.txt` / `.json` file ke sath auto-pair karta hai.
   - Support karta hai:
     - Explicit formats: `Keywords: tag1, tag2`, `Tags: ...`, `Title: ...`, `Description: ...`
     - Social hashtags: `#funny #travel #gaming`
     - Comma-separated lists
     - Paragraph/Natural text: Stop-words filter karke top relevant keywords extract karta hai.
     - Agar kisi video ke sath `.txt` na ho, toh video ke filename se clean keywords generate karta hai.

4. **⚡ Chunked Cloudinary Video Upload (Step 3)**:
   - 10MB chunked streaming upload (`upload_large`) use karta hai taaki badi video files bhi bina timeout ke smoothly upload ho sakein.
   - Video ke sath tags, title, caption aur original filename Cloudinary context me save hote hain.
   - Live terminal log aur animated progress bar real-time SSE stream ke sath.

5. **📊 Results Gallery & Export (Step 4)**:
   - Har uploaded video ka preview player.
   - Extracted keywords ko tags ke roop me view karein.
   - 1-Click Cloudinary direct URL copy.
   - Export results to **JSON** ya **CSV** format.

---

## 🛠️ Kaise Chalayein (Quick Start)

### Option 1: Double Click (Windows)
Workspace folder me maujood **`start.bat`** file par double-click karein. Yeh server start kar dega aur browser me automatically `http://localhost:3000` open kar dega.

### Option 2: Terminal / Command Line
1. Terminal open karein:
   ```bash
   cd "C:\Cloud Upload"
   ```
2. Server start karein:
   ```bash
   npm start
   ```
3. Browser me open karein:
   ```
   http://localhost:3000
   ```

---

## 📁 ZIP File Structure (Examples)

Aapki ZIP file me videos aur txt files kisi bhi tarah organize ho sakti hain:

### Example 1: Same Name (Recommended)
```
my_archive.zip
├── clip1.mp4
├── clip1.txt      <-- clip1 ke tags & details
├── clip2.mp4
└── clip2.txt      <-- clip2 ke tags & details
```

### Example 2: Folder Based
```
my_archive.zip
├── video_01/
│   ├── render.mp4
│   └── info.txt
└── video_02/
    ├── video.mp4
    └── tags.txt
```

### Example TXT Format (Kaisa bhi text chalega):
```txt
Title: Sunset at Goa Beach
Keywords: goa, beach, sunset, travel, drone, 4k
Description: 4K Drone shot of the golden hour sunset in South Goa.
```
*Ya phir sirf plain hashtags:*
```txt
#nature #waterfall #peaceful #forest
```
