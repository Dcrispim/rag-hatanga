from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from langchain_core.documents import Document
import os
import argparse
import re
from dotenv import load_dotenv
from datetime import datetime, timedelta
import pyperclip
from pathlib import Path

# Carregar variáveis de ambiente
load_dotenv()

EMBEDDINGS_MODEL = os.getenv("EMBEDDINGS_MODEL", "nomic-embed-text")
RETRIEVER_K = int(os.getenv("RETRIEVER_K", "4"))

# Embeddings
embeddings = OllamaEmbeddings(model=EMBEDDINGS_MODEL)

def get_base_dir():
    """Obtém BASE_DIR da variável de ambiente, ou do .env como fallback"""
    base_dir = os.getenv("BASE_DIR")
    if not base_dir:
        raise ValueError("BASE_DIR não configurado na variável de ambiente ou arquivo .env")
    return Path(base_dir)

# Embeddings (criado uma vez, reutilizado)
embeddings = OllamaEmbeddings(model=EMBEDDINGS_MODEL)

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

def _load_chat_history_docs(chat_history_path: str, chat_span_hours: int, base_dir: str):
    """
    Carrega documentos do histórico de chat dentro do intervalo especificado.
    
    Args:
        chat_history_path: Caminho do diretório de histórico
        chat_span_hours: Número de horas para trás a partir de agora
        base_dir: Diretório base para paths relativos
    
    Returns:
        Lista de Document objects do histórico
    """
    history_dir = Path(chat_history_path)
    if not history_dir.exists() or not history_dir.is_dir():
        return []
    
    # Calcular intervalo de tempo
    now = datetime.now()
    start_time = now - timedelta(hours=chat_span_hours)
    
    docs = []
    files_checked = 0
    files_in_range = 0
    
    # Listar todos os arquivos .md no diretório
    # Ordenar por nome (que contém timestamp) para garantir ordem cronológica
    all_files = sorted(history_dir.glob("*_message.md"), key=lambda x: x.name, reverse=True)
    import sys
    print(f"DEBUG: Total de arquivos encontrados: {len(all_files)}", file=sys.stderr)
    for md_file in all_files:
        try:
            files_checked += 1
            # Extrair timestamp do nome do arquivo (formato: YYYYMMDD_HHMMSS_microseconds_message.md)
            filename = md_file.name
            match = re.match(r'(\d{8})_(\d{6})_(\d+)_message\.md', filename)
            if not match:
                continue
            
            date_str = match.group(1)
            time_str = match.group(2)
            microseconds = match.group(3)
            
            # Criar datetime do nome do arquivo
            file_datetime = datetime.strptime(f"{date_str}_{time_str}", "%Y%m%d_%H%M%S")
            # Microseconds pode ter menos de 6 dígitos, então preenchemos com zeros à direita
            # Mas precisamos ter cuidado: se microseconds tem mais de 6 dígitos, truncamos
            # Microsegundos válidos em Python são 0-999999
            if len(microseconds) > 6:
                microseconds = microseconds[:6]
            microseconds_padded = microseconds.ljust(6, '0')
            try:
                microsecond_value = int(microseconds_padded)
                # Garantir que está no range válido
                if microsecond_value > 999999:
                    microsecond_value = 999999
                file_datetime = file_datetime.replace(microsecond=microsecond_value)
            except (ValueError, OverflowError) as e:
                # Se não conseguir converter microsegundos, usar 0
                import sys
                print(f"DEBUG: Erro ao converter microsegundos '{microseconds_padded}' para arquivo {filename}: {e}", file=sys.stderr)
                pass
            
            # Filtrar por período - incluir arquivos dentro do intervalo [start_time, now]
            # Incluir arquivos que estão dentro do intervalo (inclusive nas bordas)
            if file_datetime < start_time:
                import sys
                print(f"DEBUG: Arquivo {filename} fora do intervalo (muito antigo): {file_datetime.isoformat()} < {start_time.isoformat()}", file=sys.stderr)
                continue
            if file_datetime > now:
                import sys
                print(f"DEBUG: Arquivo {filename} fora do intervalo (muito novo): {file_datetime.isoformat()} > {now.isoformat()}", file=sys.stderr)
                continue
            
            files_in_range += 1
            import sys
            print(f"DEBUG: Arquivo {filename} incluído: {file_datetime.isoformat()}", file=sys.stderr)
            
            # Ler conteúdo do arquivo
            content = md_file.read_text(encoding="utf-8")
            
            # Parsear markdown simples para extrair título, pergunta e resposta
            # Formato esperado:
            # # Título
            # 
            # # Pergunta
            # ...
            # 
            # # Resposta
            # ...
            
            lines = content.split('\n')
            title = filename
            question = ""
            answer = ""
            current_section = None
            
            for line in lines:
                line_stripped = line.strip()
                if line_stripped.startswith('# ') and not line_stripped.startswith('# Pergunta') and not line_stripped.startswith('# Resposta'):
                    # Heading nível 1 (título)
                    if current_section is None:
                        title = line_stripped[2:].strip()
                elif line_stripped == '# Pergunta':
                    current_section = 'question'
                elif line_stripped == '# Resposta':
                    current_section = 'answer'
                elif current_section == 'question':
                    question += line + '\n'
                elif current_section == 'answer':
                    answer += line + '\n'
            
            question = question.strip()
            answer = answer.strip()
            
            if question and answer:
                # Criar conteúdo combinado
                page_content = f"Pergunta: {question}\n\nResposta: {answer}"
                
                # Criar Document
                doc = Document(
                    page_content=page_content,
                    metadata={
                        "source": str(md_file.resolve()),
                        "title": title,
                        "timestamp": file_datetime.isoformat()
                    }
                )
                docs.append((doc, file_datetime))
        except Exception as e:
            # Log erro mas continue processando outros arquivos
            import sys
            print(f"Erro ao processar arquivo {md_file.name}: {e}", file=sys.stderr)
            continue
    
    # Ordenar por timestamp (mais recentes primeiro) e retornar apenas os documentos
    docs.sort(key=lambda x: x[1], reverse=True)
    
    # Debug: imprimir informações sobre o que foi encontrado
    import sys
    print(f"DEBUG: Arquivos verificados: {files_checked}, no intervalo: {files_in_range}, documentos carregados: {len(docs)}", file=sys.stderr)
    print(f"DEBUG: Intervalo: {start_time.isoformat()} até {now.isoformat()}", file=sys.stderr)
    if docs:
        print(f"DEBUG: Primeiro documento: {docs[0][1].isoformat()}, Último: {docs[-1][1].isoformat()}", file=sys.stderr)
    
    return [doc for doc, _ in docs]

