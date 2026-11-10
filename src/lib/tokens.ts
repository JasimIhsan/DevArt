// Personal access tokens for the MCP server. The browser can list and revoke its own tokens through row level
// security; creating one goes through the create_api_token function, which returns the token once.
import { supabase } from './supabase.ts';

export interface ApiToken { id: string; name: string; prefix: string; createdAt: number; lastUsedAt: number | null }

/** Where MCP clients connect. */
export const mcpUrl = `${(import.meta.env.VITE_SUPABASE_URL as string | undefined ?? '').replace(/\/$/, '')}/functions/v1/mcp`;

export async function listTokens(): Promise<ApiToken[]> {
  const { data, error } = await supabase.from('api_tokens').select('id, name, prefix, created_at, last_used_at')
    .is('revoked_at', null).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({
    id: t.id as string, name: t.name as string, prefix: t.prefix as string,
    createdAt: Date.parse(t.created_at as string), lastUsedAt: t.last_used_at ? Date.parse(t.last_used_at as string) : null,
  }));
}

export async function createToken(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_api_token', { p_name: name });
  if (error) throw new Error(error.message);
  return (data as { token: string }[])[0].token;
}

export async function revokeToken(id: string) {
  const { error } = await supabase.from('api_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}
