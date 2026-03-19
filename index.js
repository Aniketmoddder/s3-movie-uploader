import express from 'express';
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
  res.send('Server is running! Go to /download to start the transfer.');
});

// Visiting this endpoint triggers the download
app.get('/download', async (req, res) => {
  res.send('Download started! Check your Railway deployment logs to see the progress.');
  
  try {
    const videoUrl = "https://filetolinkneon3-f3fb5765bfd1.herokuapp.com/stream/1684212?hash=74fa28&d=true";
    
    console.log("Fetching video from source...");
    const response = await fetch(videoUrl);
    
    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

    console.log("Streaming directly to S3 bucket...");
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.S3_BUCKET_NAME, 
        Key: "movies/my_movie.mp4", // Change .mp4 if it's a different format
        Body: response.body,
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
    console.log("✅ Transfer complete! The file is in your bucket.");
  } catch (error) {
    console.error("❌ Error during transfer:", error);
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
