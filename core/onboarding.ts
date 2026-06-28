/**
 * Onboarding: knowledge base'i interaktif bir sohbetle doldurur.
 * Khan'ı INTERAKTİF modda (-p YOK) başlatır; Claude röportajı yürütür ve
 * `knowledge/` dosyalarını yazar. Bitince kullanıcı /exit ile çıkar.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PROJECT_ROOT, resolveModel, spawnClaude } from "./agent.js";

const ONBOARDING_PROMPT_PATH = path.join(PROJECT_ROOT, "prompts", "khan-onboarding.md");

export async function runOnboarding(args: string[]): Promise<void> {
  let section: string | undefined;
  let opus = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--section") section = args[i + 1];
    else if (args[i] === "--opus") opus = true;
  }

  const onboardingPrompt = readFileSync(ONBOARDING_PROMPT_PATH, "utf8");
  const kickoff = section
    ? `Onboarding — SADECE "${section}" bölümünü doldur. Hemen ilk soruyla başla.`
    : "Onboarding'e baştan başla. İlk bölümün (kimlik) ilk sorusuyla başla.";

  console.log(
    "\n🚀 Khan onboarding başlıyor.\n" +
      "   Sorulara cevap ver; bitince /exit yazıp çık.\n",
  );

  await spawnClaude([
    kickoff,
    "--model",
    resolveModel({ opus }),
    "--append-system-prompt",
    onboardingPrompt,
    "--permission-mode",
    "acceptEdits",
  ]);

  // Onboarding sonrası index'i otomatik üret.
  try {
    const { buildIndex } = await import("../scripts/build-index.js");
    await buildIndex();
  } catch {
    console.log("(index üreticisi atlandı)");
  }
}
