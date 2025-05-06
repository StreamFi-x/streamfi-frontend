import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads an image to Cloudinary
 * @param filePath Path to the temporary file
 * @returns Promise with upload result
 */
export const uploadImage = async (filePath: string): Promise<any> => {
  try {
    // Read the file as a buffer
    const fileBuffer = fs.readFileSync(filePath);
    
    // Create a promise to handle the upload
    return new Promise((resolve, reject) => {
      // Set upload options
      const uploadOptions = {
        resource_type: "image",
        folder: "user_avatars",
      };
      
      // Create an upload stream
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      
      // Pass the buffer to the upload stream
      uploadStream.end(fileBuffer);
    });
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
};

/**
 * Deletes an image from Cloudinary by URL
 * @param imageUrl The URL of the image to delete
 */
export const deleteImage = async (imageUrl: string): Promise<void> => {
  try {
    // Extract public ID from the URL
    const publicId = extractPublicIdFromUrl(imageUrl);
    
    if (!publicId) {
      throw new Error('Invalid Cloudinary URL');
    }
    
    // Delete the image
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw new Error('Failed to delete image from Cloudinary');
  }
};

/**
 * Extracts the public ID from a Cloudinary URL
 * @param url Cloudinary URL
 * @returns The public ID
 */
const extractPublicIdFromUrl = (url: string): string | null => {
  // Example Cloudinary URL: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/user_avatars/abc123.jpg
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Find the index of "upload" in the path
    const uploadIndex = pathParts.findIndex(part => part === 'upload');
    
    if (uploadIndex === -1 || uploadIndex + 2 >= pathParts.length) {
      return null;
    }
    
    // Extract the public ID (everything after "upload" and the version segment)
    const publicIdParts = pathParts.slice(uploadIndex + 2);
    // Remove file extension
    const lastPart = publicIdParts[publicIdParts.length - 1];
    const lastPartWithoutExtension = lastPart.substring(0, lastPart.lastIndexOf('.'));
    publicIdParts[publicIdParts.length - 1] = lastPartWithoutExtension;
    
    // Join the parts to get the complete public ID
    return publicIdParts.join('/');
  } catch (error) {
    console.error('Error extracting public ID:', error);
    return null;
  }
};
