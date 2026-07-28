import { initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys';
import type { AuthenticationState } from '@whiskeysockets/baileys';
import { SupabaseClient } from '@supabase/supabase-js';

export async function clearAuthState(supabase: SupabaseClient, clientId: string) {
    await supabase.from('whatsapp_keys').delete().eq('client_id', clientId);

    await supabase.from('whatsapp_creds').delete().eq('client_id', clientId);

    console.log('🗑 Sessão removida do Supabase');
}

export async function useSupabaseAuthState(supabase: SupabaseClient, clientId: string) {
    // ---------- CREDS ----------
    const { data } = await supabase.from('whatsapp_creds').select('creds').eq('client_id', clientId).single();

    const creds = data?.creds ? JSON.parse(JSON.stringify(data.creds), BufferJSON.reviver) : initAuthCreds();

    async function saveCreds() {
        await supabase.from('whatsapp_creds').upsert({
            client_id: clientId,
            creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer))
        });
    }

    // ---------- KEYS ----------
    const keys: AuthenticationState['keys'] = {
        async get(type, ids) {
            const { data } = await supabase
                .from('whatsapp_keys')
                .select('id,value')
                .eq('client_id', clientId)
                .eq('category', type)
                .in('id', ids);

            const result = {};

            for (const id of ids) result[id] = undefined;

            for (const row of data ?? []) {
                let value = JSON.parse(JSON.stringify(row.value), BufferJSON.reviver);

                if (type === 'app-state-sync-key') {
                    value = proto.Message.AppStateSyncKeyData.fromObject(value);
                }
                result[row.id] = value;
            }
            return result;
        },
        async set(data) {
            const upserts = [];
            const deletes = [];

            for (const category in data) {
                for (const id in data[category]) {
                    const value = data[category][id];
                    if (value) {
                        upserts.push({
                            client_id: clientId,
                            category,
                            id,
                            value: JSON.parse(JSON.stringify(value, BufferJSON.replacer))
                        });
                    } else {
                        deletes.push({ category, id });
                    }
                }
            }
            if (upserts.length) {
                await supabase.from('whatsapp_keys').upsert(upserts);
            }
            for (const item of deletes) {
                await supabase
                    .from('whatsapp_keys')
                    .delete()
                    .eq('client_id', clientId)
                    .eq('category', item.category)
                    .eq('id', item.id);
            }
        }
    };
    return { state: { creds, keys }, saveCreds };
}
