import argparse
import os
import sys
from pathlib import Path

from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import FAISS


# -----------------------------
# Config
# -----------------------------
BASE_DIR = Path(os.environ.get("BASE_DIR","docs")).resolve()
INDEXED_FILE = BASE_DIR / ".rag_indexeds"
VECTORSTORE_DIR = BASE_DIR  # FAISS já salva vários arquivos aqui
RAGIGNORE_FILE = BASE_DIR / ".ragignore"

# -----------------------------
# Args
# -----------------------------
parser = argparse.ArgumentParser(description="Indexação RAG")
parser.add_argument(
    "-p",
    "--partial",
    action="store_true",
    help="Indexa apenas arquivos novos (incremental)"
)
args = parser.parse_args()

# -----------------------------
# Load indexed paths
# -----------------------------
if INDEXED_FILE.exists():
    indexed_paths = set(INDEXED_FILE.read_text(encoding="utf-8").splitlines())
else:
    indexed_paths = set()

# -----------------------------
# Load .ragignore paths
# -----------------------------
if RAGIGNORE_FILE.exists():
    ragignore_paths = set(
        line.strip()
        for line in RAGIGNORE_FILE.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    )
    # Normaliza para paths absolutos
    ragignore_paths = {
        str((BASE_DIR / path).resolve()) if not Path(path).is_absolute() else str(Path(path).resolve())
        for path in ragignore_paths
    }
else:
    ragignore_paths = set()

# -----------------------------
# Load documents
# -----------------------------
loader = DirectoryLoader(
    BASE_DIR,
    glob="**/*.md",
    loader_cls=TextLoader
)

documents = loader.load()

# Filtra documentos se for parcial
if args.partial and indexed_paths:
    documents = [
        doc for doc in documents
        if str(Path(doc.metadata["source"]).resolve()) not in indexed_paths
    ]

# Filtra documentos ignorados pelo .ragignore
if ragignore_paths:
    documents = [
        doc for doc in documents
        if str(Path(doc.metadata["source"]).resolve()) not in ragignore_paths
    ]

if not documents:
    print("⚠️ Nenhum novo arquivo para indexar.")
    exit(0)

# -----------------------------
# Split
# -----------------------------
splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=150
)

chunks = splitter.split_documents(documents)

# -----------------------------
# Embeddings
# -----------------------------
try:
    embeddings = OllamaEmbeddings(
        model="nomic-embed-text"
    )
    # Test connection by trying to embed a small text
    _ = embeddings.embed_query("test")
except Exception as e:
    print("❌ Erro ao conectar com Ollama:", file=sys.stderr)
    print(f"   {str(e)}", file=sys.stderr)
    print("\n💡 Verifique se:", file=sys.stderr)
    print("   1. Ollama está instalado (https://ollama.com/download)", file=sys.stderr)
    print("   2. Ollama está rodando (execute: ollama serve)", file=sys.stderr)
    print("   3. O modelo 'nomic-embed-text' está disponível (execute: ollama pull nomic-embed-text)", file=sys.stderr)
    sys.exit(1)

# -----------------------------
# Vector store
# -----------------------------
try:
    if args.partial and (VECTORSTORE_DIR / "index.faiss").exists():
        print("📌 Modo parcial: carregando índice existente")
        vectorstore = FAISS.load_local(
            VECTORSTORE_DIR,
            embeddings,
            allow_dangerous_deserialization=True
        )
        vectorstore.add_documents(chunks)
    else:
        print("📌 Modo completo: recriando índice")
        vectorstore = FAISS.from_documents(chunks, embeddings)
except Exception as e:
    print("❌ Erro ao criar vectorstore:", file=sys.stderr)
    print(f"   {str(e)}", file=sys.stderr)
    if "ConnectionError" in str(type(e)) or "Failed to connect" in str(e):
        print("\n💡 Verifique se Ollama está rodando:", file=sys.stderr)
        print("   ollama serve", file=sys.stderr)
    sys.exit(1)

vectorstore.save_local(VECTORSTORE_DIR)

# -----------------------------
# Update indexed file
# -----------------------------
new_paths = {
    str(Path(doc.metadata["source"]).resolve())
    for doc in documents
}

if args.partial:
    # append (set garante unicidade)
    indexed_paths |= new_paths
else:
    # sobrescreve tudo
    indexed_paths = new_paths

INDEXED_FILE.write_text(
    "\n".join(sorted(indexed_paths)),
    encoding="utf-8"
)

print(f"✅ Indexação concluída ({len(new_paths)} arquivos)")
