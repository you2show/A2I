// A2I i18n — Khmer (km) / English (en). Pure per-language strings, no mixing.
'use client';

import { useEffect, useState } from 'react';

export type Lang = 'km' | 'en';

const DICT: Record<string, { km: string; en: string }> = {
  // ---- Sidebar ----
  brandTag: { km: 'កម្មវិធី AI គ្រប់រូបភាព', en: 'All-in-One AI' },
  newChat: { km: 'ជជែកថ្មី', en: 'New chat' },
  searchChats: { km: 'ស្វែងរក', en: 'Search' },
  installApp: { km: 'ដំឡើងជាកម្មវិធី', en: 'Install App' },
  project: { km: 'គម្រោង', en: 'Project' },
  settings: { km: 'ការកំណត់', en: 'Settings' },
  theme: { km: 'រូបរាង', en: 'Theme' },
  fix: { km: 'ជួសជុល', en: 'Fix' },
  langBtn: { km: 'EN', en: 'ខ្មែរ' },

  // ---- Command palette ----
  palettePh: { km: 'ស្វែងរក ឬ វាយពាក្យបញ្ជា…', en: 'Search or type a command…' },

  // ---- Project modal ----
  projectTitle: { km: 'គម្រោង', en: 'Project' },
  projectHint:
    {
      km: 'ផ្ទុកកូដ រួចសួរសំណួរអំពីវា ឬ ស្នើឲ្យកែប្រែ។ ប្រើកម្មវិធី A2I Core ក្នុងម៉ាស៊ីនអ្នក — ជ្រើសរើសវាក្នុងការកំណត់ជាមុនសិន។ ឯកសារនៅលើម៉ាស៊ីនអ្នក ការកែប្រែត្រូវបានបង្ហាញឲ្យទាញយក មិនដែលសរសេរជំនួសទេ។',
      en: 'Load source files, then ask questions about them or ask for changes. This uses your local A2I Core — pick it in Settings first. Files stay on your machine; edits are shown here for you to download, never written for you.',
    },
  dropText: { km: 'ទម្លាក់ឯកសារទីនេះ ឬ', en: 'Drop files here, or' },
  chooseFiles: { km: 'ជ្រើសរើសឯកសារ', en: 'Choose files' },
  projectTaskLbl: { km: 'សំណួរ ឬ កិច្ចការ', en: 'Question or task' },
  askBtn: { km: 'សួរ', en: 'Ask' },
  editBtn: { km: 'ស្នើការកែប្រែ', en: 'Request edits' },

  // ---- Settings ----
  settingsTitle: { km: 'ការកំណត់', en: 'Settings' },
  tabModels: { km: 'ម៉ូដែល', en: 'Models' },
  tabProviders: { km: 'អ្នកផ្ដល់សេវា', en: 'Providers' },
  tabAppearance: { km: 'រូបរាង', en: 'Appearance' },
  cloudStatusTitle: { km: 'បានកំណត់រួចនៅម៉ាស៊ីនមេ', en: 'Configured on the server' },
  cloudStatusBody:
    {
      km: 'ម៉ូដែល៖ {model} · ចំណុចតភ្ជាប់៖ {base} · កូនសោលាក់នៅលើម៉ាស៊ីនមេ — គ្មានតម្រូវការកំណត់អ្វីទេ អាចជជែកបានភ្លាមៗ។',
      en: 'Model: {model} · Endpoint: {base} · key is kept on the server — nothing to set up, just chat.',
    },
  chatCloudBtn: { km: 'ជជែកជាមួយ A2I Cloud', en: 'Chat with A2I Cloud' },
  quickStart:
    {
      km: 'ចាប់ផ្ដើមងាយៗ៖ A2I Cloud បានដំឡើងនៅលើម៉ាស៊ីនមេរួចហើយ — ជ្រើសរើស A2I Cloud ក្នុងបញ្ជីខាងលើ រួចចាប់ផ្ដើមជជែកភ្លាមៗ ដោយគ្មានការកំណត់អ្វីឡើយ។ ផ្នែកខាងក្រោមសម្រាប់អ្នកចង់បន្ថែម AI បន្ថែមទៀតតែប៉ុណ្ណោះ។',
      en: 'Quick start: A2I Cloud is already set up on the server — pick A2I Cloud in the list above and start chatting right away, no setup needed. The sections below are only for adding more AI options.',
    },
  zenBlockTitle: { km: 'OpenCode Zen (ឥតគិតថ្លៃ — គ្មានប័ណ្ណឥណទាន)', en: 'OpenCode Zen (free — no card)' },
  recommended: { km: 'ណែនាំ', en: 'Recommended' },
  zenHint:
    {
      km: 'Zen បានកំណត់រួចនៅលើម៉ាស៊ីនមេ — អ្នកមិនបាច់បំពេញកូនសោទេ។ បើចង់ប្រើកូនសោផ្ទាល់ខ្លួន (ឥតគិតថ្លៃ ១០០ សំណើក្នុងមួយថ្ងៃ) ទើបបំពេញខាងក្រោមដើម្បីជំនួស — បើមិនចង់ទេ រំលងចោលបាន។ មើលបញ្ជីម៉ូដែលក្នុង MODELS.md។ រកកូនសោឥតគិតថ្លៃតាមរយៈ opencode auth login --provider zen ឬ នៅ opencode.ai។',
      en: 'Zen is already configured on the server — no key needed here. To use your own key instead (free tier: 100 requests/day), fill in the fields below to override — otherwise skip this. See MODELS.md for the model list. Get a free key with `opencode auth login --provider zen` or on opencode.ai.',
    },
  zenKeyLbl: { km: 'កូនសោ Zen', en: 'Zen API key' },
  zenKeyPh: { km: 'កូនសោរបស់អ្នក…', en: 'sk-…' },
  zenModelLbl: { km: 'ម៉ូដែល (ឥតគិតថ្លៃ៖ big-pickle, deepseek-v4-flash-free, …)', en: 'Model (free: big-pickle, deepseek-v4-flash-free, …)' },
  testKey: { km: 'សាកល្បងកូនសោ', en: 'Test key' },
  saveActivate: { km: 'រក្សាទុក និងប្រើប្រាស់', en: 'Save & Activate' },
  clear: { km: 'សម្អាត', en: 'Clear' },
  geminiBlockTitle: { km: 'Gemini (Google)', en: 'Gemini (Google)' },
  geminiHint:
    {
      km: 'បំពេញកូនសោផ្ទាល់ខ្លួនរបស់អ្នក — ឥតគិតថ្លៃពី aistudio.google.com/apikey។ កូនសោរក្សាទុកតែក្នុងកម្មវិធីរុករកនេះ ផ្ញើទៅ Google ផ្ទាល់។',
      en: 'Paste your own key — free from aistudio.google.com/apikey. Stored only in this browser, sent directly to Google.',
    },
  apiKeyLbl: { km: 'កូនសោ API', en: 'API key' },
  geminiModelLbl: { km: 'ម៉ូដែល', en: 'Model' },
  saveGemini: { km: 'រក្សាទុក Gemini', en: 'Save Gemini' },
  localBlockTitle: { km: 'ឯកសារម៉ូដែលក្នុងម៉ាស៊ីន (SSD / ថាស — គ្មានទាញយក)', en: 'Local model file — SSD / disk (no download)' },
  localHint:
    {
      km: 'ទុកម៉ូដែល GGUF លើ SSD ហើយផ្ទុកផ្ទាល់ពីថាស — គ្មានការទាញយក ដំណើរការក្រៅបណ្ដាញ។ ម៉ូដែលធំក៏សមដែរ។ ទាញយក GGUF ពី Hugging Face (Qwen, Llama, …)។',
      en: 'Keep a GGUF model on your SSD and load it straight from disk — no download, works offline, and new preview URLs never re-download. Big models fit too. Get GGUF files from Hugging Face (Qwen, Llama, …).',
    },
  chooseModel: { km: 'ជ្រើសរើសម៉ូដែល (.gguf)', en: 'Choose model (.gguf)' },
  modelGuide: { km: 'តើម៉ូដែលណាសមនឹងឧបករណ៍ខ្ញុំ?', en: 'Which model fits my device?' },
  guideDevice: { km: 'ឧបករណ៍', en: 'Device' },
  guideModel: { km: 'ម៉ូដែល', en: 'Model' },
  guideSize: { km: 'ទំហំ', en: 'Size' },
  guideRule:
    {
      km: 'គោលការណ៍៖ ម៉ូដែលធំជាងគេដែលសមនឹងអង្គចងចាំរបស់អ្នក គឺល្អបំផុតដែលអាចដំណើរការក្នុងម៉ាស៊ីន។ បញ្ជីពេញលេញ និងការទាញយក៖ MODELS.md',
      en: 'Rule: biggest model that fits your RAM = best you can run locally. Full list & downloads: MODELS.md',
    },
  gPhone: { km: 'ទូរស័ព្ទ · 2–4 GB', en: 'Phone · 2–4 GB' },
  gPhoneM: { km: 'Qwen2.5 0.5B–1.5B (ក្នុងកម្មវិធីរុករក)', en: 'Qwen2.5 0.5B–1.5B (in browser)' },
  gLaptop: { km: 'កុំព្យូទ័រយួរដៃ · 8 GB', en: 'Laptop · 8 GB' },
  gLaptopM: { km: 'Qwen2.5 7B · Llama 3.1 8B · DavidAU Fable 9B', en: 'Qwen2.5 7B · Llama 3.1 8B · DavidAU Fable 9B' },
  gPc: { km: 'កុំព្យូទ័រតុ · 16–32 GB', en: 'PC · 16–32 GB' },
  gPcM: { km: 'ម៉ូដែល 14B–32B', en: '14B–32B models' },
  gGpu: { km: 'កាតគ្រាប់វីដេអូ (GPU)', en: 'GPU' },
  gGpuM: { km: 'ម៉ូដែលដដែល លឿនជាងច្រើន (WebGPU / vLLM)', en: 'same models, much faster (WebGPU / vLLM)' },
  gCloud: { km: 'គ្មានឧបករណ៍ខ្លាំង', en: 'No good hardware' },
  gCloudM: { km: 'Groq · Hugging Face (70B, API ឥតគិតថ្លៃ)', en: 'Groq · Hugging Face (70B, free API)' },
  presetGroq: { km: 'Groq', en: 'Groq' },
  presetCerebras: { km: 'Cerebras', en: 'Cerebras' },
  presetOpenrouter: { km: 'OpenRouter', en: 'OpenRouter' },
  presetHf: { km: 'Hugging Face', en: 'Hugging Face' },
  presetAirforce: { km: 'Api.Airforce', en: 'Api.Airforce' },
  presetZen: { km: 'OpenCode Zen', en: 'OpenCode Zen' },
  presetOc: { km: 'Opencode Server', en: 'Opencode Server' },
  presetA2icore: { km: 'A2I Core', en: 'A2I Core' },
  presetVllm: { km: 'vLLM (GPU)', en: 'vLLM (GPU)' },
  presetOllama: { km: 'Ollama', en: 'Ollama' },
  presetGroupFree: { km: 'ឥតគិតថ្លៃ — API', en: 'Free — hosted API' },
  presetGroupLocal: { km: 'ដំណើរការក្នុងម៉ាស៊ីនអ្នក', en: 'Local / self-hosted' },
  zenRefreshBtn: { km: 'ម៉ូដែល Zen', en: 'Zen models' },
  ocRefreshBtn: { km: 'ម៉ូដែល OC', en: 'OC models' },
  loading: { km: 'កំពុងផ្ទុក…', en: 'Loading…' },
  offline: { km: 'គ្មានបណ្ដាញ', en: 'offline' },
  localOnly: { km: 'ក្នុងម៉ាស៊ីនតែប៉ុណ្ណោះ', en: 'local only' },
  copy: { km: 'ចម្លង', en: 'Copy' },
  copied: { km: 'បានចម្លង', en: 'Copied' },
  stModelLoads: { km: 'ម៉ូដែលផ្ទុកនៅពេលផ្ញើសារដំបូង', en: 'model loads on first message' },
  stCpuMode: { km: 'គ្មាន GPU — របៀប CPU ផ្ទុកនៅពេលផ្ញើសារដំបូង', en: 'no GPU — CPU mode will load on first message' },
  stAll: { km: 'នឹងសួរខួរក្បាល {n}+ ហើយបញ្ចូលគ្នា', en: 'will ask {n}+ brains and combine' },
  stBrain: { km: 'នឹងហៅ {name}', en: 'will call {name}' },
  stReady: { km: 'រួចរាល់', en: 'ready' },
  errCloudStatus: { km: 'កំហុស A2I Cloud {s}', en: 'A2I Cloud error {s}' },
  toastGemSaved: { km: 'Gemini {model} បានរក្សាទុក និងដំណើរការ', en: 'Gemini {model} saved & activated' },
  toastGemCleared: { km: 'បានលុបសោ Gemini', en: 'Gemini key cleared' },
  toastZenWorks: { km: 'សោ Zen ដំណើរការ — ចុចរក្សាទុកដើម្បីប្រើ', en: 'Zen key works — save to activate' },
  toastZenTestFailed: { km: 'ការសាកល្បង Zen បរាជ័យ: {m}', en: 'Zen test failed: {m}' },
  toastZenSaved: { km: 'Zen {model} បានរក្សាទុក និងដំណើរការ', en: 'Zen {model} saved & activated' },
  toastZenCleared: { km: 'បានលុបសោ Zen', en: 'Zen key cleared' },
  keyWorks: { km: 'សោដំណើរការ', en: 'key works' },
  keyRejected: { km: 'សោត្រូវបានច្រានចោល', en: 'key rejected' },
  pasteKeyFirst: { km: 'បិទសោជាមុនសិន', en: 'paste a key first' },
  savedActive: { km: 'បានរក្សាទុក និងដំណើរការ', en: 'saved & active' },
  notSaved: { km: 'មិនបានរក្សាទុក', en: 'not saved' },
  cleared: { km: 'បានសម្អាត', en: 'cleared' },
  noteNothingExport: { km: 'ជជែកទទេ — គ្មានអ្វីនាំចេញទេ', en: 'Chat is empty — nothing to export yet.' },
  noteShareCopied: { km: 'មិនគាំទ្រការចែករំលែក — បានចម្លងទៅក្ដារតម្បៀតខ្ទាស់វិញ', en: 'Share not supported — copied to clipboard instead.' },
  autospeakOn: { km: 'អានចម្លើយស្វ័យប្រវត្តិ: បើក', en: 'Auto read answers: On' },
  autospeakOff: { km: 'អានចម្លើយស្វ័យប្រវត្តិ: បិទ', en: 'Auto read answers: Off' },
  palNewChat: { km: 'ជជែកថ្មី', en: 'New chat' },
  palCoderOn: { km: 'បើករបៀប Coder', en: 'Turn ON Coder mode' },
  palCoderOff: { km: 'បិទរបៀប Coder', en: 'Turn OFF Coder mode' },
  palSettings: { km: 'ការកំណត់ — API keys, servers', en: 'Settings — API keys, servers' },
  palGemini: { km: 'បន្ថែម / ប្ដូរសោ Gemini API', en: 'Add / change Gemini API key' },
  palLive: { km: 'បើក Live 3D voice', en: 'Open Live 3D voice' },
  palTheme: { km: 'ប្ដូររបៀបពន្លឺ / ងងឹត', en: 'Toggle light / dark theme' },
  palCopy: { km: 'ចម្លងជជែកនេះ (Markdown)', en: 'Copy this chat (Markdown)' },
  palEmpty: { km: 'គ្មានលទ្ធផល — សាកល្បង “zen”, “new chat”, “dark” ឬសួរផ្ទាល់ក្នុងប្រអប់ខាងក្រោម', en: 'No matches — try “zen”, “new chat”, “dark”, or just ask in the box below.' },
  stLoadingLib: { km: 'កំពុងផ្ទុកបណ្ណាល័យ AI…', en: 'loading AI library…' },
  stDownloadingModel: { km: 'កំពុងទាញយកម៉ូដែល (ម្ដងគត់)…', en: 'downloading model (one time)…' },
  stDownloadPct: { km: '⬇ កំពុងទាញ AI model {pct}% (ម្ដងគត់)', en: '⬇ downloading AI model {pct}% (one-time)' },
  stDownloadPctCpu: { km: '⬇ កំពុងទាញ AI model (CPU) {pct}% · {mb}MB (ម្ដងគត់)', en: '⬇ downloading AI model (CPU) {pct}% · {mb}MB (one-time)' },
  stModelFileSet: { km: 'កំណត់ឯកសារម៉ូដែល: {name} — ចាប់ផ្ដើមជជែកដើម្បីប្រើ (គ្មាន download)', en: 'Model file set: {name} — start a chat to use it (no download)' },
  stLocalCleared: { km: 'បានលុបម៉ូដែលក្នុងម៉ាស៊ីន — នឹងទាញយកវិញពេលប្រើក្រោយ', en: 'Local model cleared — will download on next use' },
  stUsingLocalFile: { km: 'ផ្ទុកម៉ូដែលពីឯកសារ… {name} (គ្មាន download)', en: 'Loading model from file… {name} (no download)' },
  stGpuFail: { km: 'GPU មិនដំណើរការ — ប្ដូរទៅ CPU ស្វ័យប្រវត្តិ', en: 'GPU failed — switching to CPU…' },
  stWarming: { km: 'កំពុងសាកល្បង AI…', en: 'warming up…' },
  stCpuSlower: { km: 'រួចរាល់: {model} — របៀប CPU, យឺតជាង', en: 'ready: {model} — CPU mode, slower' },
  stCompatEngine: { km: 'កំពុងប្ដូរទៅ engine ដែលត្រូវគ្នា…', en: 'switching to compatibility engine…' },
  stCpu: { km: 'កំពុងប្រើ CPU…', en: 'using CPU mode…' },
  stCpuCompat: { km: 'កំពុងប្រើ CPU (compat)…', en: 'compatibility mode…' },
  errNoBrowserEngine: { km: 'មិនអាចចាប់ផ្ដើម AI ក្នុងឧបករណ៍បានទេ — សូមបើក check.html ដើម្បីមើលមូលហេតុ', en: 'Could not start any in-browser engine — open check.html to diagnose.' },
  errNoBrowserEngine2: { km: 'ឬប្រើ engine មួយផ្សេង (A2I Core / Ollama)។', en: 'Or use another engine (A2I Core / Ollama).' },
  errNoBrowserEngine3: { km: 'ឬប្រើ A2I Cloud / Gemini ។', en: 'Or use A2I Cloud / Gemini.' },
  errNoGemKey: { km: 'គ្មាន Gemini API key — សូម paste key ក្នុង Settings', en: 'No Gemini API key set — paste a key in Settings.' },
  errGemReach: { km: 'មិនអាចភ្ជាប់ Gemini បានទេ', en: 'Could not reach Gemini.' },
  errGemQuota: { km: 'Gemini: quota free-tier អស់ (429) — សូម (1) រង់ចាំ ១ នាទី, (2) ប្ដូរ model ទៅ gemini-2.5-flash / gemini-2.0-flash, ឬ (3) ប្រើ Groq/OpenRouter (free) ក្នុង Settings', en: 'Gemini: free-tier quota hit (429) — (1) wait a minute, (2) switch to gemini-2.5-flash / gemini-2.0-flash, or (3) use Groq/OpenRouter (free) in Settings.' },
  errGemStatus: { km: 'កំហុស Gemini {s}: {t}', en: 'Gemini error {s}: {t}' },
  errServerReach: { km: 'មិនអាចភ្ជាប់ទៅ {name} ({url}) បានទេ', en: 'Could not reach {name} ({url}).' },
  errServerQuota: { km: '{name}: quota/rate-limit អស់ (429) — រង់ចាំបន្តិច ឬប្ដូរ provider ផ្សេង', en: '{name}: rate limit hit (429) — wait a moment or switch provider.' },
  errServerStatus: { km: 'កំហុស {name} {s}: {t}', en: '{name} error {s}: {t}' },
  errA2ICore: { km: 'A2I Core ត្រឡប់ {s}. {detail}', en: 'A2I Core returned {s}. {detail}' },
  noteSmallModel: { km: '⚠ ម៉ូដែលតូច ({model}) សរសេរខ្មែរមិនល្អទេ — ចម្លើយអាចមើលទៅត្រឹមត្រូវ តែពិតជាខុស។ សូមប្ដូរទៅម៉ូដែលធំជាង (Qwen2.5 7B ក្នុងបញ្ជីខាងលើ), A2I Core, ឬ Gemini', en: '⚠ Small model ({model}) cannot write Khmer reliably — answers can look fluent but be invented. Switch to a larger model (Qwen2.5 7B in the list above), A2I Core, or Gemini.' },
  noteBrainOffline: { km: '{name} មិន online ទេ — ប្ដូរទៅ In-browser AI ដោយស្វ័យប្រវត្តិ', en: '{name} is offline — switching to the in-browser AI' },
  enterKeyFirst: { km: 'បញ្ចូលសោជាមុនសិន', en: 'enter a key first' },
  testing: { km: 'កំពុងសាកល្បង', en: 'testing' },
  projNoFiles: { km: 'មិនទាន់មានឯកសារផ្ទុកទេ', en: 'No files loaded yet.' },
  projFilesLoaded: { km: 'ឯកសារ {n} បានផ្ទុក, {kb} KB', en: '{n} file(s), {kb} KB loaded' },
  projSkipped: { km: 'រំលង {n} ឯកសារ (ធំពេក ឬអានមិនរួច)', en: '{n} file(s) skipped (too large or unreadable)' },
  projLoadFirst: { km: 'ផ្ទុកឯកសារមុនសិន', en: 'Load some files first' },
  projTaskFirst: { km: 'វាយសំណួរ ឬកិច្ចការមុនសិន', en: 'Type a question or task first' },
  projThinking: { km: 'កំពុងគិត…', en: 'Thinking…' },
  projAsking: { km: 'កំពុងសួរ…', en: 'asking…' },
  projNoAnswer: { km: '(គ្មានចម្លើយ)', en: '(no answer)' },
  projDone: { km: 'រួចរាល់', en: 'done' },
  projFailed: { km: 'បរាជ័យ', en: 'failed' },
  projNoChanges: { km: 'គ្មានការផ្លាស់ប្ដូរ', en: 'no changes' },
  projStartCore: { km: 'ចាប់ផ្ដើម A2I Core (cd a2i-core && ./run.sh) រួចបន្ថែមក្នុង Settings', en: 'Start A2I Core (cd a2i-core && ./run.sh), then add it in Settings.' },
  projWorking: { km: 'កំពុងធ្វើការ… ម៉ូដែលកំពុងសរសេរការកែប្រែ', en: 'Working… the model is writing edits.' },
  projEditing: { km: 'កំពុងកែប្រែ…', en: 'editing…' },
  providersBlockTitle: { km: 'អ្នកផ្ដល់សេវា AI — ក្នុងម៉ាស៊ីន និងឥតគិតថ្លៃ', en: 'AI providers — local & free' },
  providersHint:
    {
      km: 'API ឥតគិតថ្លៃបន្ថែមទៀត — កូនសោនៅក្នុងកម្មវិធីរុករកអ្នក គ្រាន់តែចុចប៊ូតុងដែលមាន (ទម្រង់បំពេញដោយខ្លួនឯង) រួចបន្ថែមអ្នកផ្ដល់សេវា៖ Groq · Cerebras · OpenRouter · Hugging Face · Api.Airforce · Zen · Opencode Server · A2I Core · vLLM · Ollama។',
      en: 'More free APIs — keys stay in your browser, just press a preset button (form fills itself) then Add provider: Groq · Cerebras · OpenRouter · Hugging Face · Api.Airforce · Zen · Opencode Server · A2I Core · vLLM · Ollama.',
    },
  addProvider: { km: 'បន្ថែមអ្នកផ្ដល់សេវា', en: 'Add provider' },
  brainNamePh: { km: 'ឈ្មោះ', en: 'Name' },
  brainUrlPh: { km: 'អាសយដ្ឋានមូលដ្ឋាន (…/v1)', en: 'Base URL (…/v1)' },
  brainModelPh: { km: 'ម៉ូដែល (ស្រេចចិត្ត)', en: 'Model (optional)' },
  brainKeyPh: { km: 'កូនសោ API (ស្រេចចិត្ត)', en: 'API key (optional)' },
  appearanceBlockTitle: { km: 'រូបរាង និងសំឡេង', en: 'Appearance & voice' },
  toggleTheme: { km: 'ប្ដូរភ្លឺ/ងងឹត', en: 'Toggle light / dark' },
  // ---- Topbar ----
  serverUrlPh: { km: 'អាសយដ្ឋានម៉ាស៊ីនមេ (OpenAI-compatible URL)', en: 'http://127.0.0.1:8990 (OpenAI-compatible URL)' },
  coderBtn: { km: 'កូឌឺ', en: 'Coder' },
  webLbl: { km: 'បណ្ដាញ', en: 'Web' },
  srcAuto: { km: 'ប្រភពស្វ័យប្រវត្តិ', en: 'Auto sources' },
  srcWeb: { km: 'សព្វវចនាធិប្បាយ', en: 'Encyclopedia' },
  srcAcademic: { km: 'ស្រាវជ្រាវ (arXiv)', en: 'Academic (arXiv)' },
  srcDiscussions: { km: 'ការពិភាក្សា (HN)', en: 'Discussions (HN)' },
  srcOff: { km: 'គ្មានការស្វែងរក', en: 'No search' },
  liveLink: { km: 'ផ្ទាល់', en: 'Live' },
  copyChat: { km: 'ចម្លងការសន្ទនា', en: 'Copy chat' },
  downloadMd: { km: 'ទាញយកជា .md', en: 'Download .md' },
  share: { km: 'ចែករំលែក', en: 'Share' },
  statusReady: { km: 'ត្រៀមរួច', en: 'ready' },
  inputPh: { km: 'សួរអ្វីក៏បាន…', en: 'Ask anything…' },
  footnote:
    {
      km: 'A2I រត់ក្នុងឧបករណ៍របស់អ្នកផ្ទាល់ — គ្មាន API ខាងក្រៅ',
      en: 'A2I runs on your own device — no external AI APIs',
    },
  tAttach: { km: 'ភ្ជាប់រូបភាព', en: 'Attach image' },
  tMic: { km: 'និយាយបញ្ចូល', en: 'Dictate' },
  tImg: { km: 'បង្កើតរូបភាព (ឥតគិតថ្លៃ)', en: 'Generate image (free)' },
  tAud: { km: 'បង្កើតសំឡេង (ឥតគិតថ្លៃ)', en: 'Generate audio / voice (free)' },
  tCritique: {
    km: 'ត្រួតពិនិត្យខ្លួនឯង — ត្រឹមត្រូវជាង តែយឺតជាង',
    en: 'Self-review — more accurate, slower',
  },
  critiqueRunning: { km: 'កំពុងត្រួតពិនិត្យចម្លើយខ្លួនឯង…', en: 'Reviewing its own answer…' },
  tRegen: { km: 'បង្កើតចម្លើយម្ដងទៀត', en: 'Regenerate' },
  tStop: { km: 'បញ្ឈប់', en: 'Stop' },
  tSend: { km: 'ផ្ញើ', en: 'Send' },
  tSearchChats: { km: 'ស្វែងរកការសន្ទនា (Ctrl/⌘ K)', en: 'Search chats & commands (Ctrl/⌘ K)' },
  tProject: { km: 'សួរអំពី ឬកែប្រែកូដជាមួយ A2I Core', en: 'Ask about or edit a codebase with A2I Core' },
  tInstall: { km: 'ដំឡើង A2I ជាកម្មវិធី', en: 'Install A2I as an app' },
  tSettings: { km: 'ការកំណត់ — កូនសោ API, ម៉ាស៊ីនមេ, រូបរាង', en: 'Settings — API keys, servers, appearance' },
  tFix: { km: 'សម្អាត cache ម៉ូដែលហើយផ្ទុកឡើងវិញ — ប្រើពេលផ្ទុកជាប់', en: 'Clear the downloaded model cache and reload — use if loading is stuck' },
  tExport: { km: 'នាំចេញ / ចែករំលែកការសន្ទនានេះ', en: 'Export / share this chat' },

  // ---- Welcome ----
  welcomeHeading: { km: 'ជម្រាបសួរ! ខ្ញុំជា A2I', en: 'Hello! I am A2I' },
  welcomeSub:
    {
      km: 'AI ផ្ទាល់ខ្លួនរបស់អ្នក — រត់ក្នុងឧបករណ៍របស់អ្នក គ្មាន API ខាងក្រៅ',
      en: 'Your personal all-in-one AI — private, on your device',
    },
  coderHeading: { km: 'ជម្រាបសួរ! ខ្ញុំជា A2I Coder', en: 'Hello! I am A2I Coder' },
  coderSub:
    {
      km: 'ជំនួយការកូដជំនាញ — សរសេរ កែកំហុស ពន្យល់',
      en: 'Expert coding assistant — write, debug, explain',
    },
  chipCsv: { km: 'សរសេរ Python ដើម្បីអានឯកសារ CSV', en: 'Write a Python function to parse a CSV file' },
  chipError: { km: 'ពន្យល់កំហុសនេះ៖ TypeError: undefined is not a function', en: 'Explain this error: TypeError: undefined is not a function' },
  chipApi: { km: 'បង្កើត REST API ជាមួយ FastAPI', en: 'Build a REST API with FastAPI' },
  chipReview: { km: 'ពិនិត្យកូដនេះរកកំហុស និងបញ្ហាសន្តិសុខ', en: 'Review this code for bugs and security issues' },
  chipHowAi: { km: 'ពន្យល់ពីរបៀបដែល AI ដំណើរការ', en: 'Explain how AI works' },
  chipMath: { km: 'តើ 127 គុណនឹង 49 ស្មើប៉ុន្មាន?', en: 'What is 127 x 49?' },
  chipImage: { km: 'បង្កើតរូបភាព៖ ថ្ងៃលិចលើប្រាសាទអង្គរវត្ត', en: 'Create an image: sunset over Angkor Wat' },
  chipAudio: { km: 'បង្កើតសំឡេង៖ សូមស្វាគមន៍មក A2I', en: 'Create audio: Welcome to A2I' },
  chipPoem: { km: 'សរសេរកំណាព្យខ្លីអំពីកម្ពុជា', en: 'Write a short poem about Cambodia' },
  chipBenefits: { km: 'ពន្យល់ពីអត្ថប្រយោជន៍របស់ AI', en: 'Explain the benefits of AI' },
  featBrowserT: { km: 'AI ក្នុងកម្មវិធីរុករក', en: 'In-browser AI' },
  featBrowserS: { km: 'ដំណើរការក្រៅបណ្ដាញលើឧបករណ៍របស់អ្នក', en: 'Runs offline on your device' },
  featBrowserSt: { km: 'ក្នុងម៉ាស៊ីន', en: 'Local only' },
  featZenT: { km: 'OpenCode Zen', en: 'OpenCode Zen' },
  featZenS: { km: 'ម៉ូដែលឥតគិតថ្លៃ — បានកំណត់នៅម៉ាស៊ីនមេ', en: 'Free frontier models — server configured' },
  featZenStReady: { km: 'រួចរាល់នៅម៉ាស៊ីនមេ', en: 'Server ready' },
  featZenStActive: { km: 'កំពុងប្រើ', en: 'Active' },
  featZenStSetup: { km: 'កំណត់ឥតគិតថ្លៃ', en: 'Set up free' },
  featGemT: { km: 'Gemini', en: 'Gemini' },
  featGemS: { km: 'កូនសោ Google ផ្ទាល់ខ្លួនរបស់អ្នក', en: 'Your own Google key' },
  featGemSt: { km: 'មិនទាន់កំណត់', en: 'Not set' },
  featFastT: { km: 'AI ខ្លាំង + លឿន ឥតគិតថ្លៃ', en: 'Free & smart' },
  featFastS: {
    km: 'Groq/Cerebras — model 70B+, លឿនណាស់, ឥតគិតថ្លៃ (ជាង model ក្នុងកម្មវិធីរុករក)',
    en: 'Groq/Cerebras — 70B+ models, very fast, free (stronger than the in-browser model)',
  },
  featFastStReady: { km: 'បានកំណត់', en: 'Configured' },
  featFastStSetup: { km: 'កំណត់ឥតគិតថ្លៃ', en: 'Set up free' },
  featWebT: { km: 'ស្វែងរកបណ្ដាញ', en: 'Web search' },
  featWebS: { km: 'ចម្លើយដោយយោងប្រភព', en: 'Answers grounded in sources' },
  featWebSt: { km: 'ប្ដូរក្នុងរបារខាងលើ', en: 'Toggle in topbar' },
  featLiveT: { km: 'ការសន្ទនាជាសំឡេង', en: 'Live voice' },
  featLiveS: { km: 'AI សំឡេង 3D — និយាយជាមួយ A2I', en: '3D voice AI — talk to A2I' },
  featLiveSt: { km: 'ទំព័រផ្ទាល់', en: 'Live page' },
  featMediaT: { km: 'រូបភាព និងសំឡេង', en: 'Image & audio' },
  featMediaS: { km: 'បង្កើតរូប និងសំឡេង', en: 'Generate pictures and voice' },
  featMediaSt: { km: 'វាយ /image ឬ /audio', en: 'Type /image · /audio' },

  // ---- Engine options ----
  engAuto: { km: 'ស្វ័យប្រវត្តិ — ប្រើ AI ល្អបំផុត (ប្ដូរដោយស្វ័យប្រវត្តិ)', en: 'Auto — best available (auto-failover)' },
  engBrowser: { km: 'AI ក្នុងកម្មវិធីរុករក (គ្មាន server គ្មាន API)', en: 'In-browser AI (no server, no API)' },
  engAll: { km: 'ខួរក្បាលទាំងអស់រួមគ្នា', en: 'All brains together' },
  engGeminiAdd: { km: 'បន្ថែមកូនសោ Gemini…', en: 'Add Gemini API key…' },
  engGeminiChange: { km: 'ប្ដូរកូនសោ Gemini…', en: 'Change Gemini API key…' },
  engAdd: { km: 'បន្ថែមខួរក្បាល (Ollama, LM Studio, អាសយដ្ឋានណាមួយ)…', en: 'Add brain (Ollama, LM Studio, any URL)…' },

  // ---- Status ----
  stAuto: { km: 'ស្វ័យប្រវត្តិ — ប្រើ AI ល្អបំផុត ប្ដូរដោយស្វ័យប្រវត្តិពេលដល់ដែនកំណត់', en: 'Auto — uses the best brain, auto-switches on limits' },
  stGemini: { km: 'កំពុងប្រើកូនសោរបស់អ្នក', en: 'using your API key' },
  stWillCombine: { km: 'នឹងសួរ {n} ខួរក្បាល រួចបញ្ចូលគ្នា', en: 'will ask {n} brains and combine' },
  stWillCall: { km: 'នឹងហៅ {name}', en: 'will call {name}' },
  stDownloading: { km: 'កំពុងទាញយកម៉ូដែល (ម្ដងគត់)…', en: 'downloading model (one time)…' },
  stModelPct: { km: 'កំពុងផ្ទុក AI ម៉ូដែល {pct}% (កំពុងទាញយក {pct}% ម្ដងគត់)', en: 'loading AI model {pct}% (downloading {pct}% — one-time)' },
  stWarmup: { km: 'កំពុងកម្ដៅ AI…', en: 'warming up…' },
  stCpuReady: { km: 'ត្រៀមរួច៖ {model} — របៀប CPU យឺតជាង', en: 'ready: {model} — CPU mode, slower' },
  stCompat: { km: 'កំពុងប្ដូរទៅកម្មវិធីបញ្ចូលគ្នាត្រូវគ្នា…', en: 'switching to compatibility engine…' },
  stLocalSet: { km: 'ឯកសារម៉ូដែលបានកំណត់៖ {name} — គ្មានទាញយក', en: 'Model file set: {name} — no download' },
  stFirstMsg: { km: 'ម៉ូដែលផ្ទុកពេលផ្ញើសារដំបូង', en: 'model loads on first message' },
  stNoGpu: { km: 'គ្មាន GPU — របៀប CPU នឹងផ្ទុកពេលផ្ញើសារដំបូង', en: 'no GPU — CPU mode will load on first message' },

  // ---- Toasts & errors ----
  tCopied: { km: 'ចម្លងទៅក្ដារតម្បៀតខ្ទាស់ហើយ', en: 'Copied to clipboard' },
  tGeminiSaved: { km: 'Gemini {model} បានរក្សាទុក និងប្រើប្រាស់', en: 'Gemini {model} saved & activated' },
  tGeminiCleared: { km: 'សម្អាតកូនសោ Gemini ហើយ', en: 'Gemini key cleared' },
  tZenKeyWorks: { km: 'កូនសោ Zen ដំណើរការ — រក្សាទុកដើម្បីប្រើ', en: 'Zen key works — save to activate' },
  tZenTestFailed: { km: 'ការសាកល្បង Zen បរាជ័យ៖ {msg}', en: 'Zen test failed: {msg}' },
  tZenSaved: { km: 'Zen {model} បានរក្សាទុក និងប្រើប្រាស់', en: 'Zen {model} saved & activated' },
  tZenCleared: { km: 'សម្អាតកូនសោ Zen ហើយ', en: 'Zen key cleared' },
  tCloudReady: { km: 'A2I Cloud រួចរាល់ — {model}', en: 'A2I Cloud ready — {model}' },
  tNoExport: { km: 'គ្មានអ្វីអាចនាំចេញទេ', en: 'Nothing to export yet.' },
  tShareFail: { km: 'ការចែករំលែកមិនគាំទ្រទេ — បានចម្លងទៅក្ដារតម្បៀតខ្ទាស់វិញ', en: 'Share not supported — copied to clipboard instead.' },
  errGeminiKey: { km: 'មិនទាន់មានកូនសោ Gemini — បំពេញកូនសោក្នុងការកំណត់', en: 'No Gemini API key — paste a key in Settings' },
  errGeminiReach: { km: 'មិនអាចភ្ជាប់ Gemini បានទេ', en: 'Could not reach Gemini.' },
  errGeminiQuota: { km: 'Gemini ដល់ដែនកំណត់នៃការប្រើឥតគិតថ្លៃ (429)', en: 'Gemini free-tier quota reached (429' },
  errCloudReach: { km: 'មិនអាចភ្ជាប់ A2I Cloud បានទេ', en: 'Could not reach A2I Cloud.' },
  errCloudNotConfig: { km: 'A2I Cloud មិនទាន់កំណត់ទេ', en: 'A2I Cloud is not configured yet.' },
  errBrainReach: { km: 'មិនអាចភ្ជាប់ទៅ {name} ({url}) បានទេ', en: 'Could not reach {name} ({url}).' },
  errBrainQuota: { km: '{name}៖ ដល់ដែនកំណត់ (429)', en: '{name}: quota/rate-limit reached (429' },
  errNotAudio: { km: 'មិនមែនជាសំឡេងទេ', en: 'not audio' },
  noteModel:
    {
      km: 'ម៉ូដែល ({model}) មិនទាន់មានក្នុងម៉ាស៊ីនទេ — ឥឡូវកំពុងទាញយក និងផ្ទុក។ ម្ដងនេះអាចចំណាយពេលយូរ ហើយប្រើអ៊ីនធឺណិត។ ម៉ូដែលធំគួរតែជ្រើសរើសក្នុងបញ្ជីខាងលើ (Qwen2.5 7B ឡើងទៅ)។',
      en: 'Model ({model}) is not on this device yet — downloading and loading it now. This can take a while and uses internet. For bigger models, pick one from the list above (Qwen2.5 7B and up).',
    },
  noteOffline:
    {
      km: '{name} មិនអាចភ្ជាប់បាន — កំពុងប្ដូរទៅ AI ក្នុងកម្មវិធីរុករក',
      en: '{name} is offline — switching to the in-browser AI',
    },
  emptyChat: { km: 'ការសន្ទនាទទេ', en: 'Empty chat' },

  // ---- Homepage ----
  hpBadge: { km: 'ដំណើរការ ២៤/៧ — ឥតគិតថ្លៃ', en: 'Always on — free' },
  hpTitle1: { km: 'AI គ្រប់រូបភាពរបស់អ្នក', en: 'Your all-in-one AI,' },
  hpTitle2: { km: 'ក្នុងឧបករណ៍មួយ', en: 'in one place' },
  hpSub: { km: 'ម៉ូដែលឥតគិតថ្លៃ ការសន្ទនាជាសំឡេង 3D ការស្វែងរកបណ្ដាញ ការបង្កើតរូបភាព និងសំឡេង — រត់លើឧបករណ៍របស់អ្នក ឬម៉ាស៊ីនមេរបស់អ្នក ដោយគ្មាន API ខាងក្រៅ។', en: 'Free frontier models, 3D voice chat, web search, image & audio generation — on your device or your own server, no external APIs.' },
  hpCta: { km: 'ចាប់ផ្ដើមជជែក', en: 'Start chatting' },
  hpCta2: { km: 'សាកល្បងសំឡេងផ្ទាល់', en: 'Try Live voice' },
  hpChip1: { km: 'ឥតគិតថ្លៃ', en: 'Free' },
  hpChip2: { km: 'ឯកជន', en: 'Private' },
  hpChip3: { km: 'គ្មានប័ណ្ណឥណទាន', en: 'No credit card' },
  hpChip4: { km: 'គ្មានការទាញយកកម្មវិធី', en: 'No app download' },
  hpStatModels: { km: 'ម៉ូដែល', en: 'models' },
  hpStatFree: { km: 'ឥតគិតថ្លៃ', en: 'free' },
  hpStatSeconds: { km: 'វិនាទី', en: 'seconds' },
  hpStatLocal: { km: 'ក្នុងម៉ាស៊ីន', en: 'local-first' },
  hpPreviewTitle: { km: 'មើលការសន្ទនាគំរូ', en: 'A chat, in action' },
  hpPreview1u: { km: 'ពន្យល់ពីរបៀបដែល AI ដំណើរការ ក្នុងភាសាសាមញ្ញ', en: 'Explain how AI works in simple terms' },
  hpPreview1a: { km: 'AI គឺជាកម្មវិធីដែលរៀនពីទិន្នន័យជាច្រើន ដើម្បីទស្សន៍ទាយ និងបង្កើតអត្ថបទ រូបភាព សំឡេង… វាមិនមែនជាវេទមន្តទេ គឺជាគណិតវិទ្យាដ៏ស្មុគស្មាញ។', en: 'AI is software that learns from large amounts of data to predict and generate text, images, audio… Not magic — sophisticated math.' },
  hpPreview2u: { km: 'សរសេរមុខងារ Python ដើម្បីរាប់ពាក្យក្នុងអត្ថបទ', en: 'Write a Python function to count words in a text' },
  hpPreview2a: { km: 'ដូចនេះ៖', en: 'Here you go:' },
  hpFeaturesH: { km: 'អ្វីដែលអ្នកអាចធ្វើបាន', en: 'What you can do' },
  hpFeaturesSub: { km: 'ឧបករណ៍គ្រប់យ៉ាងរួមគ្នា ក្នុងកម្មវិធីមួយ', en: 'Everything together, in one app' },
  hpF1t: { km: 'ការសន្ទនាប្រកបដោយបញ្ញា', en: 'Smart conversations' },
  hpF1s: { km: 'ម៉ូដែលជាច្រើនដើម្បីជ្រើសរើស — ពីលឿន ទៅជំនាញបំផុត។', en: 'Many models to choose from — fast to expert.' },
  hpF2t: { km: 'ការសន្ទនាជាសំឡេង 3D', en: '3D voice assistant' },
  hpF2s: { km: 'និយាយជាមួយ A2I ផ្ទាល់ ក្នុងបរិយាកាស 3D ផ្សាយផ្ទាល់។', en: 'Talk to A2I in a live 3D world.' },
  hpF3t: { km: 'ការស្វែងរកបណ្ដាញ', en: 'Web search' },
  hpF3s: { km: 'ចម្លើយដោយយោងប្រភពពីអ៊ីនធឺណិត។', en: 'Answers grounded in real sources.' },
  hpF4t: { km: 'បង្កើតរូបភាព និងសំឡេង', en: 'Image & audio' },
  hpF4s: { km: 'វាយ /image ឬ /audio ដើម្បីបង្កើតភ្លាមៗ។', en: 'Type /image or /audio to create instantly.' },
  hpF5t: { km: 'ក្នុងម៉ាស៊ីន ឬក្រៅបណ្ដាញ', en: 'On-device & offline' },
  hpF5s: { km: 'ម៉ូដែល GGUF ផ្ទាល់ខ្លួន ដោយគ្មានការទាញយក ឬ API ខាងក្រៅ។', en: 'Your own GGUF models — no downloads, no APIs.' },
  hpF6t: { km: 'ឯកជន និងសេរី', en: 'Private & free' },
  hpF6s: { km: 'កូនសោរបស់អ្នក ទិន្នន័យរបស់អ្នក។', en: 'Your keys, your data.' },
  hpStepsH: { km: 'ចាប់ផ្ដើមក្នុងរយៈពេល ៣ ជំហាន', en: 'Start in 3 steps' },
  hpStepsSub: { km: 'គ្មានគណនី គ្មានប័ណ្ណឥណទាន', en: 'No account, no credit card' },
  hpS1t: { km: 'បើកទំព័រ', en: 'Open the app' },
  hpS1s: { km: 'ចូលមើល ai.ponloe.app ពីទូរស័ព្ទ ឬកុំព្យូទ័រណាមួយ។', en: 'Visit ai.ponloe.app on any phone or laptop.' },
  hpS2t: { km: 'ជ្រើសរើសម៉ូដែល', en: 'Pick a model' },
  hpS2s: { km: 'A2I Cloud ដំណើរការភ្លាមៗ — ឬបន្ថែមកូនសោរបស់អ្នក។', en: 'A2I Cloud works instantly — or add your own key.' },
  hpS3t: { km: 'ចាប់ផ្ដើមជជែក', en: 'Start chatting' },
  hpS3s: { km: 'សួរអ្វីក៏បាន — ឬចុចលើប្រធានបទណាមួយ។', en: 'Ask anything — or tap a suggestion.' },
  hpFaqH: { km: 'សំណួរគេសួរញឹកញាប់', en: 'Frequently asked' },
  hpFaq1q: { km: 'A2I គិតលុយទេ?', en: 'Is A2I free?' },
  hpFaq1a: { km: 'បាទ — គ្មានថ្លៃលាក់ទេ។ A2I Cloud ប្រើម៉ូដែលឥតគិតថ្លៃ ហើយអ្នកអាចប្រើកូនសោផ្ទាល់ខ្លួនសម្រាប់ម៉ូដែលបន្ថែម។', en: 'Yes — no hidden costs. A2I Cloud uses free models, and you can bring your own key for more.' },
  hpFaq2q: { km: 'ទិន្នន័យរបស់ខ្ញុំមានសុវត្ថិភាពដែរទេ?', en: 'Is my data private?' },
  hpFaq2a: { km: 'ការសន្ទនារបស់អ្នករក្សាទុកក្នុងកម្មវិធីរុករករបស់អ្នក។ កូនសោ API ផ្ញើទៅអ្នកផ្ដល់សេវារៀងៗខ្លួនតែប៉ុណ្ណោះ។', en: 'Chats stay in your browser. API keys are sent only to their provider.' },
  hpFaq3q: { km: 'តើត្រូវការកាតគ្រាប់វីដេអូដែរទេ?', en: 'Do I need a GPU?' },
  hpFaq3a: { km: 'អត់ទេ — ម៉ូដែលក្នុងកម្មវិធីរុករកអាចដំណើរការដោយ CPU បាន បើយឺតជាងបន្តិច។', en: 'No — in-browser models can run on CPU (a bit slower).' },
  hpFaq4q: { km: 'អាចប្រើក្នុងទូរស័ព្ទបានទេ?', en: 'Does it work on mobile?' },
  hpFaq4a: { km: 'បាទ — អាចដំឡើងជាកម្មវិធីពីកម្មវិធីរុករក ដូចកម្មវិធីដើមដែរ។', en: 'Yes — install it from the browser as a native-like app.' },
  hpFootNote: { km: 'រត់ដោយឥតគិតថ្លៃ — បើកប្រភពកូដនៅ GitHub', en: 'Free forever — open source on GitHub' },
  hpNavChat: { km: 'ជជែក', en: 'Chat' },
  hpNavLive: { km: 'សំឡេងផ្ទាល់', en: 'Live' },
  hpLangSwitch: { km: 'ភាសា / Language', en: 'Language / ភាសា' },
  hpNavHow: { km: 'របៀបដំណើរការ', en: 'How it works' },
  hpNavFaq: { km: 'សំណួរញឹកញាប់', en: 'FAQ' },
  hpPreviewYou: { km: 'អ្នក', en: 'You' },

  // ---- Live page ----
  liveBack: { km: 'ត្រឡប់ក្រោយ', en: 'Back' },
  liveHome: { km: 'ទំព័រដើម', en: 'Home' },
  liveText: { km: 'អត្ថបទ', en: 'Text' },
  liveVoice: { km: 'សំឡេង', en: 'Voice' },
  livePh: { km: 'វាយសារនៅទីនេះ…', en: 'Type a message…' },
  liveCaption: { km: 'ចុចប៊ូតុងមីក រួចនិយាយ…', en: 'Tap the mic and speak…' },
  liveReady: { km: 'ត្រៀមរួច', en: 'READY' },
  liveListening: { km: 'កំពុងស្ដាប់…', en: 'LISTENING…' },
  liveThinking: { km: 'កំពុងគិត…', en: 'THINKING…' },
  liveSpeaking: { km: 'កំពុងនិយាយ…', en: 'SPEAKING…' },
  liveOffline: { km: 'ម៉ូដែលបានបិទ', en: 'MODEL OFF' },
  liveMicBlocked: { km: 'មីកត្រូវបានរាំង — អនុញ្ញាតិឲ្យប្រើមីក', en: 'microphone blocked — allow mic access' },
  liveNoVoice: { km: 'មិនគាំទ្រការនិយាយ — សូមវាយជំនួស', en: 'voice input not supported — type instead' },
  liveNoVoice2: { km: 'មិនគាំទ្រការនិយាយនៅទីនេះ — វាយខាងក្រោម', en: 'voice not supported here — type below' },
  liveGemCleared: { km: 'បានលុប Gemini — កំពុងប្រើ A2I Core ក្នុងម៉ាស៊ីន', en: 'Gemini cleared — using local A2I Core' },
  liveGemReady: { km: 'Gemini រួចរាល់ — ចុចមីក រួចនិយាយ', en: 'Gemini ready — tap the mic and speak' },
  liveErrBrain: { km: 'មិនអាចភ្ជាប់ខួរក្បាល A2I បានទេ — ចាប់ផ្ដើម A2I Core (http://127.0.0.1:8990) សិន', en: 'No A2I brain reachable — start A2I Core (http://127.0.0.1:8990) first.' },
  liveFootSR: { km: 'និយាយ ឬវាយ — ភ្ជាប់ A2I Core ក្នុងម៉ាស៊ីនអ្នក', en: 'Talk or type — powered by your local A2I Core.' },
  liveFootNote: { km: 'ការស្គាល់សំឡេងប្រើសេវាកម្ម speech របស់កម្មវិធីរុករក', en: 'Voice recognition uses your browser\'s speech service.' },
  liveFootNoSR: { km: 'កម្មវិធីរុករកនេះមិនគាំទ្រការនិយាយទេ — សូមវាយសួរ', en: 'This browser has no speech input — type to chat.' },
};

