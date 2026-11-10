# DevArt

Design and visualize system architectures effortlessly. DevArt creates architecture diagrams: drag components onto a canvas and connect them, or edit the diagram as code.

DevArt is serverless. The app is a static [Vite](https://vite.dev) + React build hosted on Vercel. [Supabase](https://supabase.com) provides Google sign-in and the Postgres database, and every diagram is protected by row level security so people only see their own.

## Run it

Requires Node.js 24 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:5173
```

`npm run build` makes the production site in `dist/`, and `npm run preview` serves it.

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | browser | Project URL |
| `VITE_SUPABASE_ANON_KEY` | browser | The project's anon (publishable) key. It is public by design, and RLS is what protects the data. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | local only | Used by `npm run import:local`. The service role key bypasses RLS: never put it in Vercel or prefix it with `VITE_`. |

## Set up Supabase

1. **Schema.** Apply `supabase/migrations/20261110000000_init.sql` to the project, with the Supabase CLI (`supabase db push`), the SQL editor, or the Supabase MCP. It creates `profiles` and `files` with RLS policies.
2. **Google sign-in.** In Google Cloud Console, create an OAuth client (type *Web application*) and add `https://cjqqnlwxmvyszyxuhmko.supabase.co/auth/v1/callback` as an authorised redirect URI. In Supabase, go to Authentication > Sign In / Providers > Google, enable it, and paste the client ID and secret.
3. **Redirect URLs.** In Authentication > URL Configuration, set the Site URL to your Vercel domain and add it, plus `http://localhost:5173`, to the redirect allow list. Add preview domains (for example `https://*-<team>.vercel.app`) if you want sign-in on previews.

## Connect Claude (MCP)

Claude Code can list, read, draw and edit your diagrams through DevArt's MCP server, a Supabase Edge Function. Create a token from the avatar menu > **Connect to Claude**. See [docs/mcp.md](docs/mcp.md) for the connection guide and deploy steps.

## Deploy to Vercel

Import the repository in Vercel. `vercel.json` sets the Vite build, the output folder, and the fallback that makes `/f/<id>` links work. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Project Settings > Environment Variables, then deploy. There are no functions or servers.

## Move your local data

Earlier versions stored diagrams in `data/devart.db`. After you've signed in to the app with Google once:

```bash
# put SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first
npm run import:local -- --email you@gmail.com --dry-run   # lists what would be uploaded
npm run import:local -- --email you@gmail.com
```

Deleted and untouched blank diagrams are skipped (add `--include-deleted` to bring deleted ones too). It's safe to run twice: already imported diagrams are skipped.

## The editor

| To | Do this |
| --- | --- |
| Add a component | Drag it from the left panel onto the canvas |
| Connect components | Choose **Connect** and drag from one to another, or drag the dot beside a selected component |
| Rename | Double-click, or use the right panel, which also sets the description, icon, and colour |
| Move or resize | Drag the component, or drag the square at its corner |
| Group | Drag a **Group** onto the canvas, then drag components in or out |
| Change a connection | Click it to set its label, line, and arrows, or reverse its direction |
| Delete | Select it and press Delete |
| Zoom and pan | Ctrl+scroll or the zoom buttons to zoom. Drag empty canvas or scroll to pan |
| Undo and redo | Ctrl+Z and Ctrl+Shift+Z, or the buttons at the top right |

**Arrange automatically** in the right panel resets positions to the automatic layout. **Edit as code** shows the diagram's code, which stays in step with visual edits. **Export** gives you PNG, SVG, or PDF at 1x, 2x, or 3x, with an option for a transparent background. Changes save to your account as you work.

The home page also lists **templates** to start from. See [Templates](#templates).

## Install as an app

DevArt is a Progressive Web App. In Chrome or Edge, click **Install app** on the home page, or use the install icon in the address bar. New versions install in the background and show an **Update** button when ready. Diagrams are stored in Supabase, so editing needs a connection.

## Export

**Export** in the editor gives PNG, SVG, or PDF at 1x, 2x, or 3x, with an option for a transparent background. Everything is rendered in the browser. PDF pages keep the diagram's size, and the scale sets the resolution of the image inside. Mermaid text for a diagram is available from its panel.

## Mermaid

DevArt converts to and from the common parts of [Mermaid](https://mermaid.js.org):

| DevArt | Mermaid |
| --- | --- |
| Architecture and flow chart | `flowchart` or `graph`: node shapes, `subgraph`, link labels in both forms, `&` and chained links, dotted and thick links, `style`, `classDef`, and `:::class` fills and colours |
| Sequence | `sequenceDiagram`: `participant` and `actor` with `as`, all arrow types, `+`/`-` activation, `activate`, `autonumber`, and `alt`/`else`, `opt`, `loop`, `par`/`and`, `break`, and `critical`/`option` blocks |
| ERD | `erDiagram`: entities with typed attributes and `PK`, `FK`, and `UK` keys, all cardinalities, and labels |

In code, `toMermaid` is in `src/core/mermaid.ts` and `fromMermaid` in `src/core/fromMermaid.ts`.

Converting is lossy in both directions. DevArt icons, colours, descriptions, and positions have no Mermaid form. Mermaid notes, `click` links, `linkStyle`, `rect` highlights, and other diagram types such as `classDiagram` and `gantt` are skipped. A Mermaid node keeps its label as its DevArt name, unless two nodes share a label.

## Templates

DevArt includes six diagrams to start from:

| Id | Template | Type |
| --- | --- | --- |
| `microservices` | Microservices with API gateway | Architecture |
| `cicd-pipeline` | CI/CD pipeline | Architecture |
| `three-tier` | Three-tier web app | Architecture |
| `event-driven` | Event-driven with queue | Architecture |
| `oauth-flow` | OAuth 2.0 login flow | Sequence |
| `blog-erd` | Blog database | ERD |

Pick one under **Start from a template** on the home page. They are defined in `src/core/templates.ts`.

## Security

- Sign-in is Google only, through Supabase Auth.
- All data access uses the signed-in user's token. RLS policies on `files` and `profiles` limit every read and write to the owner (`owner_id = auth.uid()`), so the public anon key can't reach anyone else's diagrams.
- The service role key is only used by the local import script.

## Removed features

DevArt was simplified to focus on architecture diagrams. These are gone from the app: Draw with AI, documents, freehand drawing and shape tools, sticky notes, images, device frames, code blocks, comments, version history, presentation mode, share links, embeds, the old templates gallery, style presets, custom icons, folders, the trash view, workspaces, API tokens, settings, audit logs, and importing from draw.io and Visio.

Also gone with the move to Supabase: the local server, the REST API, live multi-window sync, and offline editing. See [Roadmap](#roadmap).

**Your existing work is safe.** Older files stay in the list and open in the editor:

- Flow charts and BPMN diagrams can still be edited visually, and ERDs and sequence diagrams through their code. New diagrams are always architecture diagrams.
- Older shapes, arrows, and text can be moved, resized, retyped, and deleted.
- Import your old local database into Supabase with `npm run import:local`; see [Move your local data](#move-your-local-data).
- Deleting a diagram from the home page only marks it deleted (`deleted_at` in the `files` table), so a row can be restored from the Supabase dashboard.

## Roadmap

- Teams and sharing: add a `team_id` to `files` and policies through team membership.
- Live multi-user editing: a Supabase Realtime channel carrying Yjs updates (the editor already uses a Yjs document in memory).
- Offline editing with a local copy that syncs on reconnect.

## Known limitations

- Each save writes the whole canvas. If the same diagram is open in two windows, the last save wins.
- Once components have been moved by hand, the arrows touching them are drawn as straight lines rather than routed around other components.
- PDF exports contain a high-resolution image rather than vector graphics.

## UI components (shadcn/ui)

[shadcn/ui](https://ui.shadcn.com) is set up with Tailwind CSS v4. Add components with `npx shadcn@latest add <name>`, import them from `@/components/ui/...`, and use `cn()` from `@/lib/utils` to merge classes. Installed so far: button, input, label, dialog, alert-dialog, dropdown-menu, avatar, separator, tooltip, card.

It sits beside the app's own CSS rather than replacing it: `src/styles.css` is loaded into a lower cascade layer, so Tailwind classes win over it, and shadcn's colour tokens in `src/index.css` map onto the app's variables (`--bg`, `--fg`, `--accent`, ...), so components follow the light and dark themes automatically. Tailwind's preflight reset is deliberately not loaded.

## Tests

```bash
npm test          # renderer, visual edits, Mermaid, and templates
npm run typecheck
```

## Project layout

```
index.html        app entry
src/
  main.tsx, App.tsx   bootstrap, auth gate, routes
  pages/              Login, Home, Editor
  components/         canvas, panels, menus
  components/ui/      shadcn/ui components (added with `npx shadcn@latest add <name>`)
  lib/                Supabase client, auth, file storage, export, UI helpers, utils.ts (cn)
  core/               diagram parser, SVG renderer, visual edits, icons, Mermaid, templates (pure TypeScript)
public/           icons and web app manifest
components.json   shadcn/ui configuration
supabase/         database migrations and local config
tools/            service worker build, icon generator, local data import
tests/            unit tests for src/core
vercel.json       Vercel build and routing
```
