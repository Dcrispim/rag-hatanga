# Ragatanga RAG CLI

Este CLI unificado permite executar as principais operações do projeto Ragatanga RAG: indexação, chat e execução de prompts, com suporte a seleção do diretório base.

## Uso

```sh
python src/cli.py [--base-dir CAMINHO] {index,chat,prompt} [opções do comando]
```

## Argumentos globais

- `--base-dir CAMINHO`  
  Define o diretório base dos arquivos do projeto.  
  Padrão: diretório atual (`.`).

## Comandos

### index

Indexa arquivos `.md` do diretório base para uso em RAG.

**Exemplo:**
```sh
python src/cli.py --base-dir ./meus_docs index
```

**Opções do comando:**
- `-p`, `--partial`  
  Indexa apenas arquivos novos (incremental).

### chat

Inicia o modo chat, utilizando o índice e embeddings do diretório base.

**Exemplo:**
```sh
python src/cli.py chat
```

### prompt

Executa um prompt customizado utilizando o índice do diretório base.

**Exemplo:**
```sh
python src/cli.py prompt
```

## Observações

- Todos os comandos respeitam o argumento `--base-dir`, que pode ser usado para trabalhar com múltiplos conjuntos de dados/índices.
- O CLI utiliza o Python do ambiente virtual `.venv` localizado na raiz do projeto.
