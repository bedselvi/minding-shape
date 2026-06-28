#!/usr/bin/env node
/**
 * Khan CLI — terminal giriş noktası. Sadece bir arayüz; gerçek iş `core/agent.ts`
 * (beyin) içinde. Kullanım:
 *   agent "bugün ne var"
 *   agent --opus "şu kararı derinlemesine analiz et"
 *   agent onboard [--section work]
 *   agent build-index
 *   agent consolidate
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// .env varsa yükle (Node >= 20.12 process.loadEnvFile). Yoksa sessizce geç.
try {
  (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.(
    path.join(here, ".env"),
  );
} catch {
  /* .env yok — sorun değil */
}

import { runQuery } from "./core/agent.js";

function printHelp(): void {
  console.log(`Khan — kişisel CLI asistan

Kullanım:
  agent "<soru>"                Khan'a soru sor / not aldır
  agent --opus "<soru>"         Opus modeliyle çalıştır (varsayılan: hızlı model)
  agent onboard [--section X]   Knowledge base'i interaktif doldur
  agent build-index             knowledge/index.md'yi yeniden üret
  agent consolidate             log/ notlarını core dosyalara terfi ettir
  agent help                    Bu yardım

Örnek:
  agent "bugün ne var"
  agent "yarın 14:00 diş hekimi randevum var, not al"
  agent "X projesinin son durumu ne"`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    printHelp();
    return;
  }

  let opus = false;
  const rest: string[] = [];
  for (const a of argv) {
    if (a === "--opus") opus = true;
    else rest.push(a);
  }

  const sub = rest[0];

  switch (sub) {
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;

    case "onboard": {
      const { runOnboarding } = await import("./core/onboarding.js");
      await runOnboarding(rest.slice(1));
      return;
    }

    case "build-index": {
      const { buildIndex } = await import("./scripts/build-index.js");
      await buildIndex();
      return;
    }

    case "consolidate": {
      const { runQuery: rq } = await import("./core/agent.js");
      await rq(
        "consolidate: knowledge/log/ içindeki ham notları ilgili core/life/work " +
          "dosyalarına terfi ettir, taşınanları log'dan temizle, sonra index'i " +
          "güncelleme gereğini bildir. Ne yaptığını kısaca raporla.",
        { opus },
      );
      return;
    }

    default: {
      // Alt komut değilse, kalanları birleştirip sorgu say.
      const query = rest.join(" ").trim();
      if (!query) {
        printHelp();
        return;
      }
      const code = await runQuery(query, { opus });
      process.exitCode = code;
      return;
    }
  }
}

main().catch((err: unknown) => {
  console.error("Hata:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
