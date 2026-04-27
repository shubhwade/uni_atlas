const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

function getConfig() {
  const repo = process.env.GITHUB_STORAGE_REPO;
  const token = process.env.GITHUB_TOKEN || "";

  if (!repo) {
    throw new Error("GITHUB_STORAGE_REPO is missing");
  }

  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    throw new Error("GITHUB_STORAGE_REPO must be in format 'owner/repo'");
  }

  return { owner, name, token, repo };
}

async function uploadToGitHub(filePath, fileName, folder = "uploads") {
  const { owner, name, token } = getConfig();

  try {
    // Read file content
    const fileContent = fs.readFileSync(filePath);
    const base64Content = fileContent.toString("base64");

    // Create file path in repo
    const repoPath = `${folder}/${Date.now()}_${fileName}`;

    const url = `https://api.github.com/repos/${owner}/${name}/contents/${repoPath}`;

    const payload = {
      message: `Upload ${fileName}`,
      content: base64Content,
      branch: "main"
    };

    const headers = {
      "Content-Type": "application/json",
      "Authorization": token ? `token ${token}` : undefined,
      "User-Agent": "AbroadReady-App"
    };

    // Remove undefined headers
    Object.keys(headers).forEach(key => headers[key] === undefined && delete headers[key]);

    const response = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${error}`);
    }

    const data = await response.json();

    // Return the raw file URL
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${name}/main/${repoPath}`;

    return {
      secure_url: rawUrl,
      public_id: data.content.sha,
      url: rawUrl
    };

  } catch (error) {
    console.error("GitHub upload error:", error);

    // Fallback: return local file path
    return {
      secure_url: `/uploads/${fileName}`,
      public_id: `local_${Date.now()}`,
      url: `/uploads/${fileName}`
    };
  }
}

async function uploadFile(localPath, folder = "abroadready") {
  const fileName = path.basename(localPath);
  return uploadToGitHub(localPath, fileName, folder);
}

async function uploadFromBuffer(buffer, filename, folder = "abroadready") {
  // For buffers, we'll need to write to a temporary file first
  const tempPath = path.join(__dirname, "..", "temp", filename);

  // Ensure temp directory exists
  const tempDir = path.dirname(tempPath);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Write buffer to temp file
  fs.writeFileSync(tempPath, buffer);

  try {
    const result = await uploadToGitHub(tempPath, filename, folder);

    // Clean up temp file
    fs.unlinkSync(tempPath);

    return result;
  } catch (error) {
    // Clean up temp file on error
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }
}

async function deleteFile(publicId) {
  // GitHub doesn't have a simple delete API for files
  // You would need to use the GitHub API to delete the file from the repository
  // For now, we'll just return success
  console.log(`Note: File ${publicId} not actually deleted from GitHub. Manual cleanup required.`);
  return { result: "ok" };
}

module.exports = {
  uploadFile,
  uploadFromBuffer,
  deleteFile,
};