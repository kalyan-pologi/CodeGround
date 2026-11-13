const group = (title, ids) => ({ title, ids });

export const genaiNavigation = [
  { title: 'Getting started', links: ['home', 'claude-code'] },
  { title: 'Core concepts', groups: [
    group('Foundations', ['llm', 'context', 'contexteng', 'tokens', 'temperature', 'hallucination', 'sysprompt', 'cot', 'fewshot']),
    group('Embeddings & Vector Search', ['embeddings', 'similarity', 'semanticsearch', 'reranking', 'hybridsearch', 'vectordb']),
    group('RAG', ['ragbasics', 'advancedrag', 'chunking', 'ragpipeline', 'ragvsfine', 'rageval']),
    group('Agents & Orchestration', ['agents', 'agenticloops', 'multiagent', 'p-agent', 'p-multiagent', 'planning', 'memory', 'mcp']),
    group('Frameworks & Tooling', ['langchain', 'langgraph', 'llamaindex', 'tooluse', 'p-toolrouter', 'openaisdk']),
    group('Fine-Tuning & Alignment', ['instructiontune', 'lora', 'peft', 'rlhf', 'prompting']),
    group('Multimodal & Diffusion', ['diffusion', 'imagegen', 'vlm']),
    group('Production & Reliability', ['observability', 'costopt', 'llmcaching', 'guardrails', 'promptinjection', 'streaming'])
  ]},
  { title: 'Key technologies', groups: [
    group('Models & APIs', ['openai', 'claude', 'gemini', 'ollama']),
    group('Vector Stores', ['chroma', 'pgvector', 'pinecone', 'weaviate']),
    group('Infra & Serving', ['huggingface', 'vllm'])
  ]},
  { title: 'Patterns', groups: [group('GenAI Patterns', ['p-caching', 'p-eval', 'p-fanout', 'p-guardrail', 'p-memory', 'p-rag', 'p-streaming', 'p-summarize', 'p-multiagent', 'peft', 'rageval'])]},
  { title: 'Question breakdowns', groups: [
    group('Classic GenAI Products', ['q-chatgpt', 'q-copilot', 'q-codegen', 'q-codeassist']),
    group('RAG Systems', ['q-docsearch', 'q-perplexity', 'q-researchagent']),
    group('Agent Systems', ['q-customerservice', 'q-emailagent', 'q-videoanalysis']),
    group('Multimodal', ['q-imagegen', 'q-cursor'])
  ]}
];
