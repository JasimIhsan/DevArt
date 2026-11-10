# Connect Claude to DevArt (MCP)

DevArt has an [MCP](https://modelcontextprotocol.io) server. Once connected, Claude Code (or any MCP client) can list, read, draw and edit **your** diagrams for you: "draw the architecture of our checkout system", "add a Redis cache between the API and the database", "what does the payments diagram show?"

It works with your DevArt account. Claude only ever sees and changes the diagrams of the person who created the token.

## Connect Claude Code

1. Sign in to DevArt, open the avatar menu (top right) and choose **Connect to Claude**.
2. Name the token (for example "Claude Code on my laptop") and press **Create token**.
3. **Copy the token now.** It is shown once. DevArt stores only a hash, so it can't be recovered. If you lose it, revoke it and create another.
4. Run the command shown in the dialog in your terminal:

   ```bash
   claude mcp add --transport http devart https://cjqqnlwxmvyszyxuhmko.supabase.co/functions/v1/mcp \
     --header "Authorization: Bearer dva_your_token_here"
   ```

5. Start Claude Code and run `/mcp`. `devart` should show as connected.

### Share the setup with a team (project `.mcp.json`)

Don't commit the token. Put it in an environment variable and reference it:

```json
{
  "mcpServers": {
    "devart": {
      "type": "http",
      "url": "https://cjqqnlwxmvyszyxuhmko.supabase.co/functions/v1/mcp",
      "headers": { "Authorization": "Bearer ${DEVART_TOKEN}" }
    }
  }
}
```

Each person creates their own token and sets `DEVART_TOKEN` in their shell. Every token belongs to one person, so teammates can't see each other's diagrams (shared diagrams are on the roadmap).

### Other MCP clients

Any client that supports remote (streamable HTTP) MCP servers works. Use the URL above and send the header `Authorization: Bearer <token>`. Clients that only support OAuth or stdio servers can't connect yet.

## What Claude can do

| Tool | What it does |
| --- | --- |
| `get_syntax_guide` | Returns the diagram syntax and examples for `architecture`, `flowchart`, `erd`, `sequence` or `bpmn`. Claude reads this first. |
| `list_templates` | Lists the ready-made example diagrams. |
| `list_diagrams` | Lists your diagrams, newest first, with links. |
| `get_diagram` | Returns a diagram's title and its code. |
| `create_diagram` | Creates a diagram from code and returns its link. |
| `update_diagram` | Replaces a diagram's code and/or renames it. |
| `delete_diagram` | Removes a diagram from your list. It is only marked deleted, so it can be restored from the database. |
| `render_diagram` | Renders a diagram, or unsaved code, to SVG to check how it looks. |

Code with errors is rejected and nothing is saved, so a mistake never leaves a broken diagram behind. Claude gets the error messages and can fix its code.

### Try it

> Use the devart MCP to draw a microservices architecture for an online shop: web and mobile apps, an API gateway, orders, payments and users services, each with its own database. Then show me the link.

> Open my "Checkout" diagram, add a Redis cache between the orders service and its database, and save it.

## Things to know

- **Reload the editor after Claude edits an open diagram.** The editor saves its whole canvas, so if a diagram is open in a browser tab while Claude changes it, the tab's next save can overwrite Claude's change. Close the tab or reload it before editing by hand.
- **Diagrams drawn by hand** (shapes, arrows and text placed on the canvas) can be listed, but Claude only edits the *diagram code* part. Diagrams created in DevArt's visual editor are stored as code, so those work.
- **Limits:** diagram code up to 100,000 characters, 10 active tokens per account.

## Revoke access

Open **Connect to Claude** again and press **Revoke** next to a token. It stops working immediately. Revoke a token if it was pasted somewhere it shouldn't be, or when you stop using that computer.

## Security

- A token is as powerful as you are, for diagrams only. It can't read your profile or anything outside DevArt.
- Tokens are random 192-bit values stored as SHA-256 hashes. The database never exposes the hash to the browser.
- The server uses the Supabase service role key (which bypasses row level security), so every query is explicitly limited to the token owner's diagrams. Keep that rule in any new tool; see the comment at the top of `supabase/functions/mcp/index.ts`.

## For maintainers: deploy the server

The MCP server is a Supabase Edge Function in `supabase/functions/mcp`. It imports the diagram parser and renderer from `src/core`, so Claude draws with exactly the same engine as the editor.

1. Apply the database migration `supabase/migrations/20261110010000_api_tokens.sql` (`supabase db push`, the SQL editor, or the Supabase MCP). It adds the `api_tokens` table and the `create_api_token` function.
2. Deploy the function. The token is not a Supabase JWT, so JWT verification must be off:

   ```bash
   supabase functions deploy mcp --no-verify-jwt
   ```

   Without the Supabase CLI, run `npm run mcp:bundle` and deploy `dist-mcp/index.js` as the function's `index.js` entry file with JWT verification off.
3. Optional: set the `APP_URL` secret (`supabase secrets set APP_URL=https://your-domain`) so links Claude returns point at your domain. It defaults to `https://devart.jasimihsan.in`.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to Edge Functions automatically.

### Check it works

```bash
curl -s https://cjqqnlwxmvyszyxuhmko.supabase.co/functions/v1/mcp \
  -H "Authorization: Bearer dva_your_token_here" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

A list of tools means it works. `401` means the token is missing, wrong or revoked.
