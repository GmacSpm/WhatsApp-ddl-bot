import path from 'path';
import { defaultYtOptions } from '../config/youtubeConfig.js';

// TODO: Usar também o supabase para guardar preferência de usuário
export async function loadConfig() {
	return {
		'proxy': defaultYtOptions.proxy
	};
}

export async function saveConfig(config) {
    defaultYtOptions.proxy = config['proxy'];
}