# A2I Hybrid API and Web-Search Research Notes

Research captured 2026-08-14. Free access, model availability, quotas, and provider policies can change; A2I must display providers as optional network modes, never as unlimited or permanently free.

| Service | Integration relevance | Current official free-access information | Source |
|---|---|---|---|
| OpenRouter | One OpenAI-compatible chat endpoint for many providers/models; `openrouter/free` automatically picks an available free model. | Requires an API key. `openrouter/free` uses random available free models and feature-aware routing; availability is not guaranteed. | https://openrouter.ai/openrouter/free |
| Groq | OpenAI-compatible hosted inference; fast large open models. | Current limits are organization/model-specific; documented models include Llama 3.3 70B, GPT-OSS 20B/120B, Qwen 27B and more. Requests can receive HTTP 429 at limits. | https://console.groq.com/docs/rate-limits |
| Google Gemini API | Hosted multimodal API option. | Google documents a Free tier for some models and rate limits by model/project. Its pricing page states that Free-tier content may be used to improve Google products; privacy-sensitive prompts should remain local or use the paid tier after reviewing terms. | https://ai.google.dev/gemini-api/docs/pricing ; https://ai.google.dev/gemini-api/docs/rate-limits |
| Hugging Face Inference Providers | Unified API for 200+ hosted models/providers; OpenAI-compatible chat endpoint. | Free users receive $0.10 monthly credits, subject to change. Hugging Face docs list automatic/provider-specific routing and require an inference-permitted token. This is experimentation credit, not a high-volume free API. | https://huggingface.co/docs/inference-providers/pricing ; https://huggingface.co/docs/inference-providers/en/index |
| Cloudflare Workers AI | Broad hosted catalog including Llama, Qwen, Mistral, embeddings, image and speech tasks. | Workers Free includes 10,000 Neurons/day at no charge; exceeding it requires Workers Paid. Integration requires a Cloudflare account/Worker architecture rather than a simple generic OpenAI endpoint. | https://developers.cloudflare.com/workers-ai/platform/pricing/ |
| Cerebras | Fast hosted inference. | New accounts get a $5 free trial after adding a verified payment method; it expires in 30 days. Official docs state there is no permanently renewing no-cost tier. | https://inference-docs.cerebras.ai/support/rate-limits |
| Tavily | Dedicated AI web search, extract, map and crawl API. | Free plan: 1,000 credits/month. Basic search costs 1 credit; advanced search costs 2 credits. | https://docs.tavily.com/documentation/api-credits |
| Brave Search API | Independent-index web-search API suitable for grounded research. | Search is $5/1,000 requests and includes $5 in free monthly credits. Brave says free-plan subscription requires card verification as an anti-fraud measure. | https://brave.com/search/api/ |
| Google Custom Search JSON API | Legacy programmable search API. | Existing customers receive 100 free queries/day, but Google documents that the service is not available to new customers and will be discontinued January 1, 2027. Do not make it A2I's recommended default. | https://developers.google.com/custom-search/v1/overview |

## Architecture decision

A2I should use a **local-core broker** rather than putting API keys in browser `localStorage` or in a public deployment. The browser sends a provider ID and chat text only to `127.0.0.1:8990`; Core stores API keys in the current user's OS configuration directory and forwards a request only after the user explicitly selects that provider. The Local GGUF engine remains the default.

Web search is separate from chat inference. A2I must name the selected search provider, show that the query leaves the PC, and require a confirmation before each external search. Returned result URLs/snippets should be visibly cited and should not silently enter private knowledge storage.
