import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/Ddb';
import { uploadImage } from '@/utils/upload/Dcloudinary';
import formidable from 'formidable';
import { IncomingForm } from 'formidable';
import fs from 'fs';

// Disable Next.js body parsing
export const config = {
  api: {
    bodyParser: false,
  },
};

// Define the structure of social links
interface SocialLink {
  title: string;
  url: string;
}

// Define the user data structure
interface UserData {
  username?: string;
  email?: string;
  avatar?: string;
  bio?: string;
  streamKey?: string;
  socialLinks?: SocialLink[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow PUT or PATCH methods
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse form data including file uploads
    const { fields, files } = await parseFormData(req);
    
    // Extract wallet from query or authorization header
    const wallet = req.query.wallet as string || 
                   req.headers.authorization?.replace('Bearer ', '') || 
                   fields.wallet?.[0];
    
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Check if user exists
    const userExists = await checkUserExists(wallet);
    if (!userExists) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prepare user data from form fields
    const userData: UserData = {};

    // Handle text fields
    if (fields.username?.[0]) userData.username = fields.username[0];
    if (fields.email?.[0]) userData.email = fields.email[0];
    if (fields.bio?.[0]) userData.bio = fields.bio[0];
    if (fields.streamKey?.[0]) userData.streamKey = fields.streamKey[0];

    // Handle social links if provided
    if (fields.socialLinks?.[0]) {
      try {
        const socialLinksData = JSON.parse(fields.socialLinks[0]);
        if (Array.isArray(socialLinksData)) {
          userData.socialLinks = socialLinksData;
        }
      } catch (error) {
        return res.status(400).json({ error: 'Invalid social links format' });
      }
    }

    // Handle avatar upload if provided
    if (files.avatar) {
      const avatarFile = Array.isArray(files.avatar) ? files.avatar[0] : files.avatar;
      
      // Get file path from the avatar file
      const filePath = avatarFile.filepath;
      
      try {
        // Upload to cloud storage
        const uploadResult = await uploadImage(filePath);
        userData.avatar = uploadResult.secure_url;
        
        // Clean up temporary file
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ error: 'Failed to upload avatar' });
      }
    }

    // Check if any fields to update were provided
    if (Object.keys(userData).length === 0) {
      return res.status(400).json({ error: 'No update data provided' });
    }

    // Update the user in the database
    const updatedUser = await updateUser(wallet, userData);
    
    // Return the updated user data
    return res.status(200).json({ 
      message: 'User updated successfully',
      user: updatedUser 
    });
    
  } catch (error) {
    console.error('Update error:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
}

// Helper function to parse form data
const parseFormData = (req: NextApiRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }> => {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      keepExtensions: true,
      multiples: true,
    });
    
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
};

// Helper function to check if user exists
const checkUserExists = async (wallet: string): Promise<boolean> => {
  const result = await pool.query(
    'SELECT EXISTS(SELECT 1 FROM users WHERE wallet = $1)',
    [wallet]
  );
  
  return result.rows[0].exists;
};

// Helper function to update user in database
const updateUser = async (wallet: string, userData: UserData) => {
  // Prepare SQL parts
  let setClauses = [];
  let values = [wallet]; // wallet is always the first parameter
  let paramIndex = 2; // start from 2 because wallet is at index 1
  
  // Build the SET clauses dynamically
  if (userData.username !== undefined) {
    setClauses.push(`username = $${paramIndex++}`);
    values.push(userData.username);
  }
  
  if (userData.email !== undefined) {
    setClauses.push(`email = $${paramIndex++}`);
    values.push(userData.email);
  }
  
  if (userData.avatar !== undefined) {
    setClauses.push(`avatar = $${paramIndex++}`);
    values.push(userData.avatar);
  }
  
  if (userData.bio !== undefined) {
    setClauses.push(`bio = $${paramIndex++}`);
    values.push(userData.bio);
  }
  
  if (userData.streamKey !== undefined) {
    setClauses.push(`streamkey = $${paramIndex++}`);
    values.push(userData.streamKey);
  }
  
  if (userData.socialLinks !== undefined) {
    setClauses.push(`socialLinks = $${paramIndex++}`);
    values.push(JSON.stringify(userData.socialLinks));
  }
  
  // Always update the updated_at timestamp
  setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
  
  // Execute the UPDATE query
  const query = `
    UPDATE users 
    SET ${setClauses.join(', ')}
    WHERE wallet = $1
    RETURNING id, wallet, username, email, avatar, bio, streamkey as "streamKey", socialLinks, updated_at
  `;
  
  const result = await pool.query(query, values);
  return result.rows[0];
};