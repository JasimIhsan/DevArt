// DevArt MCP server: lets Claude Code and other MCP clients read and draw the signed-in person's diagrams.
// Stateless MCP over HTTP (JSON-RPC in a POST). Auth is a personal access token created in DevArt
// (Account menu > Connect to Claude); see docs/mcp.md.
//
// This function uses the service role key, which bypasses row level security. That is why every query
// below is filtered by `owner_id` of the token's owner: never add a query that skips `.eq('owner_id', uid)`.
//
// Deploy: `npm run mcp:bundle` then `supabase functions deploy mcp --no-verify-jwt`
// (verify_jwt is off because the bearer is a DevArt token, not a Supabase JWT).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseDiagram } from '../../../src/core/dsl.ts';
import { SYNTAX_REFERENCE } from '../../../src/core/dsl.ts';
import { diagramSize, renderDiagram } from '../../../src/core/render.ts';
import { TEMPLATES } from '../../../src/core/templates.ts';
import { DIAGRAM_TYPES, type CanvasElement, type DiagramType, type Theme } from '../../../src/core/types.ts';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Response | Promise<Response>): void };

const SERVER = { name: 'devart', version: '1.0.0' };
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://devart.jasimihsan.in').replace(/\/$/, '');
const MAX_CODE = 100_000;

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version, mcp-session-id',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

