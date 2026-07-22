"use client";

import { useState } from "react";
import { Terminal, Copy, Check, FolderOpen, ChevronDown } from "lucide-react";

/**
 * "Edit this client's system locally" — hands you a ready-to-run Claude Code
 * command scoped to THIS build, so you can make bespoke edits on your laptop
 * (your Claude Code subscription) instead of burning Anthropic API credits
 * through the in-app generator.
 *
 * There is no official `claude://` URL scheme, so the honest options are:
 *   1. Copy the command (works everywhere, zero setup) — the default.
 *   2. Open the project folder in VS Code via the `vscode://` protocol, which
 *      IS registered by VS Code, then run Claude Code there.
 *   3. Optional one-time Windows protocol registration for true one-click.
 */
export default function OpenInClaudeCode({
  buildId, business, slug, projectPath,
}: { buildId: string; business: string; slug?: string | null; projectPath: string }) {
  const [copied, setCopied] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  // Keep the prompt shell-safe — strip quotes/newlines out of the business name.
  const safeBusiness = (business || "this client").replace(/["\n\r]/g, "").slice(0, 80);
  const siteRef = slug ? `their site slug is "${slug}"` : "they don't have a generated site yet";
  const prompt = `Work on the Servolia client "${safeBusiness}" — ${siteRef}, build id ${buildId}. Load their config and intake, then make the edits I describe.`;
  const command = `cd "${projectPath}" && claude "${prompt}"`;

  const vscodeUrl = `vscode://file/${projectPath.replace(/\\/g, "/")}`;

  function copy() {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6">
      <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest flex items-center gap-2 mb-1">
        <Terminal className="w-4 h-4 text-[#36671E]" /> Edit locally with Claude Code
      </h2>
      <p className="text-xs text-[#71717A] mb-4">
        Make bespoke edits to this client&apos;s system on your laptop — no Anthropic API credits used.
      </p>

      <pre className="text-[11px] font-mono text-[#52525B] bg-[#FAFAF7] border border-[#E8E6E0] p-3 rounded-lg overflow-x-auto mb-3 whitespace-pre-wrap break-all">
        {command}
      </pre>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={copy}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#36671E] text-[#FAFAF7] text-sm font-bold hover:bg-[#295115] transition-colors">
          {copied ? <><Check className="w-4 h-4" /> Copied — paste in your terminal</> : <><Copy className="w-4 h-4" /> Copy Claude Code command</>}
        </button>
        <a href={vscodeUrl}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#E8E6E0] text-[#18181B] text-sm font-bold hover:border-[#36671E] hover:text-[#36671E] transition-colors">
          <FolderOpen className="w-4 h-4" /> Open project in VS Code
        </a>
      </div>

      <button onClick={() => setShowSetup((v) => !v)}
        className="mt-4 flex items-center gap-1.5 text-xs font-bold text-[#71717A] hover:text-[#18181B] transition-colors">
        Want true one-click? <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSetup ? "rotate-180" : ""}`} />
      </button>

      {showSetup && (
        <div className="mt-3 p-4 rounded-xl bg-[#FAFAF7] border border-[#E8E6E0] text-xs text-[#52525B] space-y-2">
          <p>
            There&apos;s no official <code className="font-mono">claude://</code> URL scheme, so a browser button can&apos;t
            launch the CLI on its own. One-time setup that makes it work:
          </p>
          <p>
            1. Save this as <code className="font-mono">servolia-code.cmd</code> in your project folder:
          </p>
          <pre className="font-mono bg-white border border-[#E8E6E0] p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
{`@echo off
cd /d "${projectPath}"
start "" cmd /k claude "%~1"`}
          </pre>
          <p>2. Register the protocol (run once, as admin, in PowerShell):</p>
          <pre className="font-mono bg-white border border-[#E8E6E0] p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
{`New-Item -Path "HKCU:\\Software\\Classes\\servolia-code" -Force
Set-ItemProperty -Path "HKCU:\\Software\\Classes\\servolia-code" -Name "(Default)" -Value "URL:servolia-code"
Set-ItemProperty -Path "HKCU:\\Software\\Classes\\servolia-code" -Name "URL Protocol" -Value ""
New-Item -Path "HKCU:\\Software\\Classes\\servolia-code\\shell\\open\\command" -Force
Set-ItemProperty -Path "HKCU:\\Software\\Classes\\servolia-code\\shell\\open\\command" -Name "(Default)" -Value '"${projectPath}\\servolia-code.cmd" "%1"'`}
          </pre>
          <p className="text-[#71717A]">
            Until then, the Copy button above is the fastest path — one paste and Claude Code opens with this
            client&apos;s context already loaded.
          </p>
        </div>
      )}
    </div>
  );
}
