from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from constants import BASE_DIR
import os
import argparse
from dotenv import load_dotenv
from datetime import datetime
import pyperclip

# Carregar variáveis de ambiente
load_dotenv()

EMBEDDINGS_MODEL = os.getenv("EMBEDDINGS_MODEL", "nomic-embed-text")
RETRIEVER_K = int(os.getenv("RETRIEVER_K", "4"))

vectorstore_path = os.path.join(BASE_DIR)

# Embeddings
embeddings = OllamaEmbeddings(model=EMBEDDINGS_MODEL)

def load_vectorstore():
    return FAISS.load_local(
        vectorstore_path,
        embeddings,
        allow_dangerous_deserialization=True
    )

vectorstore = load_vectorstore()
retriever = vectorstore.as_retriever(search_kwargs={"k": RETRIEVER_K})

# Prompt original (idêntico ao do chat)
prompt = PromptTemplate(
    template="""
Use SOMENTE o contexto abaixo para responder.
Use o contexto fornecido, mesmo que esteja em inglês.

Se não encontrar a resposta, diga que não sabe.
Responda sempre em português.
Contexto:
{context}

Pergunta:
{question}
""",
    input_variables=["context", "question"]
)

def format_docs(docs, base_dir):
    """
    Agrupa os documentos por arquivo de origem e
    adiciona o nome do arquivo antes de cada bloco de contexto.
    """
    grouped = {}

    for doc in docs:
        source = doc.metadata.get("source", "fonte_desconhecida")

        try:
            source = os.path.relpath(source, base_dir)
        except ValueError:
            pass

        grouped.setdefault(source, []).append(doc.page_content)

    blocks = []
    for source, contents in grouped.items():
        block = f"### 📄 {source}\n\n" + "\n\n".join(contents)
        blocks.append(block)

    return "\n\n---\n\n".join(blocks)

