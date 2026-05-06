import cloudinary from '../utils/cloudinary';

export interface UploadResult {
  url: string;
  publicId: string;
  type: string;
}

export const uploadToCloudinary = (file: Express.Multer.File): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const isVideo = file.mimetype.startsWith('video/');
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'turumba/ads',
        resource_type: isVideo ? 'video' : 'image',
        transformation: isVideo
          ? [{ quality: 'auto', fetch_format: 'auto' }]
          : [{ quality: 'auto', fetch_format: 'auto', width: 1280, crop: 'limit' }],
      },
      (error, result) => {
        if (error || !result) {
          reject(error);
        } else {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            type: isVideo ? 'video' : 'image',
          });
        }
      }
    );
    stream.end(file.buffer);
  });
};
