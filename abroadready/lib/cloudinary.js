const path = require("path");
const cloudinaryLib = require("cloudinary").v2;

function init() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary env vars missing (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET)");
  }
  cloudinaryLib.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  return cloudinaryLib;
}

async function uploadFile(localPath, folder) {
  const cloudinary = init();
  const res = await cloudinary.uploader.upload(localPath, {
    folder: folder || "abroadready",
    resource_type: "auto",
    use_filename: true,
    filename_override: path.basename(localPath),
  });
  return { secure_url: res.secure_url, public_id: res.public_id };
}

async function uploadFromBuffer(buffer, filename, folder) {
  const cloudinary = init();

  const base64 = Buffer.isBuffer(buffer) ? buffer.toString("base64") : Buffer.from(buffer).toString("base64");
  const dataUri = `data:application/octet-stream;base64,${base64}`;

  const res = await cloudinary.uploader.upload(dataUri, {
    folder: folder || "abroadready",
    resource_type: "auto",
    use_filename: true,
    filename_override: filename || "upload",
  });
  return { secure_url: res.secure_url, public_id: res.public_id };
}

async function deleteFile(publicId) {
  const cloudinary = init();
  const res = await cloudinary.uploader.destroy(publicId, { resource_type: "auto" });
  return res;
}

module.exports = {
  uploadFile,
  uploadFromBuffer,
  deleteFile,
};

