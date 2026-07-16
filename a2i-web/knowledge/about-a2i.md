# About A2I

A2I is an all-in-one AI platform created by you2show. It gathers many AI
brains into one place: in-browser models that run on the user's own device
(GPU via WebLLM or CPU via wllama), self-hosted A2I Core servers, and any
OpenAI-compatible endpoint such as Ollama or LM Studio. Its "All brains
together" mode asks every brain at once and combines their answers.

A2I runs 100% without external AI APIs: the models run on the user's own
hardware and their data never leaves their machine.

## How to teach A2I new knowledge

Add `.md` or `.txt` files to the `a2i-web/knowledge/` folder in the GitHub
repository, list each file name in `knowledge/index.json`, and push. After
Vercel redeploys, A2I automatically reads these documents and uses them to
answer questions. This is called retrieval-augmented generation (RAG).
