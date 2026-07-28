import fs from 'node:fs';
import path from 'node:path';
import youtubeDl from 'youtube-dl-exec';
import {defaultYtOptions} from '../config/youtubeConfig.js'
import {downloadConfig} from '../config/generalConfig.js'
import {createCookieFile, deleteCookieFile} from '../utils/cookieHelper.js';

/**
 * Baixa um vídeo do YouTube usando yt-dlp.
 * @param {string} url       - URL do YouTube
 * @param {string}fileName
 * @returns {Promise<string>} - Caminho do arquivo baixado
 */
export async function downloadYouTube(url, fileName) {
    const {directory, timeout} = downloadConfig;

    // Cria diretório se não existir
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, {
            recursive: true
        });
    }

    if (defaultYtOptions.proxy != null) {
        console.log('Usando proxy configurado pelo usuário: '+defaultYtOptions.proxy);
    }
    else{
        if (process.env.YOUTUBE_COOKIE) {
            defaultYtOptions.cookies = await createCookieFile(process.env.YOUTUBE_COOKIE);
            console.log('🍪 Usando cookie do .env para autenticação');
        } else {
            console.log('Tentando baixar sem cookies')
        }
    }

    // Nome base (sem extensão) – se fileName tiver extensão, removemos
    const baseName = fileName ? path.parse(fileName).name : 'video';
    const outputTemplate = path.join(directory, `${baseName}.%(ext)s`);

    const finalYtOptions = {...defaultYtOptions, output: outputTemplate};

    try {
        // Executa o download (passando timeout para o child_process)
        await youtubeDl(url, finalYtOptions, {timeout});

        // Localiza o arquivo gerado (pode ter extensões variadas)
        const possibleExtensions = ['.mp4', '.mkv', '.webm', '.flv', '.avi', '.mov'];
        let foundFile = null;
        for (const ext of possibleExtensions) {
            const candidate = path.join(directory, `${baseName}${ext}`);
            if (fs.existsSync(candidate)) {
                foundFile = candidate;
                break;
            }
        }
        // Se não encontrou, tenta qualquer arquivo que comece com baseName
        if (!foundFile) {
            const files = fs.readdirSync(directory);
            const matching = files.filter((f) => f.startsWith(baseName));
            if (matching.length > 0) {
                foundFile = path.join(directory, matching[0]);
            }
        }

        if (!foundFile) {
            throw new Error('Arquivo baixado não foi encontrado no diretório');
        }

        return foundFile;
    } catch (err) {
        throw new Error(`Falha no download do YouTube: ${err.message}`);
    } finally {
        await deleteCookieFile()
    }
}