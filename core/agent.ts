/**
 * Khan'ın "beyni": bir sorguyu, Claude Code'u (`cli.js`) abonelik auth'uyla
 * çağırarak çalıştırır. Ham Anthropic API KULLANMAZ — kullanıcının Claude
 * Pro/Max aboneliğini kullanır.
 *
 * CLI bu modülü çağırır; ileride WhatsApp/Siri handler'ları da aynı `runQuery`'yi
 * çağıracak (mimari ayrık).
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
/** knowledge/ ve prompts/ klasörlerini içeren proje kökü. */
export const PROJECT_ROOT = path.resolve(here, "..");
const SYSTEM_PROMPT_PATH = path.join(PROJECT_ROOT, "prompts", "khan-system.md");

/**
 * Claude Code'un gerçek node giriş scriptini (cli.js) bulur.
 * Böylece Windows'ta `.cmd` shim'i ve shell kaçış sorunlarını atlayıp
 * doğrudan `node cli.js ...` çalıştırabiliriz (büyük arg'lar güvenli).
 */
function findClaudeCliJs(): string | null {
  const locator = process.platform === "win32" ? "where" : "which";
  try {
    const out = execFileSync(locator, ["claude"], { encoding: "utf8" });
    const launcher = out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find(Boolean);
    if (!launcher) return null;
    const cliJs = path.join(
      path.dirname(launcher),
      "node_modules",
      "@anthropic-ai",
      "claude-code",
      "cli.js",
    );
    return existsSync(cliJs) ? cliJs : null;
  } catch {
    return null;
  }
}

/** Model alias/adını çöz. opus=true → "opus"; yoksa KHAN_MODEL ya da "sonnet". */
export function resolveModel(opts: { opus?: boolean; model?: string } = {}): string {
  return opts.opus ? "opus" : opts.model ?? process.env.KHAN_MODEL ?? "sonnet";
}

/**
 * Claude Code'u verilen arg'larla, abonelik auth'uyla çalıştırır.
 * `node cli.js ...` olarak çağrılır (Windows .cmd ve kaçış sorunlarını atlar).
 * stdio "inherit" → Khan'ın çıktısı/etkileşimi doğrudan terminale bağlanır.
 * Hem -p (tek seferlik) hem interaktif oturumlar için kullanılır.
 * @returns claude process'inin çıkış kodu.
 */
export function spawnClaude(claudeArgs: string[]): Promise<number> {
  const cliJs = findClaudeCliJs();
  if (!cliJs) {
    return Promise.reject(
      new Error(
        "claude CLI bulunamadı. Claude Code kurulu mu? `npm i -g @anthropic-ai/claude-code` " +
          "veya PATH'i kontrol et. Khan, Claude Code'u abonelik auth'uyla çağırır.",
      ),
    );
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliJs, ...claudeArgs], {
      stdio: "inherit",
      cwd: PROJECT_ROOT,
      shell: false,
    });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

export interface QueryOptions {
  /** Açıkça Opus iste (varsayılan: hızlı model). */
  opus?: boolean;
  /** Model'i elle geç (örn. "claude-sonnet-4-6" veya alias "sonnet"). */
  model?: string;
}

/**
 * Bir kullanıcı sorgusunu çalıştırır (-p tek seferlik). Yanıt terminale akar.
 * @returns claude process'inin çıkış kodu.
 */
export function runQuery(query: string, opts: QueryOptions = {}): Promise<number> {
  const systemPrompt = readFileSync(SYSTEM_PROMPT_PATH, "utf8");
  return spawnClaude([
    "-p",
    query,
    "--model",
    resolveModel(opts),
    "--append-system-prompt",
    systemPrompt,
    // Khan'ın knowledge/ dosyalarını sorgu sırasında güncelleyebilmesi için
    // dosya düzenlemelerine non-interactive izin ver.
    "--permission-mode",
    "acceptEdits",
  ]);
}
