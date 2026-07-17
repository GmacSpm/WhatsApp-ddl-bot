import fs from 'node:fs';
import path from 'node:path';
import {
    Readable
} from 'node:stream';
import {
    finished
} from 'node:stream/promises';
import {
    pipeline
} from 'stream/promises';

export default async function downloadFile(url, options = {}) {
    const {
        directory = './downloads',
            timeout = 40000,
            extension = 'zip'
    } = options;

    // Garante que o diretório existe
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, {
            recursive: true
        });
    }

    const nomeArquivo = `arquivo_${Date.now()}.${extension}`;
    const filePath = path.join(directory, nomeArquivo);

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

        const body = Readable.fromWeb(response.body);
        await pipeline(body, fs.createWriteStream(filePath));

        return {
            filePath,
            nomeArquivo
        };

    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('Download cancelado por timeout');
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}