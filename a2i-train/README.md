# A2I Train — Teach Your AI / បង្រៀន AI របស់អ្នក

មានវិធីពីរដើម្បីធ្វើឱ្យ A2I ឆ្លាតជាងមុនជាមួយទិន្នន័យរបស់អ្នក។

There are two ways to make A2I smarter with your own data.

## វិធីទី១ (ងាយបំផុត, គ្មាន GPU): បន្ថែមចំណេះដឹង / Add knowledge (RAG)

Upload ឯកសារចូល GitHub — A2I អានវាភ្លាមក្រោយ deploy:

1. ដាក់ file `.md` ឬ `.txt` ចូល folder [`a2i-web/knowledge/`](../a2i-web/knowledge/)
2. បន្ថែមឈ្មោះ file ចូល [`a2i-web/knowledge/index.json`](../a2i-web/knowledge/index.json)
3. Commit + push → Vercel deploy ដោយស្វ័យប្រវត្តិ
4. A2I នឹងឆ្លើយសំណួរដោយផ្អែកលើឯកសាររបស់អ្នក (ខួរក្បាលទាំងអស់)

នេះជាវិធីដែលត្រូវប្រើ ៩៥% នៃករណី៖ បន្ថែមចំណេះដឹងអំពីអាជីវកម្ម,
ឯកសារ, ចំណេះដឹងភាសាខ្មែរ ។ល។ — លទ្ធផលភ្លាមៗ គ្មានការ train ទេ។

For A2I Core (self-hosted), the same idea: `./run.sh --knowledge-dir ~/my-docs`.

## វិធីទី២ (កម្រិតខ្ពស់): Fine-tune model ពិតៗ / Real fine-tuning

### 🇰🇭 សម្រាប់ភាសាខ្មែរ — ប្រើ notebook SEA-LION (ណែនាំ)

សម្រាប់ AI ខ្មែរខ្លាំង សូមប្រើ [`khmer_sealion_finetune.ipynb`](khmer_sealion_finetune.ipynb) —
QLoRA 4-bit លើ SEA-LION 8B (model ដែល pretrain ជាមួយខ្មែរផ្ទាល់)។
រត់បានលើ Colab/Kaggle T4 ឥតគិតថ្លៃ។ បើក notebook → Runtime → T4 GPU → Run all។
Model ៨B នេះសរសេរខ្មែរបានល្អជាង Qwen-0.5B ក្នុង `finetune.py` ច្រើន។

Notebook default ចង្អុលទៅ repo របស់អ្នកនៅ https://huggingface.co/you2show ៖
- **Model**: `you2show/Llama-SEA-LION-v3-8B-IT-bucket` (copy សាធារណៈ → មិនត្រូវ gated login)
- **Dataset**: distillation dataset របស់អ្នក — ជំហានទី ៣ **auto-detect** ទម្រង់ column
  (chat `messages`, ShareGPT `conversations`, Alpaca `instruction/output`, `prompt/completion`,
  `question/answer`, ឬ `text`) ដូច្នេះមិនចាំបាច់កែ code ទោះ dataset ប្រើ schema ណាក៏ដោយ។

### ទាញ adapter ពី Kaggle → serve ក្នុង A2I (មួយ command)

Train លើ Kaggle រួច? [`pull_and_serve.sh`](pull_and_serve.sh) ទាញ output នៃ kernel
(LoRA adapter) មក រួច serve វាតាម vLLM (គ្មាន merge)៖

```bash
cd a2i-train
./pull_and_serve.sh you2show/notebook75c11cd48c ./kaggle-out
# download-only៖ SERVE=0 ./pull_and_serve.sh ...
```

