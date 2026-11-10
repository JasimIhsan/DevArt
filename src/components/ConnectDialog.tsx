// "Connect to Claude": create and revoke the personal tokens that let Claude Code (or any MCP client) draw in this account.
import { useEffect, useState } from "react";
import { createToken, listTokens, mcpUrl, revokeToken } from "../lib/tokens.ts";
import { timeAgo, toast, toastError, useLoad } from "../lib/ui.ts";
import { confirmDialog } from "./ConfirmDialog.tsx";

function Copy({ text, label }: { text: string; label: string }) {
   return (
      <button
         onClick={() =>
            navigator.clipboard.writeText(text).then(
               () => toast("Copied"),
               () => toast("Copy failed. Select the text and copy it.", true)
            )
         }
      >
         {label}
      </button>
   );
}

export function ConnectDialog({ onClose }: { onClose: () => void }) {
   const { data: tokens, error, reload } = useLoad("tokens", listTokens);
   const [name, setName] = useState("Claude Code");
   const [busy, setBusy] = useState(false);
   const [fresh, setFresh] = useState<string>();

   useEffect(() => {
      const esc = (e: KeyboardEvent) => {
         if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", esc);
      return () => window.removeEventListener("keydown", esc);
   }, [onClose]);

   const create = async () => {
      setBusy(true);
      try {
         setFresh(await createToken(name.trim()));
         reload();
      } catch (e) {
         toastError(e);
      } finally {
         setBusy(false);
      }
   };
   const revoke = async (id: string, label: string) => {
      if (!(await confirmDialog({ title: `Revoke "${label}"?`, message: "Anything using this token will stop working straight away.", confirmLabel: "Revoke", danger: true }))) return;
      revokeToken(id)
         .then(() => {
            toast("Token revoked");
            reload();
         })
         .catch(toastError);
   };

   const cmd = `claude mcp add --transport http devart ${mcpUrl} --header "Authorization: Bearer ${fresh ?? "YOUR_TOKEN"}"`;
   const cfg = JSON.stringify({ mcpServers: { devart: { type: "http", url: mcpUrl, headers: { Authorization: `Bearer ${fresh ?? "YOUR_TOKEN"}` } } } }, null, 2);

   return (
      <div
         className="sheet-backdrop"
         onPointerDown={(e) => {
            if (e.target === e.currentTarget) onClose();
         }}
      >
         <aside className="sheet" role="dialog" aria-modal="true" aria-labelledby="connect-title">
            <header className="sheet-head">
               <h2 id="connect-title">Connect to Claude</h2>
               <button className="ghost" aria-label="Close" onClick={onClose}>
                  ✕
               </button>
            </header>
            <div className="connect-body sheet-body">
               <p className="muted">
                  Create a token, then give it to Claude Code. Claude can then list, read, draw and edit <b>your</b> diagrams. Tokens act as you, so keep them private.
               </p>

               <div className="connect-row">
                  <input value={name} maxLength={80} aria-label="Token name" placeholder="Token name" onChange={(e) => setName(e.target.value)} />
                  <button className="primary" disabled={busy || !name.trim()} onClick={create}>
                     Create token
                  </button>
               </div>

               {fresh && (
                  <div className="connect-fresh" role="status">
                     <b>Copy your token now. It won't be shown again.</b>
                     <code className="connect-token">{fresh}</code>
                     <Copy text={fresh} label="Copy token" />
                  </div>
               )}

               <h3>Add it to Claude Code</h3>
               <p className="muted small">Run this in your terminal{fresh ? "" : " (after creating a token)"}:</p>
               <pre className="connect-pre">{cmd}</pre>
               <div className="connect-actions">
                  <Copy text={cmd} label="Copy command" />
                  <Copy text={cfg} label="Copy .mcp.json" />
               </div>
               <p className="muted small">
                  Full guide:{" "}
                  <a href="https://github.com/JasimIhsan/DevArt/blob/main/docs/mcp.md" target="_blank" rel="noreferrer">
                     docs/mcp.md
                  </a>
               </p>

               <h3>Your tokens</h3>
               {error && (
                  <p className="warn small" role="alert">
                     Couldn't load tokens: {error}
                  </p>
               )}
               {tokens && !tokens.length && <p className="muted small">No tokens yet.</p>}
               {tokens?.map((t) => (
                  <div key={t.id} className="connect-token-row">
                     <div>
                        <b>{t.name}</b>
                        <div className="muted small">
                           <code>{t.prefix}…</code> · created {timeAgo(t.createdAt)} · {t.lastUsedAt ? `used ${timeAgo(t.lastUsedAt)}` : "never used"}
                        </div>
                     </div>
                     <button className="danger" onClick={() => revoke(t.id, t.name)}>
                        Revoke
                     </button>
                  </div>
               ))}
            </div>
         </aside>
      </div>
   );
}