// ---------- auth ----------

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Returns the id of the user who owns the bearer token, or null if it is missing, unknown or revoked. */
async function authenticate(req: Request): Promise<string | null> {
  const m = /^Bearer\s+(dva_[0-9a-f]{48})$/.exec(req.headers.get('authorization') ?? '');
  if (!m) return null;
  const { data } = await db.from('api_tokens').select('id, owner_id, last_used_at').eq('token_hash', await sha256(m[1])).is('revoked_at', null).maybeSingle();
  if (!data) return null;
  if (!data.last_used_at || Date.now() - Date.parse(data.last_used_at) > 60_000) {
    await db.from('api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);
  }
  return data.owner_id as string;
}

// ---------- tools ----------

class ToolError extends Error {}
type Args = Record<string, unknown>;

const str = (a: Args, k: string, max = 200): string | undefined => {
  const v = a[k];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') throw new ToolError(`"${k}" must be a string`);
  if (v.length > max) throw new ToolError(`"${k}" is too long (max ${max} characters)`);
  return v;
};
const need = (a: Args, k: string, max?: number) => {
  const v = str(a, k, max);
  if (!v?.trim()) throw new ToolError(`"${k}" is required`);
  return v;
};
const diagramType = (a: Args, fallback?: DiagramType): DiagramType => {
  const v = str(a, 'type') ?? fallback;
  if (!v || !(DIAGRAM_TYPES as string[]).includes(v)) throw new ToolError(`"type" must be one of: ${DIAGRAM_TYPES.join(', ')}`);
  return v as DiagramType;
};
const uuid = (a: Args) => {
  const id = need(a, 'id');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ToolError('"id" must be a diagram id from list_diagrams');
  return id;
};

const fmtIssues = (issues: { line: number; message: string; severity: string }[]) =>
  issues.map((i) => `${i.severity} (line ${i.line}): ${i.message}`);
const diagramEls = (els: CanvasElement[]) => els.filter((e) => e.type === 'diagram');
const link = (id: string) => `${APP_URL}/f/${id}`;

async function load(uid: string, id: string) {
  const { data, error } = await db.from('files').select('id, title, canvas, updated_at').eq('id', id).eq('owner_id', uid).is('deleted_at', null).maybeSingle();
  if (error) throw new ToolError(error.message);
  if (!data) throw new ToolError('No diagram with that id. Use list_diagrams to see yours.');
  return data as { id: string; title: string; canvas: CanvasElement[]; updated_at: string };
}

/** Checks code and returns issues; refuses code with errors so a broken diagram is never saved. */
function check(type: DiagramType, code: string) {
  if (code.length > MAX_CODE) throw new ToolError(`Diagram code is too long (max ${MAX_CODE} characters)`);
  const issues = renderDiagram(type, code).issues;
  const errors = issues.filter((i) => i.severity === 'error');
  if (errors.length) throw new ToolError(`The diagram code has errors, nothing was saved:\n${fmtIssues(errors).join('\n')}\nCall get_syntax_guide for the syntax.`);
  return issues.filter((i) => i.severity === 'warning');
}

const TOOLS: { name: string; description: string; inputSchema: object; run: (uid: string, a: Args) => Promise<unknown> }[] = [
  {
    name: 'get_syntax_guide',
    description: 'Returns the DevArt diagram-as-code syntax with examples for a diagram type. Read this before writing diagram code.',
    inputSchema: { type: 'object', properties: { type: { type: 'string', enum: DIAGRAM_TYPES, description: 'Defaults to architecture.' } } },
    run: async (_u, a) => { const t = diagramType(a, 'architecture'); return SYNTAX_REFERENCE[t]; },
  },
  {
    name: 'list_templates',
    description: 'Lists ready-made example diagrams. Their code is a good starting point to adapt.',
    inputSchema: { type: 'object', properties: { include_code: { type: 'boolean', description: 'Include each template\'s code. Default false.' } } },
    run: async (_u, a) => TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, type: t.type, ...(a.include_code ? { code: t.code } : {}) })),
  },
  {
    name: 'list_diagrams',
    description: 'Lists your diagrams, most recently edited first.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Default 50.' } } },
    run: async (uid, a) => {
      const limit = Math.min(Math.max(Number(a.limit) || 50, 1), 100);
      const { data, error } = await db.from('files').select('id, title, canvas, updated_at').eq('owner_id', uid).is('deleted_at', null).order('updated_at', { ascending: false }).limit(limit);
      if (error) throw new ToolError(error.message);
      return (data ?? []).map((f) => ({
        id: f.id, title: f.title, updated_at: f.updated_at, url: link(f.id),
        diagram_types: diagramEls(f.canvas as CanvasElement[]).map((e) => e.diagramType ?? 'architecture'),
      }));
    },
  },
  {
    name: 'get_diagram',
    description: 'Returns a diagram\'s title and its diagram code, which you can edit and send back with update_diagram.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string', description: 'Diagram id from list_diagrams.' } } },
    run: async (uid, a) => {
      const f = await load(uid, uuid(a));
      return {
        id: f.id, title: f.title, updated_at: f.updated_at, url: link(f.id),
        diagrams: diagramEls(f.canvas).map((e) => ({ element_id: e.id, type: e.diagramType ?? 'architecture', code: e.code ?? '' })),
        other_elements: f.canvas.length - diagramEls(f.canvas).length,
      };
    },
  },
  {
    name: 'create_diagram',
    description: 'Creates a new diagram from diagram code and returns its link. Call get_syntax_guide first if unsure of the syntax. Code with errors is rejected.',
    inputSchema: {
      type: 'object', required: ['title', 'code'],
      properties: {
        title: { type: 'string', description: 'Diagram name, up to 200 characters.' },
        code: { type: 'string', description: 'Diagram code in DevArt syntax.' },
        type: { type: 'string', enum: DIAGRAM_TYPES, description: 'Default architecture.' },
      },
    },
    run: async (uid, a) => {
      const title = need(a, 'title').trim();
      const code = need(a, 'code', MAX_CODE + 1);
      const type = diagramType(a, 'architecture');
      const warnings = check(type, code);
      const size = diagramSize({ diagramType: type, code });
      const el: CanvasElement = { id: crypto.randomUUID().slice(0, 12), type: 'diagram', x: 0, y: 0, z: 1, ...size, diagramType: type, code, title };
      const { data, error } = await db.from('files').insert({ owner_id: uid, title, canvas: [el] }).select('id').single();
      if (error) throw new ToolError(error.message);
      return { id: data.id, url: link(data.id), warnings: fmtIssues(warnings) };
    },
  },
  {
    name: 'update_diagram',
    description: 'Replaces a diagram\'s code and/or renames it. Send the complete new code, not a patch. Code with errors is rejected. Changes made while the diagram is open in the editor may be overwritten by the editor\'s next save, so reload the page afterwards.',
    inputSchema: {
      type: 'object', required: ['id'],
      properties: {
        id: { type: 'string' },
        code: { type: 'string', description: 'Complete new diagram code.' },
        title: { type: 'string' },
        element_id: { type: 'string', description: 'Which diagram to change when a file holds several. Defaults to the first.' },
      },
    },
    run: async (uid, a) => {
      const f = await load(uid, uuid(a));
      const code = str(a, 'code', MAX_CODE + 1);
      const title = str(a, 'title')?.trim();
      if (code === undefined && !title) throw new ToolError('Send "code" and/or "title" to change');
      let canvas = f.canvas;
      let warnings: ReturnType<typeof check> = [];
      if (code !== undefined) {
        const target = str(a, 'element_id');
        const cur = diagramEls(canvas).find((e) => !target || e.id === target);
        if (!cur) throw new ToolError(target ? 'No diagram with that element_id in this file' : 'This file has no diagram to edit. Use create_diagram to make a new one.');
        const type = cur.diagramType ?? 'architecture';
        warnings = check(type, code);
        // Keep any scale the person dragged the diagram to, as the editor does.
        const scale = cur.w / (diagramSize(cur).w || 1);
        const size = diagramSize({ ...cur, code });
        canvas = canvas.map((e) => (e.id === cur.id ? { ...e, code, w: size.w * scale, h: size.h * scale } : e));
      }
      const { error } = await db.from('files').update({ canvas, ...(title ? { title } : {}) }).eq('id', f.id).eq('owner_id', uid);
      if (error) throw new ToolError(error.message);
      return { id: f.id, url: link(f.id), warnings: fmtIssues(warnings) };
    },
  },
  {
    name: 'delete_diagram',
    description: 'Deletes a diagram from your list. It is only marked deleted, so it can be restored from the database.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    run: async (uid, a) => {
      const f = await load(uid, uuid(a));
      const { error } = await db.from('files').update({ deleted_at: new Date().toISOString() }).eq('id', f.id).eq('owner_id', uid);
      if (error) throw new ToolError(error.message);
      return { deleted: f.id, title: f.title };
    },
  },
  {
    name: 'render_diagram',
    description: 'Renders a diagram to SVG text, to check how it looks. Pass the id of a saved diagram, or "code" (and "type") to preview code without saving. Also reports any warnings.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' }, code: { type: 'string' }, type: { type: 'string', enum: DIAGRAM_TYPES },
        theme: { type: 'string', enum: ['light', 'dark'] },
      },
    },
    run: async (uid, a) => {
      let type: DiagramType; let code: string;
      if (a.id) {
        const f = await load(uid, uuid(a));
        const cur = diagramEls(f.canvas)[0];
        if (!cur) throw new ToolError('This file has no diagram to render');
        type = cur.diagramType ?? 'architecture'; code = cur.code ?? '';
      } else { type = diagramType(a, 'architecture'); code = need(a, 'code', MAX_CODE + 1); }
      if (code.length > MAX_CODE) throw new ToolError('Diagram code is too long');
      const theme: Theme = a.theme === 'dark' ? 'dark' : 'light';
      const r = renderDiagram(type, code, { theme, background: true });
      return { width: r.width, height: r.height, issues: fmtIssues(r.issues), svg: r.svg };
    },
  },
];

