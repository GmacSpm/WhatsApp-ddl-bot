import baileys, {
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} from '@whiskeysockets/baileys';
import Pino from 'pino';
import fs from 'fs';
import downloadFile from './services/fileDownload.js';
import readline from 'readline';
import qrcode from "qrcode-terminal";

// Extrai o makeWASocket da propriedade default do pacote importado
const makeWASocket = baileys.default || baileys;

const authFolder = './auth';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));
// const phoneNumber = await question("❓ Qual seu número de WhatsApp? (sem +): ")
const phoneNumber = process.env.PHONE_NUMBER || "+55000000000";
 console.log('Número usado: ' + phoneNumber)
let pairingRequested = false
let tries = 0;

async function clearAuth() {
    if (fs.existsSync(authFolder)) {
        fs.rmSync(authFolder, {recursive: true, force: true});
        console.log("🗑 Pasta auth removida com sucesso.");
    }
}

async function connectToWhatsApp() {
    const {state, saveCreds} = await useMultiFileAuthState(authFolder)
    const {version} = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: Pino({level: 'silent'}),
        browser: ["Ubuntu", "Firefox", "140.0"],
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
        const {connection, lastDisconnect, qr} = update

        if (connection === 'connecting') {
            console.log('⏳ Conectando aos servidores do WhatsApp...')
        }

        if (qr && !pairingRequested) {

            qrcode.generate(qr, {small: true});
            const pairingCode = await sock.requestPairingCode(phoneNumber)
            console.log('🔒 Código de pareamento: ' + pairingCode)
            pairingRequested = true;
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;

            // Log detalhado para debug no Sublime/Terminal
            console.log(`🔌 Conexão fechada. Status Code: ${statusCode}`);

            const logic = {
                isRestart: statusCode === DisconnectReason.restartRequired,
                // Sessão expirada ou deslogada pelo celular
                isLoggedOut: statusCode === DisconnectReason.loggedOut,
                // Erro de autenticação (precisa de novo login)
                isAuthFailure: statusCode === 401,
                // Conexão perdida (internet, servidor do WhatsApp caiu)
                isNetworkError: statusCode === DisconnectReason.connectionLost || statusCode === DisconnectReason.timedOut
            };

            if (logic.isLoggedOut || logic.isAuthFailure || statusCode === 428) {
                console.log('❌ Sessão inválida. Limpando dados e aguardando novo QR...');
                // Função para apagar a pasta de sessão (deve ser síncrona ou await)
                setTimeout(() => {
                    clearAuth();
                    connectToWhatsApp();
                    pairingRequested = false;
                }, 5000);
            } else if (logic.isRestart) {
                console.log("⏳ Finalizando conexão")
                connectToWhatsApp()
                tries = 0;
            } else if (tries < 3) {
                // Para qualquer outro erro (queda de net, etc), tenta reconectar
                console.log("🔄 Tentando reconectar automaticamente...");
                connectToWhatsApp();
                tries = tries + 1;
                console.log(tries);
            }
        }

        if (connection === 'open') {
            console.log('✅ Bot conectado e pronto!')
        }
    })

    sock.ev.on('messages.upsert', async (msg) => {
        if (msg.type !== 'notify') return

        const message = msg.messages[0]
        if (!message.message) return

        const jid = message.key.remoteJid
        const text =
            message.message.conversation ||
            message.message.extendedTextMessage?.text

        if (text === undefined) return

        console.log('Mensagem recebida:', text)

       if (text.startsWith('https://')) {
    try {
        await sock.sendMessage(jid, { text: '⏬ Baixando arquivo...' });

        const { filePath, nomeArquivo } = await downloadFile(text);

        // Verifica se o arquivo realmente foi baixado antes de prosseguir
        if (!fs.existsSync(filePath)) {
            throw new Error('Arquivo não encontrado no disco após o download.');
        }

        // 🚀 CORREÇÃO: Envia usando Stream (fs.createReadStream) em vez de ler tudo na RAM
        await sock.sendMessage(jid, {
            document: fs.createReadStream(filePath), 
            fileName: nomeArquivo,
            mimetype: 'application/octet-stream' // Aceita qualquer tipo de arquivo de forma segura
        });

        // Pequeno delay de 1 segundo antes de deletar para dar tempo do Node fechar o stream
        setTimeout(() => {
            try {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch (e) {
                console.error('Erro ao deletar arquivo temporário:', e.message);
            }
        }, 1000);

    } catch (err) {
        console.error('❌ Erro no processo de download/envio:', err);
        
        // Evita que o bot quebre se o erro for na própria conexão do whatsapp
        try {
            await sock.sendMessage(jid, {
                text: '❌ Falha ao baixar ou enviar o arquivo.'
            });
        } catch (msgErr) {
            console.error('Não foi possível enviar a mensagem de erro ao usuário:', msgErr.message);
        }
    }
}

        // 7. Resposta simples
        if (text === 'ping') {
            await sock.sendMessage(jid, {text: 'pong'})
        }
    })
}

connectToWhatsApp()
rl.close()