from langchain_ollama import OllamaEmbeddings, OllamaLLM
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from constants import BASE_DIR
import os
import subprocess
import argparse
import json
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

# Carregar variáveis de ambiente do arquivo .env
load_dotenv()

# Configurações do .env com valores padrão
LLM_MODEL = os.getenv("LLM_MODEL", "llama3.1")
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0"))
EMBEDDINGS_MODEL = os.getenv("EMBEDDINGS_MODEL", "nomic-embed-text")
RETRIEVER_K = int(os.getenv("RETRIEVER_K", "4"))

vectorstore_path = os.path.join(BASE_DIR)
# Embeddings
embeddings = OllamaEmbeddings(model=EMBEDDINGS_MODEL)

def load_vectorstore():
    """Carrega o vectorstore"""
    return FAISS.load_local(
        vectorstore_path,
        embeddings,
        allow_dangerous_deserialization=True
    )

# Vectorstore inicial
vectorstore = load_vectorstore()
retriever = vectorstore.as_retriever(search_kwargs={"k": RETRIEVER_K})

# LLM
llm = OllamaLLM(
    model=LLM_MODEL,
    temperature=LLM_TEMPERATURE
)

# Prompt
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

# Prompt para gerar título
title_prompt = PromptTemplate(
    template="""
Com base na pergunta e resposta abaixo, gere um título contextual de até 10 palavras em português.
O título deve ser conciso e descrever o assunto principal da conversa.

Pergunta: {question}

Resposta: {answer}

Título (máximo 10 palavras):
""",
    input_variables=["question", "answer"]
)

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

def generate_title(question, answer):
    """Gera um título contextual baseado na pergunta e resposta"""
    try:
        # Criar uma chain simples para gerar o título
        title_chain = title_prompt | llm | StrOutputParser()
        title = title_chain.invoke({"question": question, "answer": answer})
        # Limitar usando split()[:9] para forçar o corte caso o modelo gere mais palavras
        title_words = title.strip().split()[:9]
        return " ".join(title_words)
    except Exception as e:
        # Em caso de erro, usar um título padrão baseado na pergunta
        question_words = question.strip().split()[:9]
        return " ".join(question_words)

def save_chat_history(question, answer, sources=None, title=None, silent=False):
    """Salva a pergunta e resposta em um arquivo markdown e reindexa o RAG"""
    global vectorstore, retriever, chain
    
    # Criar diretório se não existir
    chat_history_dir = os.path.join(BASE_DIR, "chat_history")
    os.makedirs(chat_history_dir, exist_ok=True)
    
    # Gerar timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    
    # Gerar título se não foi fornecido
    if title is None:
        title = generate_title(question, answer)
    
    # Salvar pergunta e resposta no mesmo arquivo
    message_filename = f"{timestamp}_message.md"
    message_file = os.path.join(chat_history_dir, message_filename)
    with open(message_file, "w", encoding="utf-8") as f:
        f.write(f"# {title}\n\n")
        f.write("# Pergunta\n\n")
        f.write(f"{question}\n\n")
        f.write("# Resposta\n\n")
        f.write(f"{answer}\n\n")
    
    # Salvar fontes no arquivo JSON
    font_refs_file = os.path.join(chat_history_dir, "font-refs.json")
    
    # Carregar JSON existente ou criar novo
    if os.path.exists(font_refs_file):
        try:
            with open(font_refs_file, "r", encoding="utf-8") as f:
                font_refs = json.load(f)
        except (json.JSONDecodeError, IOError):
            font_refs = {}
    else:
        font_refs = {}
    
    # Adicionar fontes para este arquivo
    font_refs[message_filename] = sources if sources else []
    
    # Salvar JSON atualizado
    with open(font_refs_file, "w", encoding="utf-8") as f:
        json.dump(font_refs, f, ensure_ascii=False, indent=2)
    
    if not silent:
        print(f"💾 Histórico salvo: {os.path.basename(message_file)}")
    
    # Reindexar o RAG
    if not silent:
        print("🔄 Reindexando RAG...")
    try:
        # Executar index.py a partir do diretório src
        project_root = os.path.dirname(os.path.dirname(__file__))
        index_script = os.path.join(project_root, "src", "index.py")
        result = subprocess.run(
            ["~/projs/ragatanga_rag/.venv/bin/python3", "index.py", "-p"],
            capture_output=True,
            text=True,
            cwd=project_root
        )
        if result.returncode == 0:
            if not silent:
                print("✅ RAG reindexado com sucesso")
            # Recarregar vectorstore e atualizar chain
            vectorstore = load_vectorstore()
            retriever = vectorstore.as_retriever(search_kwargs={"k": RETRIEVER_K})
            chain = (
                {
                    "context": retriever | format_docs,
                    "question": RunnablePassthrough(),
                }
                | prompt
                | llm
                | StrOutputParser()
            )
        else:
            if not silent:
                print(f"⚠️ Erro ao reindexar: {result.stderr}")
    except Exception as e:
        if not silent:
            print(f"⚠️ Erro ao executar reindexação: {e}")

