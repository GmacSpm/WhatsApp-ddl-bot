import fs from 'node:fs';
import path from 'node:path';
import {
    finished
} from 'node:stream/promises';
import {
    Readable
} from 'node:stream';

import {downloadConfig} from '../config/generalConfig.js'

/**
 * Baixa um arquivo via fetch (para URLs que não são do YouTube)
 */
export async function downloadGeneric(url, fileName) {
    const {directory, timeout} = downloadConfig;

    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, {
            recursive: true
        });
    }

    const filePath = path.join(directory, fileName);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {signal: controller.signal});
        if (!response.ok) {
            throw new Error(`Falha ao baixar arquivo: ${response.statusText}`);
        }
        const writer = fs.createWriteStream(filePath);
        const body = Readable.fromWeb(response.body);
        body.pipe(writer);
        await finished(writer);
        return filePath;
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('Download cancelado por timeout');
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}