import fs from 'node:fs';
import path from 'node:path';
import { finished } from 'node:stream/promises';
import {
    Readable
} from 'node:stream';
import archiver from 'archiver';


function zipFile(origemPath, destineZipPath, zipFileName) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(destineZipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => resolve());
        archive.on('error', (err) => reject(err));

        archive.pipe(output);
        // Adiciona o arquivo com o nome e extensão corretos dentro do zip
        archive.file(origemPath, { name: zipFileName });
        archive.finalize();
    });
}

export default async function downloadFile(url, fileName, options = {}) {
    const {
        directory = './downloads',
            timeout = 300000
    } = options;

    // Garante que o diretório existe
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, {
            recursive: true
        });
    }
    const filePath = path.join(directory, fileName);

    // Nome e caminho do arquivo ZIP final
    const zipName = `arquivo_${fileName}.zip`;
    const zipPath = path.join(directory, zipName);

    // AbortController para gerenciar o timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`Falha ao baixar arquivo: ${response.statusText}`);
        }

        // 1. Escreve o arquivo baixado temporariamente
        const writer = fs.createWriteStream(filePath);
        const body = Readable.fromWeb(response.body);

        body.pipe(writer);
        await finished(writer);

        // 2. Zipa o arquivo baixado
        await zipFile(filePath, zipPath, fileName);

        // Retorna o caminho do arquivo .zip final
        return { zipPath, zipName };

    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('Download cancelado por timeout');
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}