import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const COOKIE_FILE_NAME = 'yt-cookies.txt';

/**
 * Cria (ou sobrescreve) um arquivo de cookie no diretório temporário.
 * O nome do arquivo é fixo para facilitar a deleção posterior.
 * @param {string} cookieContent - Conteúdo do cookie (formato Netscape)
 * @returns {Promise<string>} - Caminho do arquivo criado
 */
export async function createCookieFile(cookieContent) {
    const tempDir = tmpdir();
    const tempFile = path.join(tempDir, COOKIE_FILE_NAME);

    // Cria o arquivo com permissões restritas (apenas o dono pode ler/escrever)
    await fs.writeFile(tempFile, cookieContent, { mode: 0o600 });
    console.log('🍪 Arquivo de cookie criado em:', tempFile);
    return tempFile;
}

/**
 * Remove o arquivo de cookie temporário.
 * Caso o arquivo não exista, ignora silenciosamente.
 * @returns {Promise<void>}
 */
export async function deleteCookieFile() {
    const tempDir = tmpdir();
    const tempFile = path.join(tempDir, COOKIE_FILE_NAME);

    try {
        await fs.unlink(tempFile);
        console.log('🗑️ Arquivo de cookie deletado');
    } catch (err) {
        // Se o arquivo não existir, não faz nada
        if (err.code !== 'ENOENT') {
            console.warn('⚠️ Não foi possível deletar o arquivo de cookie:', err.message);
        }
    }
}
