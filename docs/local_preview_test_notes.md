# A2I local preview test notes

## Preview environment

- A2I Core control-plane preview: `http://127.0.0.1:8990`
- A2I Web preview: `http://localhost:3000/chat`
- Both services started successfully on 2026-08-14.

## Verified

- The Web chat page renders and loads Khmer UI.
- Settings overlay opens.
- Local Core is available for health, catalog, knowledge, tool-policy and community-asset control endpoints.

## Issue found during visual verification

The Settings overlay and engine menu still display several legacy remote-provider/API controls (Zen, Gemini, Groq, Hugging Face provider, OpenRouter, etc.), even though the recent local-only Core code has already removed all server-side proxy/provider routes. These controls are misleading and must be hidden or removed from the local-only web UI before the preview can be called a correct local-only product experience.

## Next corrective action

Remove remote-provider options from the engine selector, quick-mode chips, settings tabs and legacy setup blocks; retain only A2I Core, optional in-browser model mode, Local Model Library, local knowledge status and tool permissions.

## Corrected visual verification

After clearing the preview browser state and reloading, the engine selector exposed only A2I Local, A2I Core (local), and the in-browser model. The welcome cards showed only A2I Core, browser inference, Local Model Library, and Project review. The Settings overlay defaulted to the Local Model Library pane, with only the local model file selector and curated GGUF catalog visible; remote provider/API controls were not present. The catalog rendered the expected 1.5B, 3B, 7B, Coder 7B and SEA-LION 7B entries and correctly reported that no GGUF model is installed in this sandbox preview.
