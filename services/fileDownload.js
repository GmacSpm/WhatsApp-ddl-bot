import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

export default async function downloadFile(url, options = {}) {
    const {
        directory = './downloads',
        timeout = 30000,
        extension = 'zip'
    } = options;

    // Garante que o diretório existe
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }

    const nomeArquivo = `arquivo_${Date.now()}.${extension}`;
    const filePath = path.join(directory, nomeArquivo);

    // AbortController para gerenciar o timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            // O fetch nativo do Node aceita URLs http:// e https:// por padrão
        });

        if (!response.ok) {
            throw new Error(`Falha ao baixar arquivo: ${response.statusText}`);
        }

        const writer = fs.createWriteStream(filePath);

        // Converte o corpo da resposta (Web Stream) para um Node.js Stream
        const body = Readable.fromWeb(response.body);

        body.pipe(writer);

        // Aguarda a finalização da escrita com segurança
        await finished(writer);

        return { filePath, nomeArquivo };
    } finally {
        clearTimeout(timeoutId);
    }
}