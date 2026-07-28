import { loadConfig, saveConfig } from '../config/configManager.js';
import { parseConfigCommand } from '../utils/configParser.js';

export async function handleConfigCommand(messageText) {
    const parsed = parseConfigCommand(messageText);
    if (!parsed) {
        return { error: 'Comando inválido. Use: set <chave> <valor> ou get <chave>' };
    }

    const config = await loadConfig();
    const { command, key, value } = parsed;

    if (command === 'set') {
        config[key] = value;
        await saveConfig(config);
        return {
            success: true,
            message: `✅ Configuração "${key}" definida como: ${value}`
        };
    } else if (command === 'get') {
        const stored = config[key];
        if (stored === undefined) {
            return { success: false, message: `❌ Chave "${key}" não encontrada.` };
        }
        return {
            success: true,
            message: `📌 "${key}" = ${stored}`
        };
    }
}