def _read_rag_priorities(base_dir):
    """
    Lê .rag_priorities em base_dir e retorna uma lista de entradas:
    [{ "priority": int, "path": <rel_path>, "alias": <str|None> }, ...]
    Retorna None se arquivo não existir ou estiver vazio.
    Formato por linha: priority, path, alias
    """
    priorities_file = os.path.join(base_dir, ".rag_priorities")
    if not os.path.exists(priorities_file):
        return None

    entries = []
    with open(priorities_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = [p.strip() for p in line.split(",")]
            if len(parts) < 2:
                continue
            try:
                priority = int(parts[0])
            except Exception:
                continue
            path = parts[1]
            alias = parts[2] if len(parts) >= 3 else None
            if not os.path.isabs(path):
                abs_path = os.path.normpath(os.path.join(base_dir, path))
            else:
                abs_path = os.path.normpath(path)
            try:
                rel_path = os.path.relpath(abs_path, base_dir)
            except Exception:
                rel_path = abs_path
            entries.append({"priority": priority, "path": rel_path, "alias": alias})

    return entries or None

def _assign_docs_to_entries(docs, entries, base_dir):
    """
    Atribui cada doc a uma entrada do .rag_priorities (ou 'others' se não casar).
    Retorna (entry_docs_map, others_list) onde entry_docs_map é dict idx -> [docs].
    """
    entry_docs = {i: [] for i in range(len(entries))}
    others = []
    for doc in docs:
        src = doc.metadata.get("source", "") or ""
        try:
            relsrc = os.path.relpath(src, base_dir)
        except Exception:
            relsrc = src
        best_idx = None
        best_len = -1
        for idx, e in enumerate(entries):
            p = e["path"]
            if relsrc.startswith(p) and len(p) > best_len:
                best_idx = idx
                best_len = len(p)
        if best_idx is not None:
            entry_docs[best_idx].append(doc)
        else:
            others.append(doc)
    return entry_docs, others

def format_docs_by_priorities(docs, entries, base_dir):
    """
    Formata os documentos separando blocos por cada entrada do .rag_priorities.
    Cada bloco começa com:
    ---
    # <Alias ou path>
    ---
    Seguido dos blocos por arquivo (reaproveita format_docs para o conteúdo interno).
    Ao final, adiciona um bloco 'Outros' para docs sem match.
    """
    entry_docs_map, others = _assign_docs_to_entries(docs, entries, base_dir)

    blocks = []
    # ordenar entries por priority asc (priority 0 primeiro)
    ordered = sorted(enumerate(entries), key=lambda t: t[1]["priority"])
    for idx, entry in ordered:
        docs_for_entry = entry_docs_map.get(idx, [])
        if not docs_for_entry:
            continue
        alias = entry.get("alias") or entry.get("path")
        inner = format_docs(docs_for_entry, base_dir)
        section = f"---\n# {alias}\n---\n\n{inner}"
        blocks.append(section)

    if others:
        inner = format_docs(others, base_dir)
        section = f"---\n# Outros\n---\n\n{inner}"
        blocks.append(section)

    return "\n\n".join(blocks) if blocks else ""

def generate_prompt_markdown(question: str, base_dir: str = None) -> str:
    """
    Gera o prompt completo (contexto + pergunta) em Markdown
    sem chamar o modelo.
    
    Args:
        question: A pergunta para gerar o prompt
        base_dir: Diretório base do projeto. Se None, usa BASE_DIR de constants.py
    """
    # Usar base_dir fornecido ou fallback para BASE_DIR de constants
    if base_dir is None:
        from constants import BASE_DIR as _BASE_DIR
        base_dir = _BASE_DIR
    else:
        base_dir = str(base_dir)  # Garantir que é string
    
    # Carregar vectorstore dinamicamente baseado no base_dir
    vectorstore_path = os.path.join(base_dir)
    # Sempre carregar do base_dir fornecido (não usar cache global)
    local_vectorstore = FAISS.load_local(
        vectorstore_path,
        embeddings,
        allow_dangerous_deserialization=True
    )
    local_retriever = local_vectorstore.as_retriever(search_kwargs={"k": RETRIEVER_K})
    
    # Tenta obter as prioridades do .rag_priorities (se existir)
    entries = _read_rag_priorities(base_dir)

    # Filtra entradas com priority == -1 (não usar no contexto)
    if entries:
        filtered_entries = [e for e in entries if e["priority"] != -1]
    else:
        filtered_entries = None

    if filtered_entries:
        # busca ampla para depois filtrar/atribuir por entrada
        try:
            candidates = local_vectorstore.similarity_search(question, k=max(RETRIEVER_K * 5, 50))
        except Exception:
            candidates = local_retriever.invoke(question)

        # agrupa candidates por entry (ou "others")
        entry_docs = {i: [] for i in range(len(filtered_entries))}
        others = []
        for doc in candidates:
            src = doc.metadata.get("source", "") or ""
            try:
                relsrc = os.path.relpath(src, base_dir)
            except Exception:
                relsrc = src
            matched = False
            # prefira o entry com path mais específico (maior comprimento)
            best_idx = None
            best_len = -1
            for idx, e in enumerate(filtered_entries):
                p = e["path"]
                if relsrc.startswith(p):
                    if len(p) > best_len:
                        best_idx = idx
                        best_len = len(p)
                        matched = True
            if matched and best_idx is not None:
                entry_docs[best_idx].append(doc)
            else:
                others.append(doc)

        # considere apenas entradas que possuem docs (não dá pra incluir o que não existe)
        available = [ (idx, filtered_entries[idx]) for idx, docs in entry_docs.items() if docs ]
        if not available:
            # fallback: nenhum documento na main/entries, usa retriever padrão
            docs = local_retriever.invoke(question)
        else:
            # calcula pesos
            sum_priorities = max(1, sum(e["priority"] for _, e in available))
            weights = {}
            for idx, e in available:
                weights[idx] = (sum_priorities - e["priority"]) / sum_priorities

            # se houver mais entradas disponíveis do que RETRIEVER_K, escolhe as top-N por peso
            if len(available) > RETRIEVER_K:
                selected_idxs = sorted(available, key=lambda t: weights[t[0]], reverse=True)[:RETRIEVER_K]
                selected_idxs = [t[0] for t in selected_idxs]
                counts = {idx: 1 for idx in selected_idxs}
            else:
                # garante ao menos 1 por entrada disponível
                counts = {idx: 1 for idx, _ in available}
                remaining = RETRIEVER_K - len(counts)
                if remaining > 0:
                    # distribuí o restante proporcionalmente aos pesos
                    total_w = max(sum(weights[idx] for idx in counts.keys()),1)
                    # cálculo de "ideais" e distribuição dos restants por parte fracionária
                    ideal = {idx: (weights[idx] / total_w) * remaining for idx in counts.keys()}
                    # ordena por parte fracionária decrescente
                    frac = sorted(ideal.items(), key=lambda t: (t[1] - int(t[1])), reverse=True)
                    for idx, _ in frac:
                        add = int(ideal[idx])
                        if remaining <= 0:
                            break
                        add = min(add, remaining)
                        counts[idx] += add
                        remaining -= add
                    # se sobrar, distribui 1 por 1 pela ordem de peso
                    if remaining > 0:
                        for idx in sorted(counts.keys(), key=lambda i: weights[i], reverse=True):
                            if remaining <= 0:
                                break
                            counts[idx] += 1
                            remaining -= 1

            # coleta docs seguindo counts (mantendo ordem de similaridade)
            selected = []
            for idx in counts:
                docs_for_entry = entry_docs[idx][:counts[idx]]
                selected.extend(docs_for_entry)

            # se ainda faltarem docs, preenche com "others" e candidatos remanescentes
            if len(selected) < RETRIEVER_K:
                needed = RETRIEVER_K - len(selected)
                picked = set(id(d) for d in selected)
                extras = [d for d in candidates if id(d) not in picked]
                selected.extend(extras[:needed])

            docs = selected[:RETRIEVER_K]
    else:
        # sem arquivo de prioridades ou todas priority=-1: comportamento padrão
        docs = local_retriever.invoke(question)

    # agora gera o contexto/prompt/md usando os docs selecionados
    # se houver entries, separa os blocos por prioridade/alias
    context = format_docs_by_priorities(docs, filtered_entries, base_dir) if filtered_entries else format_docs(docs, base_dir)

    rendered_prompt = prompt.format(
        context=context,
        question=question
    )

    sources = []
    for doc in docs:
        source = doc.metadata.get("source")
        if source:
            try:
                source = os.path.relpath(source, base_dir)
            except ValueError:
                pass
            sources.append(source)

    timestamp = datetime.now().isoformat()

    markdown = f"""# 🧠 Prompt Final (RAG Preview)

**Data:** `{timestamp}`  
**Top K:** `{RETRIEVER_K}`  

---

## ❓ Pergunta
```

{question}

```

---

## 📚 Contexto Recuperado
{context if context else "_Nenhum contexto encontrado._"}

---

## 🧩 Prompt Renderizado
```

{rendered_prompt.strip()}

```

---

## 🗂️ Arquivos de Referência
"""

    if sources:
        for src in sorted(set(sources)):
            markdown += f"- `{src}`\n"
    else:
        markdown += "_Nenhum arquivo de referência encontrado._\n"

    return markdown


# =========================
# CLI
# =========================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Preview do prompt RAG (sem chamar o modelo)"
    )

    parser.add_argument(
        "-q", "--question",
        required=True,
        help="Pergunta para gerar o prompt completo"
    )

    parser.add_argument(
        "-o", "--output",
        help="Salvar o markdown em um arquivo"
    )

    parser.add_argument(
        "--copy",
        action="store_true",
        help="Copia o prompt gerado para o clipboard"
    )

    args = parser.parse_args()

    md = generate_prompt_markdown(args.question)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(md)
        print(f"📄 Prompt salvo em: {args.output}")

    if args.copy:
        pyperclip.copy(md)
        print("📋 Prompt copiado para o clipboard")

    if not args.output:
        print(md)
