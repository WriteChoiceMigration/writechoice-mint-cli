import docsData from './docs-data.json';

const TOOLS = [
  {
    name: 'list_docs',
    description: 'List all documentation pages with their titles, paths, and metadata',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_doc',
    description: 'Get the full content of one or more documentation pages by path. Pass a single path string or an array of paths for a batch read. Paths are returned by list_docs and search_docs.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          oneOf: [
            { type: 'string', description: 'A single doc path (e.g. "getting-started/installation")' },
            { type: 'array', items: { type: 'string' }, description: 'Multiple doc paths for a batch read' },
          ],
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_docs',
    description: 'Search documentation pages by keywords or phrase, returning scored results. Follow up with get_doc to read the full content of any result.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results to return (default 5, max 20)' },
        scoreThreshold: { type: 'number', description: 'Minimum relevance score 0–1 (default 0)' },
        version: { type: 'string', description: 'Filter results to a specific version' },
        language: { type: 'string', description: 'Filter results to a specific language code (e.g. "en")' },
      },
      required: ['query'],
    },
  },
];

function handleMcp(req, index) {
  const id = req.id ?? null;
  if (req.id === undefined && req.method?.startsWith('notifications/')) return null;
  switch (req.method) {
    case 'initialize':
      return { jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: index.meta?.name ?? "WriteChoice Mint CLI", version: '0.1.0' } } };
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
    case 'tools/call': {
      const { name, arguments: args = {} } = req.params ?? {};
      return { jsonrpc: '2.0', id, result: callTool(name, args, index) };
    }
    default:
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${req.method}` } };
  }
}

function callTool(name, args, index) {
  switch (name) {
    case 'list_docs': {
      if (!index.docs.length) return { content: [{ type: 'text', text: 'No docs indexed yet.' }] };
      const text = index.docs.map(d => {
        let line = `${d.path}  —  ${d.title}`;
        if (d.description) line += `\n  ${d.description}`;
        const meta = [d.version, d.language, ...(d.tags ?? [])].filter(Boolean).join(', ');
        if (meta) line += `\n  [${meta}]`;
        return line;
      }).join('\n');
      return { content: [{ type: 'text', text }] };
    }
    case 'get_doc': {
      const paths = Array.isArray(args.path) ? args.path : [String(args.path ?? '')];
      const results = [];
      const notFound = [];
      for (const p of paths) {
        const doc = index.docs.find(d => d.path === p || d.id === p || d.url === p || d.url === '/' + p);
        if (!doc) {
          notFound.push(p);
        } else {
          const body = [`# ${doc.title}`];
          if (doc.description) body.push(`\n> ${doc.description}`);
          body.push('', doc.content);
          results.push(body.join('\n'));
        }
      }
      if (notFound.length && !results.length) return { content: [{ type: 'text', text: `Doc(s) not found: ${notFound.map(p => `"${p}"`).join(', ')}. Use list_docs to see available paths.` }], isError: true };
      if (notFound.length) results.push(`\n> Not found: ${notFound.map(p => `"${p}"`).join(', ')}`);
      return { content: [{ type: 'text', text: results.join('\n\n---\n\n') }] };
    }
    case 'search_docs': {
      const query = String(args.query ?? '').trim();
      const limit = Math.min(Number(args.limit ?? 5), 20);
      const scoreThreshold = Number(args.scoreThreshold ?? 0);
      const filterVersion = args.version ? String(args.version) : null;
      const filterLanguage = args.language ? String(args.language) : null;
      if (!query) return { content: [{ type: 'text', text: 'Query cannot be empty.' }], isError: true };
      let pool = index.docs;
      if (filterVersion) pool = pool.filter(d => d.version === filterVersion);
      if (filterLanguage) pool = pool.filter(d => d.language === filterLanguage);
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      const scored = pool.map(doc => {
        const haystack = `${doc.title} ${doc.description} ${doc.content}`.toLowerCase();
        const tagHaystack = (doc.tags ?? []).join(' ').toLowerCase();
        const raw = words.reduce((s, w) => s + (doc.title.toLowerCase().split(w).length - 1) * 3 + (tagHaystack.split(w).length - 1) * 2 + (haystack.split(w).length - 1), 0);
        return { doc, score: raw };
      }).filter(r => r.score > 0);
      if (!scored.length) return { content: [{ type: 'text', text: `No results found for: "${query}"` }] };
      const maxScore = scored.reduce((m, r) => Math.max(m, r.score), 0);
      const results = scored
        .filter(r => r.score / maxScore >= scoreThreshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(r => r.doc);
      if (!results.length) return { content: [{ type: 'text', text: `No results found for: "${query}"` }] };
      const text = results.map(d => {
        const word = query.toLowerCase().split(/\s+/)[0];
        const idx = d.content.toLowerCase().indexOf(word);
        const start = Math.max(0, idx - 60);
        const snippet = d.content.slice(start, start + 200).replace(/\n+/g, ' ').trim();
        const meta = [d.version, d.language].filter(Boolean).join(', ');
        return `**${d.title}** (\`${d.path}\`)${d.url ? `  →  ${d.url}` : ''}${meta ? `  [${meta}]` : ''}\n${d.description || (start > 0 ? '...' : '') + snippet + '...'}`;
      }).join('\n\n');
      return { content: [{ type: 'text', text }] };
    }
    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet() {
  const toolsMap = Object.fromEntries(TOOLS.map(t => [t.name, t]));
  return Response.json({
    server: { name: docsData.meta?.name ?? "WriteChoice Mint CLI", version: '0.1.0', transport: 'http' },
    capabilities: { tools: toolsMap, resources: [], prompts: [] },
  }, { headers: CORS });
}

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      { status: 400, headers: CORS },
    );
  }
  if (Array.isArray(body)) {
    const responses = body.map(req => handleMcp(req, docsData)).filter(Boolean);
    return Response.json(responses, { headers: CORS });
  }
  const response = handleMcp(body, docsData);
  if (!response) return new Response(null, { status: 202, headers: CORS });
  return Response.json(response, { headers: CORS });
}
