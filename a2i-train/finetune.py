"""Fine-tune a small open model on your own data (LoRA) for A2I.

Designed for a free Google Colab T4 GPU. See README.md for the full
step-by-step guide, including converting the result to GGUF for A2I.

Data format (train.jsonl): one JSON object per line with "messages":
    {"messages": [{"role": "user", "content": "..."},
                  {"role": "assistant", "content": "..."}]}
"""

from __future__ import annotations

import argparse

from datasets import load_dataset
from peft import LoraConfig
from transformers import AutoModelForCausalLM, AutoTokenizer
from trl import SFTConfig, SFTTrainer


def main() -> None:
    parser = argparse.ArgumentParser(description="LoRA fine-tuning for A2I")
    parser.add_argument("--data", default="train.jsonl", help="path to train.jsonl")
    parser.add_argument("--base", default="Qwen/Qwen2.5-0.5B-Instruct")
    parser.add_argument("--output", default="a2i-model")
    parser.add_argument("--epochs", type=float, default=3.0)
    args = parser.parse_args()

    dataset = load_dataset("json", data_files=args.data, split="train")
    tokenizer = AutoTokenizer.from_pretrained(args.base)
    model = AutoModelForCausalLM.from_pretrained(args.base, device_map="auto")

    trainer = SFTTrainer(
        model=model,
        processing_class=tokenizer,
        train_dataset=dataset,
        peft_config=LoraConfig(
            r=16,
            lora_alpha=32,
            lora_dropout=0.05,
            target_modules="all-linear",
            task_type="CAUSAL_LM",
        ),
        args=SFTConfig(
            output_dir=args.output + "-checkpoints",
            num_train_epochs=args.epochs,
            per_device_train_batch_size=2,
            gradient_accumulation_steps=8,
            learning_rate=2e-4,
            logging_steps=10,
            save_strategy="no",
            bf16=False,
            fp16=True,
            max_length=1024,
        ),
    )
    trainer.train()

    # Merge the LoRA adapter into the base weights so the result can be
    # converted straight to GGUF for llama.cpp / A2I.
    merged = trainer.model.merge_and_unload()
    merged.save_pretrained(args.output)
    tokenizer.save_pretrained(args.output)
    print(f"Done. Merged model saved to ./{args.output}")
    print("Next: convert to GGUF (see README.md step 4).")


if __name__ == "__main__":
    main()