export function getLang(): Lang {
  try {
    return localStorage.getItem('a2i-lang') === 'en' ? 'en' : 'km';
  } catch {
    return 'km';
  }
}

export function setLang(lang: Lang): void {
  try {
    localStorage.setItem('a2i-lang', lang);
  } catch { /* ignore */ }
  for (const fn of listeners) {
    try { fn(lang); } catch { /* ignore */ }
  }
}

export function toggleLang(): Lang {
  const next = getLang() === 'km' ? 'en' : 'km';
  setLang(next);
  return next;
}

// Plain translate for non-React code (chat-core, live-core).
export function T(key: string): string {
  const e = DICT[key];
  if (!e) return key;
  return e[getLang() === 'en' ? 'en' : 'km'];
}

// Same as T but with {token} replacement.
export function Tf(key: string, vars: Record<string, string>): string {
  let out = T(key);
  for (const [k, v] of Object.entries(vars)) {
    out = out.split('{' + k + '}').join(v);
  }
  return out;
}

const listeners: Array<(l: Lang) => void> = [];

export function onLangChange(fn: (l: Lang) => void): () => void {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

// React hook for client components (homepage). Starts at the SSR-safe default
// and syncs from localStorage on mount (client-only).
export function useLang(): Lang {
  const [lang, setL] = useState<Lang>('km');
  useEffect(() => {
    setL(getLang());
    return onLangChange(setL);
  }, []);
  return lang;
}
