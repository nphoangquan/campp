import { Request, Response } from 'express';
import { cloudinary } from '../config/cloudinary';
import { env } from '../config/env';

export async function uploadFiles(req: Request, res: Response): Promise<void> {
  if (!env.CLOUDINARY_CLOUD_NAME) {
    res.status(503).json({ error: 'File upload is not configured' });
    return;
  }

  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    res.status(400).json({ error: 'No files provided' });
    return;
  }

  try {
    const uploads = await Promise.all(
      files.map((file) => {
        return new Promise<{ url: string; type: string; name: string; size: number }>((resolve, reject) => {
          const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'auto';

          cloudinary.uploader
            .upload_stream(
              {
                folder: 'camp',
                resource_type: resourceType as 'auto',
              },
              (error, result) => {
                if (error || !result) {
                  reject(error || new Error('Upload failed'));
                  return;
                }

                let fileType: 'image' | 'video' | 'file' = 'file';
                if (file.mimetype.startsWith('image/')) fileType = 'image';
                else if (file.mimetype.startsWith('video/')) fileType = 'video';

                resolve({
                  url: result.secure_url,
                  type: fileType,
                  name: file.originalname,
                  size: file.size,
                });
              }
            )
            .end(file.buffer);
        });
      })
    );

    res.json({ attachments: uploads });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
}
