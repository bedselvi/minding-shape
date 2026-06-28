/**
 * knowledge/index.md üreticisi.
 * Tüm gerçek knowledge dosyalarının (.example.md hariç) frontmatter'ından
 * (summary, volatility, updated) bir özet tablo derler. Agent her sorguda
 * önce bunu okur (ucuz), sonra ilgili dosyaları seçer.
 *
 * Çalıştırma:  npm run build-index   (veya onboarding/query sonrası otomatik)
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(here, "..");
const KNOWLEDGE_DIR = path.join(PROJECT_ROOT, "knowledge");

interface Entry {
  rel: string;
  volatility: string;
  updated: string;
  summary: string;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (name.endsWith(".md") && !name.endsWith(".example.md") && name !== "index.md") {
      out.push(full);
    }
  }
  return out;
}

/** Basit frontmatter parser (tam YAML değil; key: value satırları yeterli). */
function parseFrontmatter(content: string): Record<string, string> {
  const fm: Record<string, string> = {};
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return fm;
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (mm) {
      let val = mm[2].trim();
      // satır içi yorumu at (ama tırnak içindekini koru)
      if (!/^["']/.test(val)) val = val.replace(/\s+#.*$/, "").trim();
      val = val.replace(/^["']|["']$/g, "");
      fm[mm[1]] = val;
    }
  }
  return fm;
}

export async function buildIndex(): Promise<void> {
  if (!existsSync(KNOWLEDGE_DIR)) {
    console.error("knowledge/ klasörü yok — index üretilemedi.");
    return;
  }

  const entries: Entry[] = walk(KNOWLEDGE_DIR)
    .map((f) => {
      const fm = parseFrontmatter(readFileSync(f, "utf8"));
      return {
        rel: path.relative(KNOWLEDGE_DIR, f).split(path.sep).join("/"),
        volatility: fm.volatility || "?",
        updated: fm.updated || "",
        summary: fm.summary || "",
      };
    })
    .sort((a, b) => a.rel.localeCompare(b.rel));

  const lines = [
    "# Knowledge Base Index",
    "",
    "> Otomatik üretildi (`npm run build-index`). Elle düzenleme.",
    `> Son üretim: ${new Date().toISOString().slice(0, 10)} — ${entries.length} dosya.`,
    "",
    "| Dosya | Volatility | Güncelleme | Özet |",
    "|-------|-----------|-----------|------|",
    ...entries.map((e) => `| ${e.rel} | ${e.volatility} | ${e.updated} | ${e.summary} |`),
    "",
  ];

  writeFileSync(path.join(KNOWLEDGE_DIR, "index.md"), lines.join("\n"), "utf8");
  console.log(`✓ knowledge/index.md güncellendi (${entries.length} dosya).`);
}

// Doğrudan `tsx scripts/build-index.ts` ile çalıştırılırsa üret.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void buildIndex();
}
