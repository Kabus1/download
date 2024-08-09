const express = require('express');
const youtubedl = require('youtube-dl-exec');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/get-qualities', async (req, res) => {
  const videoURL = req.query.videoURL;
  try {
    const info = await youtubedl(videoURL, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      ]
    });
    const formats = info.formats.map(format => ({
      format_id: format.format_id,
      format: format.format
    }));
    res.json(formats);
  } catch (error) {
    console.error('خطأ:', error.message);
    res.status(500).send(`حدث خطأ: ${error.message}`);
  }
});

app.post('/download', async (req, res) => {
  const videoURL = req.body.videoURL;
  const format = req.body.quality;
  const downloadPath = req.body.downloadPath || path.join(__dirname, 'downloads');

  try {
    console.log(`Attempting to download video from ${videoURL}`);
    console.log(`Download path: ${downloadPath}`);

    // Ensure the download directory exists
    try {
      await fs.access(downloadPath, fs.constants.W_OK);
      console.log(`Download directory ${downloadPath} exists and is writable`);
    } catch (err) {
      console.log(`Issue with download directory: ${err.message}`);
      if (err.code === 'ENOENT') {
        console.log(`Creating download directory: ${downloadPath}`);
        await fs.mkdir(downloadPath, { recursive: true });
      } else {
        throw new Error(`Unable to access or create download directory: ${err.message}`);
      }
    }

    const info = await youtubedl(videoURL, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      ]
    });

    const videoTitle = info.title.replace(/[^\w\s]/gi, '').trim().replace(/\s+/g, '_');
    const outputPath = path.join(downloadPath, `${videoTitle}.mp4`);

    console.log(`Full file path: ${outputPath}`);

    console.log('Starting video download...');
    await youtubedl(videoURL, {
      output: outputPath,
      format: format,
    });
    console.log('Video download completed.');

    // Verify the file after download
    try {
      const stats = await fs.stat(outputPath);
      console.log(`File exists. Size: ${stats.size} bytes`);
      if (stats.size === 0) {
        throw new Error('The downloaded file is empty');
      }
    } catch (err) {
      throw new Error(`Failed to verify file: ${err.message}`);
    }

    // List directory contents
    const dirContents = await fs.readdir(downloadPath);
    console.log(`Contents of directory ${downloadPath}:`, dirContents);

    res.download(outputPath, `${videoTitle}.mp4`, async (err) => {
      if (err) {
        console.error('Error during download:', err);
        return res.status(500).send('An error occurred during video download');
      }

      console.log('File sent to client. Attempting to delete temporary file.');
      try {
        await fs.unlink(outputPath);
        console.log('Temporary file deleted successfully.');
      } catch (unlinkErr) {
        console.error('Error deleting temporary file:', unlinkErr);
      }
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).send(`An error occurred: ${error.message}`);
  }
});


app.listen(port, () => {
  console.log(`التطبيق يعمل على المنفذ ${port}`);
});