វាប្រើ Kaggle auth ដែលមានស្រាប់ ([kaggle-cli](https://github.com/you2show/kaggle-cli)៖
`kaggle auth login` / `KAGGLE_API_TOKEN` / `~/.kaggle/…`) ហើយ **មិនរក្សាទុក token ទេ**។
បន្ទាប់មក A2I web → ⚙️ Settings → AI providers → `http://127.0.0.1:8000/v1`។

### Store dataset/model លើ Hugging Face (កុំ download ម្តងទៀត)

មិនចង់រៀបចំ ឬ upload ទិន្នន័យរាល់ session? ដាក់វានៅ **Hugging Face Hub** ម្តង
រួច notebook ទាញវាដោយ cache (download តែម្តងក្នុង session មួយ)៖

```python
# ១. Upload dataset របស់អ្នក (ធ្វើម្តងគត់)
from huggingface_hub import login; login()          # token ពី huggingface.co/settings/tokens
from datasets import load_dataset
ds = load_dataset("json", data_files="train.jsonl")
ds.push_to_hub("your-username/my-khmer-data")        # → private dataset repo

# ២. ក្រោយមក គ្រាន់តែ៖ (កែ DATASET_ID ក្នុង notebook)
DATASET_ID = "your-username/my-khmer-data"
```

Model/adapter ក៏ដូចគ្នា៖ `model.push_to_hub("your-username/sealion-khmer-lora")`
រក្សាទុកអចិន្ត្រៃយ៍ (Colab លុប file មូលដ្ឋានពេល session ចប់ តែ HF Hub នៅ)។
HF cache ដាក់ file នៅ `~/.cache/huggingface` ដូច្នេះក្នុង session មួយវាមិន re-download ទេ។

### finetune.py — script សាមញ្ញ (model តូច)

ការ train ត្រូវការ **GPU** — GitHub គ្រាន់តែផ្ទុកទិន្នន័យ មិន train ឱ្យទេ។
ប្រើ GPU ឥតគិតថ្លៃរបស់ **Google Colab** (T4):

1. រៀបចំទិន្នន័យជា `train.jsonl` (មើលទម្រង់ក្នុង [`train.example.jsonl`](train.example.jsonl)) —
   យ៉ាងតិច ~100-1000 គូ សំណួរ-ចម្លើយ គុណភាពល្អ
2. បើក [colab.research.google.com](https://colab.research.google.com) → New notebook →
   Runtime → Change runtime type → **T4 GPU**
3. Upload `finetune.py` និង `train.jsonl` របស់អ្នក រួចរត់:

   ```
   !pip install -q transformers datasets peft trl bitsandbytes
   !python finetune.py --data train.jsonl
   ```

4. ~30-60 នាទីក្រោយ វានឹងចេញ folder `a2i-model/` (LoRA merged) —
   បំប្លែងជា GGUF ដើម្បីប្រើក្នុង A2I:

   ```
   !git clone https://github.com/ggerganov/llama.cpp
   !pip install -q -r llama.cpp/requirements.txt
   !python llama.cpp/convert_hf_to_gguf.py a2i-model --outfile a2i-model.gguf --outtype q8_0
   ```

5. ប្រើ model ថ្មី:
   - **A2I Core**: ដាក់ file នៅ `a2i-core/models/model.gguf` → `./run.sh`
   - **A2I Web (CPU mode)**: host file GGUF (ឧ. Hugging Face repo របស់អ្នក) រួចកំណត់
     ក្នុង browser console: `localStorage.setItem('a2i-cpu-model-url', 'https://.../a2i-model.gguf')`

ចំណាំ / Notes:

- Fine-tuning ល្អសម្រាប់ *របៀបនិយាយ, ទម្រង់ចម្លើយ, ភាសា, ចំណេះជំនាញចង្អៀត*។
  សម្រាប់ *ចំណេះដឹងទូទៅ/ឯកសារ* — វិធីទី១ (RAG) ផ្តល់លទ្ធផលល្អជាង និងងាយជាង។
- Model មូលដ្ឋានក្នុង script ជា Qwen2.5-0.5B-Instruct (តូច, train លឿន, រត់បានគ្រប់ម៉ាស៊ីន)។
  អាចប្តូរទៅ 1.5B/3B បើ GPU មាន memory គ្រប់។
- ទិន្នន័យកាន់តែស្អាត model កាន់តែឆ្លាត — គុណភាពសំខាន់ជាងបរិមាណ។