def generate_prompt_markdown(question: str, base_dir: str = None, retriever_k: int = None, chat_history_path: str = None, chat_span: int = None) -> str:
    """
    Gera o prompt completo (contexto + pergunta) em Markdown
    sem chamar o modelo.
    
    Args:
        question: A pergunta para gerar o prompt
        base_dir: Diretório base do projeto. Se None, usa BASE_DIR da variável de ambiente
        retriever_k: Número de documentos a recuperar. Se None, usa RETRIEVER_K do .env
        chat_history_path: Caminho do diretório de histórico de chat. Se None, usa base_dir/chat_history
        chat_span: Número de horas para incluir histórico de chat. Se None, não inclui histórico
    """
    # Usar base_dir fornecido ou fallback para BASE_DIR da variável de ambiente
    if base_dir is None:
        base_dir = str(get_base_dir())
    else:
        # Garantir que base_dir é um Path absoluto
        base_dir_path = Path(base_dir).resolve()
    
    # Converter para string para uso consistente em todas as operações
    base_dir_str = str(base_dir_path)
    
    # Verificar se existe prompt.md customizado no base_dir
    prompt_template = None
    prompt_file = base_dir_path / "prompt.md"
    if prompt_file.exists() and prompt_file.is_file():
        # Ler o template customizado do arquivo
        try:
            custom_template_str = prompt_file.read_text(encoding="utf-8")
            # Criar PromptTemplate com o conteúdo do arquivo
            prompt_template = PromptTemplate(
                template=custom_template_str,
                input_variables=["context", "question"]
            )
        except Exception as e:
            # Se houver erro ao ler, usar o template padrão
            print(f"⚠️ Erro ao ler prompt.md: {e}. Usando template padrão.")
            prompt_template = prompt
    else:
        # Usar o template padrão
        prompt_template = prompt
    
    # Usar retriever_k fornecido ou fallback para RETRIEVER_K do .env
    if retriever_k is None:
        retriever_k = RETRIEVER_K
    
    # Carregar vectorstore dinamicamente baseado no base_dir
    # FAISS.load_local espera o diretório onde estão os arquivos index.faiss e index.pkl
    vectorstore_path = base_dir_str
    # Sempre carregar do base_dir fornecido (não usar cache global)
    local_vectorstore = FAISS.load_local(
        vectorstore_path,
        embeddings,
        allow_dangerous_deserialization=True
    )
    local_retriever = local_vectorstore.as_retriever(search_kwargs={"k": retriever_k})
    
    # Tenta obter as prioridades do .rag_priorities (se existir)
    entries = _read_rag_priorities(base_dir_str)

    # Filtra entradas com priority == -1 (não usar no contexto)
    if entries:
        filtered_entries = [e for e in entries if e["priority"] != -1]
    else:
        filtered_entries = None

    if filtered_entries:
        # busca ampla para depois filtrar/atribuir por entrada
        try:
            candidates = local_vectorstore.similarity_search(question, k=max(retriever_k * 5, 50))
        except Exception:
            candidates = local_retriever.invoke(question)

        # agrupa candidates por entry (ou "others")
        entry_docs = {i: [] for i in range(len(filtered_entries))}
        others = []
        for doc in candidates:
            src = doc.metadata.get("source", "") or ""
            try:
                relsrc = os.path.relpath(src, base_dir_str)
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

            # se houver mais entradas disponíveis do que retriever_k, escolhe as top-N por peso
            if len(available) > retriever_k:
                selected_idxs = sorted(available, key=lambda t: weights[t[0]], reverse=True)[:retriever_k]
                selected_idxs = [t[0] for t in selected_idxs]
                counts = {idx: 1 for idx in selected_idxs}
            else:
                # garante ao menos 1 por entrada disponível
                counts = {idx: 1 for idx, _ in available}
                remaining = retriever_k - len(counts)
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
            if len(selected) < retriever_k:
                needed = retriever_k - len(selected)
                picked = set(id(d) for d in selected)
                extras = [d for d in candidates if id(d) not in picked]
                selected.extend(extras[:needed])

            docs = selected[:retriever_k]
    else:
        # sem arquivo de prioridades ou todas priority=-1: comportamento padrão
        docs = local_retriever.invoke(question)

    # Integrar histórico de chat se solicitado
    history_docs_final = []  # Documentos do histórico que serão incluídos
    if chat_span is not None and chat_span > 0:
        # Determinar diretório do histórico
        if chat_history_path:
            history_dir = chat_history_path
        else:
            history_dir = os.path.join(base_dir, "chat_history")
        
        history_dir_path = Path(history_dir)
        if history_dir_path.exists() and history_dir_path.is_dir():
            # Carregar documentos do histórico
            import sys
            print(f"DEBUG: Carregando histórico de: {history_dir_path}", file=sys.stderr)
            history_docs = _load_chat_history_docs(str(history_dir_path), chat_span, base_dir)
            print(f"DEBUG: Documentos do histórico carregados: {len(history_docs)}", file=sys.stderr)
            
            if history_docs:
                # Extrair paths dos arquivos do histórico
                history_paths = {doc.metadata.get("source") for doc in history_docs}
                print(f"DEBUG: Paths do histórico: {len(history_paths)}", file=sys.stderr)
                print(f"DEBUG: Documentos do contexto padrão antes do filtro: {len(docs)}", file=sys.stderr)
                
                # Filtrar documentos do contexto padrão removendo aqueles cujo source está no histórico
                filtered_context_docs = [
                    doc for doc in docs 
                    if doc.metadata.get("source") not in history_paths
                ]
                print(f"DEBUG: Documentos do contexto padrão após filtro: {len(filtered_context_docs)}", file=sys.stderr)
                
                # Calcular quantos documentos do histórico podem ser adicionados
                available_slots = retriever_k - len(filtered_context_docs)
                print(f"DEBUG: Slots disponíveis para histórico: {available_slots}", file=sys.stderr)
                history_docs_to_add = history_docs[:available_slots]
                history_docs_final = history_docs_to_add  # Guardar para formatação separada
                print(f"DEBUG: Documentos do histórico a adicionar: {len(history_docs_to_add)}", file=sys.stderr)
                
                # Combinar: histórico primeiro (mais recentes), depois contexto padrão
                # Remover documentos menos relevantes do contexto padrão se necessário
                combined_docs = history_docs_to_add + filtered_context_docs
                docs = combined_docs[:retriever_k]
                print(f"DEBUG: Total de documentos finais: {len(docs)}", file=sys.stderr)
            else:
                print(f"DEBUG: Nenhum documento do histórico foi carregado", file=sys.stderr)
    
    # Separar documentos do histórico dos do contexto padrão para formatação
    if history_docs_final:
        # Remover documentos do histórico da lista de docs para o contexto padrão
        history_paths_final = {doc.metadata.get("source") for doc in history_docs_final}
        context_docs = [doc for doc in docs if doc.metadata.get("source") not in history_paths_final]
    else:
        context_docs = docs

    # agora gera o contexto/prompt/md usando os docs selecionados
    # se houver entries, separa os blocos por prioridade/alias
    context = format_docs_by_priorities(context_docs, filtered_entries, base_dir) if filtered_entries else format_docs(context_docs, base_dir)
    
    # Formatar histórico de conversa se houver
    history_context = ""
    if history_docs_final:
        # Formatar documentos do histórico de forma simples
        history_parts = []
        for doc in history_docs_final:
            title = doc.metadata.get("title", "Conversa")
            history_parts.append(f"### {title}\n\n{doc.page_content}")
        history_context = "\n\n---\n\n".join(history_parts)

    # Combinar histórico e contexto padrão para o prompt renderizado
    full_context = ""
    if history_context:
        full_context = f"Conversa recente:\n\n{history_context}\n\n---\n\nContexto recuperado:\n\n{context}"
    else:
        full_context = context
    
    rendered_prompt = prompt.format(
        context=full_context,
        question=question
    )

    sources = []
    for doc in docs:
        source = doc.metadata.get("source")
        if source:
            try:
                source = os.path.relpath(source, base_dir_str)
            except ValueError:
                pass
            sources.append(source)

    timestamp = datetime.now().isoformat()

    markdown = f"""# 🧠 Prompt Final (RAG Preview)

**Data:** `{timestamp}`  
**Top K:** `{retriever_k}`  

---

## ❓ Pergunta
```

{question}

```

---"""
    
    # Adicionar seção de conversa recente se houver histórico
    if history_context:
        markdown += f"""

## 💬 Conversa Recente
{history_context}

---"""
    
    markdown += f"""

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
