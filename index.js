import express from 'express';
import fs from 'fs';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const app = express();
const port = process.env.PORT || 3000;

// Connect to your S3 bucket using Railway environment variables
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT, 
  region: "auto",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

app.get('/', (req, res) => {
  res.send('Server is running! Go to /download to start the 2-step transfer.');
});

// Trigger the 2-step download
app.get('/download', async (req, res) => {
  // We send a response immediately so your mobile browser doesn't sit loading forever
  res.send('2-Step Download started! Check your Railway deployment logs to see the magic happen.');
  
  const videoUrl = "https://filetolinkneon3-f3fb5765bfd1.herokuapp.com/stream/1684725?hash=74fa28&d=true";
  const localFilePath = "./temp_movie.mp4"; // Saves inside Railway's temporary storage
  
  try {
    console.log("⬇️ Step 1: Downloading file from Heroku to Railway local storage...");
    const response = await fetch(videoUrl);
    
    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

    // Pipe the download directly into Railway's local disk
    const fileStream = fs.createWriteStream(localFilePath);
    await finished(Readable.fromWeb(response.body).pipe(fileStream));

    console.log("✅ Download complete! File saved safely to Railway.");
    console.log("⬆️ Step 2: Uploading file from Railway to S3 Bucket...");

    // Now upload that local file to S3
    const uploadStream = fs.createReadStream(localFilePath);

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.S3_BUCKET_NAME, 
        Key: "movies/new_movie.mp4", 
        Body: uploadStream,
        ContentType: "video/mp4", 
      },
    });

    upload.on("httpUploadProgress", (progress) => {
      if (progress.total) {
        const percentage = Math.round((progress.loaded / progress.total) * 100);
        console.log(`Upload progress: ${percentage}%`);
      } else {
        console.log(`Uploaded ${progress.loaded} bytes`);
      }
    });

    await upload.done();
    console.log("✅ Transfer to S3 complete! The file is in your bucket.");

    // Clean up: Delete the file from Railway to keep your app light
    fs.unlinkSync(localFilePath);
    console.log("🧹 Cleaned up temporary local file.");

  } catch (error) {
    console.error("❌ Error during transfer:", error);
    // If it fails, try to delete the broken file so it doesn't take up space
    if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        console.log("🧹 Cleaned up broken file after error.");
    }
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
