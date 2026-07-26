import path from 'node:path';
import {
    downloadYouTube
} from './downloadYoutube.js';
import {
    downloadGeneric
} from './downloadGeneric.js';
import {
    isYouTubeUrl
} from '../utils/urlUtils.js';
import {
    zipFile
} from '../utils/zipUtils.js';

/**
 * Função principal: baixa um arquivo a partir de uma URL.
 * Se a URL for do YouTube, usa yt-dlp; senão, usa fetch.
 * Ao final, compacta o arquivo em um ZIP e retorna o caminho do ZIP.
 *
 * @param {string} url          - URL do arquivo/vídeo
 * @param {string} fileName     - Nome desejado para o arquivo (com extensão ou sem)
 * @returns {Promise<{ zipPath: string, zipName: string }>}
 */
export default async function downloadFile(url, fileName) {
    const directory = './downloads';
    // 1. Escolhe o método de download com base na URL
    let downloadedPath;
    if (isYouTubeUrl(url)) {
        downloadedPath = await downloadYouTube(url, fileName);
    } else {
        // Para URLs genéricas, o fileName deve ter extensão
        downloadedPath = await downloadGeneric(url, fileName);
    }

    // 2. Zipa o arquivo baixado
    const zipName = `arquivo_${path.basename(downloadedPath)}.zip`;
    const zipPath = path.join(directory, zipName);
    await zipFile(downloadedPath, zipPath, path.basename(downloadedPath));

    // (Opcional) Remove o arquivo original se quiser economizar espaço
    // fs.unlinkSync(downloadedPath);

    return {
        zipPath,
        zipName
    };
}