// ---------- JSON-RPC ----------

interface Rpc { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }
const ok = (id: Rpc['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result });
const err = (id: Rpc['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

async function handle(msg: Rpc, uid: string) {
  const isNotification = msg.id === undefined;
  switch (msg.method) {
    case 'initialize': {
      const asked = String(msg.params?.protocolVersion ?? '');
      return ok(msg.id, {
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: 'DevArt draws architecture diagrams from text. Call get_syntax_guide before writing code. Use list_diagrams and get_diagram to read existing diagrams, create_diagram or update_diagram to draw, and render_diagram to check the result.',
      });
    }
    case 'ping': return ok(msg.id, {});
    case 'tools/list': return ok(msg.id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === msg.params?.name);
      if (!tool) return err(msg.id, -32602, `Unknown tool: ${String(msg.params?.name)}`);
      try {
        const out = await tool.run(uid, (msg.params?.arguments ?? {}) as Args);
        return ok(msg.id, { content: [{ type: 'text', text: typeof out === 'string' ? out : JSON.stringify(out, null, 2) }] });
      } catch (e) {
        const text = e instanceof ToolError ? e.message : 'Something went wrong on the server';
        if (!(e instanceof ToolError)) console.error(e);
        return ok(msg.id, { isError: true, content: [{ type: 'text', text }] });
      }
    }
    default:
      if (isNotification || msg.method?.startsWith('notifications/')) return null;
      return err(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'This is an MCP endpoint. Connect with an MCP client; see docs/mcp.md.' }, 405);

  const uid = await authenticate(req);
  if (!uid) {
    return new Response(JSON.stringify(err(null, -32001, 'Missing or invalid DevArt token. Create one in DevArt: account menu > Connect to Claude.')), {
      status: 401, headers: { ...CORS, 'content-type': 'application/json', 'www-authenticate': 'Bearer realm="devart"' },
    });
  }

  let body: Rpc | Rpc[];
  try { body = await req.json(); } catch { return json(err(null, -32700, 'Parse error'), 400); }
  const batch = Array.isArray(body);
  const replies = (await Promise.all((batch ? body : [body]).map((m) => handle(m, uid)))).filter((r) => r !== null);
  if (!replies.length) return new Response(null, { status: 202, headers: CORS });
  return json(batch ? replies : replies[0]);
});
