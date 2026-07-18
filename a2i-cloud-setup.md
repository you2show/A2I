# A2I Cloud — Setup / ការតម្លើង

**A2I Cloud** ធ្វើឱ្យ A2I ឆ្លើយ **លឿន គុណភាពខ្ពស់ គ្មានទាញ model** លើគ្រប់ឧបករណ៍
(ទូរស័ព្ទក៏បាន) ដោយ model រត់លើ GPU របស់ provider — មិនមែនលើ browser អ្នក។
API key លាក់ក្នុង Vercel environment variable ដូច្នេះអ្នកប្រើមិនឃើញ។

A2I Cloud makes A2I answer **fast, high-quality, with no download** on any
device. A Vercel serverless function (`/api/chat`) forwards your chat to a
hosted, OpenAI-compatible model; the key stays server-side.

## ជំហានតម្លើង / Steps

### 1. យក endpoint + key ពី provider មួយ (open model, មាន free tier)

ជ្រើស inference provider ណាមួយដែលផ្តល់ **OpenAI-compatible API** សម្រាប់ model
open-source (ឧ. Llama, Qwen, DeepSeek, Mistral)។ អ្នកនឹងទទួលបាន៖

- **Base URL** ដែលបញ្ចប់ដោយ `/v1` (ឧ. `https://<provider>/v1`)
- **API key**
- **Model id** (ឧ. ឈ្មោះ model open-source ដែល provider គាំទ្រ)

> ចំណាំ៖ A2I ដំណើរការជាមួយ endpoint OpenAI-compatible **ណាក៏បាន** — រួមទាំង
> A2I Core ឬ Ollama របស់អ្នកផ្ទាល់ដែលបើកចេញ internet។

### 2. ដាក់ Environment Variables ក្នុង Vercel

Vercel → Project `a2-i` → **Settings** → **Environment Variables** → បន្ថែម ៣៖

| Name | Value |
| ---- | ----- |
| `A2I_API_BASE` | Base URL របស់ provider (បញ្ចប់ដោយ `/v1`) |
| `A2I_API_KEY` | API key សម្ងាត់ |
| `A2I_MODEL` | Model id |

ជ្រើស environment **Production** (និង Preview បើចង់)។

### 3. Redeploy

Vercel → **Deployments** → deployment ចុងក្រោយ → **⋯** → **Redeploy**
(ដើម្បីឱ្យ env vars ថ្មីមានប្រសិទ្ធភាព)។

### 4. រួចរាល់!

បើក `a2-i.vercel.app` — អ្នកនឹងឃើញ **☁️ A2I Cloud (fast, no download)**
ជា option លំនាំដើម។ ផ្ញើសារ → ឆ្លើយភ្លាមៗ គ្មានទាញអ្វី។

## របៀបពិនិត្យ / Verify

- បើក `a2-i.vercel.app/api/chat` ក្នុង browser — គួរបង្ហាញ
  `{"configured": true, "model": "..."}`។ បើ `configured: false` = env vars
  មិនទាន់ត្រូវ ឬមិនទាន់ redeploy។
- បើ Cloud មិនទាន់តម្លើង A2I នៅតែដំណើរការដោយ in-browser AI ដដែល (fallback)។

## សុវត្ថិភាព / Security

- API key នៅតែ**ក្នុង server (Vercel) ប៉ុណ្ណោះ** — មិនចេញទៅ browser ឡើយ។
- Function គ្រាន់តែ forward សំណួរ → ចម្លើយ។ គ្មានរក្សាទុក log អ្វីទេ។
