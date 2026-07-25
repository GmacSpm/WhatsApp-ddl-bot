import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';

export function zipFile(origemPath, destineZipPath, zipFileName) {
  return new Promise((resolve, reject) => {
    const midiaExtensions = [
      '.mp4', '.mkv', '.avi', '.mov', '.webm', '.3gp',
      '.mp3', '.ogg', '.aac', '.m4a', '.opus', '.wav',
      '.jpg', '.jpeg', '.png', '.webp', '.gif',
    ];
    const ext = path.extname(origemPath).toLowerCase();
    const compressionLevel = midiaExtensions.includes(ext) ? 0 : 9;

    const output = fs.createWriteStream(destineZipPath);
    const archive = archiver('zip', { zlib: { level: compressionLevel } });

    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));

    archive.pipe(output);
    archive.file(origemPath, { name: zipFileName });
    archive.finalize();
  });
}