# Chain (LCEL)
chain = (
    {
        "context": retriever | format_docs,
        "question": RunnablePassthrough(),
    }
    | prompt
    | llm
    | StrOutputParser()
)

def get_reference_files(question):
    """Obtém os arquivos de referência usados para responder a pergunta"""
    # Usar invoke() pois o retriever é um Runnable
    docs = retriever.invoke(question)
    reference_files = set()
    
    for doc in docs:
        # Extrair o caminho do arquivo dos metadados
        source = doc.metadata.get("source", "")
        if source:
            # Tentar normalizar para caminho relativo ao BASE_DIR
            try:
                rel_path = os.path.relpath(source, BASE_DIR)
                reference_files.add(rel_path)
            except ValueError:
                # Se não for possível calcular caminho relativo, usar o caminho completo
                reference_files.add(source)
    
    return sorted(list(reference_files))

def process_question(question, json_mode=False):
    """Processa uma pergunta e retorna a resposta"""
    # Timestamp da pergunta
    question_timestamp = datetime.now().isoformat()
    
    # Obter arquivos de referência antes de gerar a resposta
    reference_files = get_reference_files(question)
    
    # Gerar resposta
    answer = chain.invoke(question)
    
    # Timestamp da resposta
    answer_timestamp = datetime.now().isoformat()
    
    # Gerar título contextual
    title = generate_title(question, answer)
    
    # Se modo JSON, retornar JSON estruturado
    if json_mode:
        result = {
            "question": question,
            "question_timestamp": question_timestamp,
            "message": answer,
            "answer_timestamp": answer_timestamp,
            "sources": reference_files,
            "title": title
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        # Salvar histórico e reindexar (sem output no modo JSON)
        save_chat_history(question, answer, sources=reference_files, title=title, silent=True)
        return result
    else:
        # Modo normal com output formatado
        print("\n🤖 Resposta:")
        print(answer)
        
        # Mostrar arquivos de referência
        if reference_files:
            print("\n📚 Arquivos de referência:")
            for file_path in reference_files:
                print(f"  • {file_path}")
        else:
            print("\n📚 Nenhum arquivo de referência encontrado")
        
        # Salvar histórico e reindexar
        save_chat_history(question, answer, sources=reference_files, title=title)
        return answer

# Processar argumentos de linha de comando
parser = argparse.ArgumentParser(description="Chat RAG com Ragatanga")
parser.add_argument("-q", "--question", type=str, help="Fazer uma pergunta diretamente sem entrar no loop interativo")
parser.add_argument("-json", "--json", action="store_true", help="Retornar resposta em formato JSON estruturado")
args = parser.parse_args()

# Se o parâmetro -q foi fornecido, executar a pergunta e sair
if args.question:
    process_question(args.question, json_mode=args.json)
else:
    # Chat loop interativo
    while True:
        q = input("\n❓ Pergunta (ou 'sair'): ")
        if q.lower() == "sair":
            break
        process_question(q, json_mode=args.json)
