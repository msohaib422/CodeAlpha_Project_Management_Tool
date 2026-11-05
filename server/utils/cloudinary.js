const cloudinary = require('cloudinary').v2;

const configureCloudinary = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }
};

configureCloudinary();

const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

const uploadProfileImage = (buffer) => {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured on the server');
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'profile-images',
        resource_type: 'image',
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result || !result.secure_url || !result.public_id) {
          return reject(new Error('Cloudinary upload returned an invalid response'));
        }
        resolve(result);
      }
    );
    stream.end(buffer);
  });
};

const deleteProfileImage = async (publicId) => {
  if (!publicId || !isCloudinaryConfigured()) return;
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
  } catch (error) {
    console.error('[cloudinary] failed to delete image:', publicId, error.message);
    throw error;
  }
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  uploadProfileImage,
  deleteProfileImage,
};