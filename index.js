import baileys, {
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} from '@whiskeysockets/baileys';
import Pino from 'pino';
import fs from 'fs';
import downloadFile from './services/fileDownload.js';
import qrcode from "qrcode-terminal";
import express from "express";

const app = express();
const port = process.env.PORT || 4000;

let botStatus = "Inicializando...";

// Extrai o makeWASocket da propriedade default do pacote importado
const makeWASocket = baileys.default || baileys;
const authFolder = './auth';
const phoneNumber = process.env.PHONE_NUMBER || "+55000000000";
console.log('Número usado: ' + phoneNumber)
let pairingRequested = false
let tries = 0;

async function clearAuth() {
    if (fs.existsSync(authFolder)) {
        fs.rmSync(authFolder, {
            recursive: true,
            force: true
        });
        console.log("🗑 Pasta auth removida com sucesso.");
    }
}

// MAP pra guardar o estado de cada usuário: { jid: { filePath, step } }
const pendingFiles = new Map();

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
        const {
            connection,
            lastDisconnect,
            qr
        } = update

        if (connection === 'connecting') {
            console.log('⏳ Conectando aos servidores do WhatsApp...')
            botStatus = "Conectando ao servidores...";
        }

        if (qr && !pairingRequested) {

            qrcode.generate(qr, {
                small: true
            });
            const pairingCode = await sock.requestPairingCode(
                phoneNumber)
            console.log('🔒 Código de pareamento: ' + pairingCode)
            pairingRequested = true;
            botStatus = "Aguardando pareamento...";
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
                isNetworkError: statusCode === DisconnectReason.connectionLost ||
                    statusCode === DisconnectReason.timedOut
            };

            if (logic.isLoggedOut || logic.isAuthFailure || statusCode ===
                428) {
                console.log(
                    '❌ Sessão inválida. Limpando dados e aguardando novo QR...'
                );
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
                botStatus = "Tentando reconectar...";
            }
        }

        if (connection === 'open') {
            console.log('✅ Bot conectado e pronto!')
            botStatus = "✅ Bot conectado e pronto!";
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

        // 1. VERIFICA SE ESTÁ ESPERANDO NOME DO ARQUIVO DESSE USUÁRIO
        if (pendingFiles.has(jid)) {
            const pending = pendingFiles.get(jid);

            if (pending.step === 'waiting_name') {
                // Pega o que o usuário digitou como "nome.extensao"
                const userInput = text.trim();
                const [nome, ...extParts] = userInput.split('.');
                const extensao = extParts.join('.') || 'bin'; // se não tiver . pega bin

                const novoNome = `${nome}.${extensao}`;

                try {
                    await sock.sendMessage(jid, {text: '⏬ Baixando arquivo...'})
                    console.log("Novo nome: " + novoNome)
                    const {zipPath, zipName} = await downloadFile(pending.link, novoNome) // só pega o path

                    await sock.sendMessage(jid, {text: `⏳ Enviando zipado como: *${novoNome}*`})

                    await sock.sendMessage(jid, {
                        document: {url: zipPath},
                        fileName: zipName,
                        mimetype: 'application/zip'
                    })

                    //fs.unlinkSync(zipPath) // apaga temp
                    pendingFiles.delete(jid) // limpa estado
                    await sock.sendMessage(jid, {text: '✅ Enviado!'})

                } catch (err) {
                    console.error(err)
                    await sock.sendMessage(jid, {text: '❌ Falha ao enviar.'})
                    pendingFiles.delete(jid)
                }
            }
            return; // para aqui pra não cair nos outros ifs
        }

        // 2. SE NÃO ESTIVER ESPERANDO, VERIFICA SE É LINK
        if (text.startsWith('https://')) {
            try {
                // Envia mensagem pedindo nome de arquivo antes de baixar.
                await sock.sendMessage(jid, {
                    text: 'Agora me diga o *nome e extensão* que você quer.\nEx: `relatorio.pdf` ou `video.mp4`'
                })
                // Guarda o arquivo e muda o estado
                pendingFiles.set(jid, {link: text, step: 'waiting_name'});
            } catch (err) {
                console.error(err)
                await sock.sendMessage(jid, {text: '❌ Falha ao baixar o arquivo.'})
            }
        }

        if (text === 'ping') {
            await sock.sendMessage(jid, {text: 'pong'})
        }
    })
}

connectToWhatsApp()

app.get('/', (req, res) => {
    res.json({
        status: "sucesso",
        bot_status: botStatus,
        uptime: process.uptime(), // tempo que o servidor está rodando em segundos
        timestamp: new Date()
    });
});

app.listen(port, () => {
    console.log(`Servidor de status rodando na porta ${port}`);
});