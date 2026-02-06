from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import subprocess
import os
import json
import threading
import requests
import re
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Carregar variáveis de ambiente do .env
load_dotenv()

from models import (
    ChatRequest, ChatResponse, PromptRequest, PromptResponse,
    TemplateRequest, TemplateResponse, WebhookPayload, QueueStatusResponse,
    ChatHistoryRequest, ChatHistoryResponse, ChatMessage,
    ReindexRequest, ReindexResponse,
    SavePromptResponseRequest, SavePromptResponseResponse,
    BrowseRequest, BrowseResponse, BrowseItem
)
from job_queue import JobQueue, JobStatus

app = FastAPI(title="Ragatanga RAG API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, especificar origens
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializar fila
job_queue = JobQueue()

# Diretório do projeto
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
VENV_PYTHON = PROJECT_ROOT / ".venv" / "bin" / "python"
CLI_SCRIPT = PROJECT_ROOT / "src" / "cli.py"

def validate_path(path: str) -> Path:
    """Valida e retorna path absoluto, prevenindo path traversal"""
    try:
        resolved = Path(path).resolve()
        # Verificar se o path é válido e existe
        if not resolved.exists():
            raise ValueError(f"Path não existe: {path}")
        return resolved
    except Exception as e:
        raise ValueError(f"Path inválido: {e}")

def execute_cli_command(command: str, base_dir: str, question: Optional[str] = None, webhook_url: Optional[str] = None, job_id: Optional[str] = None):
    """Executa comando CLI e retorna resultado"""
    base_dir_path = validate_path(base_dir)
    env = dict(**os.environ, BASE_DIR=str(base_dir_path))
    
    cmd = [str(VENV_PYTHON), str(CLI_SCRIPT), "--base-dir", str(base_dir_path)]
    
    if command == "chat":
        cmd.append("chat")
        if question:
            cmd.extend(["-q", question, "--json"])
    elif command == "prompt":
        cmd.append("prompt")
    else:
        raise ValueError(f"Comando desconhecido: {command}")
    
    # Se webhook_url fornecido, executar em background
    if webhook_url:
        # Usar o webhook_url fornecido (já inclui job_id no query param)
        cmd.extend(["--webhook-url", webhook_url])
        if job_id:
            cmd.extend(["--job-id", job_id])
        
        # Executar em background (não esperar)
        subprocess.Popen(cmd, env=env)
        return {"success": True, "data": {"status": "started", "job_id": job_id}}
    
    try:
        result = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutos timeout
        )
        
        if result.returncode == 0:
            if command == "chat" and question:
                try:
                    output = json.loads(result.stdout)
                    return {"success": True, "data": output}
                except json.JSONDecodeError:
                    return {"success": True, "data": {"message": result.stdout}}
            return {"success": True, "data": result.stdout}
        else:
            return {"success": False, "error": result.stderr or "Erro desconhecido"}
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Timeout ao executar comando"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def process_queue():
    """Processa a fila de jobs sequencialmente"""
    while True:
        if not job_queue.queue.empty():
            with job_queue.lock:
                if job_queue.processing:
                    continue
                job_queue.processing = True
            
            try:
                job_id = job_queue.queue.get(timeout=1)
                job = job_queue.get_job(job_id)
                
                if not job:
                    continue
                
                job_queue.update_job_status(job_id, JobStatus.PROCESSING)
                
                # Construir webhook URL interno que atualiza o job
                webhook_url = f"http://localhost:8000/api/webhook?job_id={job_id}"
                
                # Executar comando com webhook (em background)
                # O CLI executará em background e chamará o webhook quando terminar
                execute_cli_command(
                    job.command,
                    job.base_dir,
                    job.question,
                    webhook_url,
                    job_id
                )
                
                # Aguardar até o job completar antes de processar próximo
                # Polling do status do job
                import time
                max_wait = 300  # 5 minutos máximo
                waited = 0
                while waited < max_wait:
                    updated_job = job_queue.get_job(job_id)
                    if updated_job and updated_job.status in [JobStatus.COMPLETED, JobStatus.FAILED]:
                        break
                    time.sleep(1)
                    waited += 1
            except Exception as e:
                print(f"Erro ao processar fila: {e}")
            finally:
                with job_queue.lock:
                    job_queue.processing = False
        else:
            import time
            time.sleep(0.5)

# Iniciar thread de processamento da fila
queue_thread = threading.Thread(target=process_queue, daemon=True)
queue_thread.start()

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Endpoint de chat"""
    if request.webhook_url:
        # Modo assíncrono: adicionar à fila
        job_id = job_queue.add_job(
            "chat",
            request.base_dir,
            request.question,
            request.webhook_url
        )
        return ChatResponse(
            job_id=job_id,
            status="queued"
        )
    else:
        # Modo síncrono: executar imediatamente
        result = execute_cli_command("chat", request.base_dir, request.question)
        if result["success"]:
            data = result["data"]
            return ChatResponse(
                answer=data.get("message", ""),
                sources=data.get("sources", []),
                status="completed"
            )
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Erro ao processar chat"))

@app.post("/api/prompt", response_model=PromptResponse)
async def generate_prompt(request: PromptRequest):
    """Gera prompt markdown baseado em contexto"""
    base_dir_path = validate_path(request.base_dir)
    
    # Importar e usar prompt_preview.py
    import sys
    sys.path.insert(0, str(PROJECT_ROOT / "src"))
    
    from prompt_preview import generate_prompt_markdown
    
    try:
        # Passar base_dir, retriever_k, chat_history_path e chat_span como argumentos para a função
        markdown = generate_prompt_markdown(
            request.question, 
            base_dir=str(base_dir_path),
            retriever_k=request.retriever_k,
            chat_history_path=request.chat_history_path,
            chat_span=request.chat_span
        )
        return PromptResponse(markdown=markdown)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/template", response_model=TemplateResponse)
async def generate_template_prompt(request: TemplateRequest):
    """Gera prompt usando template MD via unit.py"""
    base_dir_path = validate_path(request.base_dir)
    template_path = validate_path(request.template_path)
    
    # Validar que o template existe
    if not template_path.is_file():
        raise HTTPException(status_code=400, detail=f"Template não encontrado: {request.template_path} \n Crie um arquivo prompt_base.md em src/ ou forneça um caminho válido com --template")
    
    # Determinar destino: usar o fornecido ou padrão baseado no BASE_DIR
    if request.destination:
        destination_path = validate_path(request.destination)
    else:
        # Padrão: BASE_DIR/generated_prompts/titulo_sanitizado.md
        safe_title = re.sub(r'[^\w\s-]', '', request.title).strip().replace(' ', '_')
        destination_path = base_dir_path / "generated_prompts" / f"{safe_title}.md"
    
    # Chamar unit.py via subprocess com caminhos absolutos
    env = dict(os.environ)
    env['BASE_DIR'] = str(base_dir_path)
    
    unit_script = (PROJECT_ROOT / "src" / "unit.py").resolve()
    venv_python = VENV_PYTHON.resolve() if VENV_PYTHON.exists() else VENV_PYTHON
    
    cmd = [
        str(venv_python),
        str(unit_script),
        request.title,
        str(template_path.resolve()),
        str(destination_path.resolve())
    ]
    
    print(cmd)
    try:
        result = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            cwd=str(PROJECT_ROOT)
        )
        
        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Erro ao executar unit.py: {result.stderr or result.stdout}"
            )
        
        markdown = result.stdout.strip()
        return TemplateResponse(markdown=markdown)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar template: {str(e)}")

@app.post("/api/webhook")
async def webhook(request: Request):
    """Endpoint para receber callbacks do CLI"""
    # job_id pode vir do query param
    query_params = dict(request.query_params)
    target_job_id = query_params.get("job_id")
    
    # Tentar ler do body também
    try:
        body = await request.json()
        if not target_job_id and "job_id" in body:
            target_job_id = body["job_id"]
        status = body.get("status", "success")
        result_data = body.get("result")
        error_data = body.get("error")
    except:
        # Se não conseguir ler body, usar defaults
        status = "success"
        result_data = None
        error_data = None
    
    if not target_job_id:
        raise HTTPException(status_code=400, detail="job_id não fornecido")
    
    job = job_queue.get_job(target_job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")
    
    # Atualizar status do job
    if status == "success":
        print(f"Webhook recebido - Job {target_job_id} completado. Result: {result_data}")
        job_queue.update_job_status(
            target_job_id,
            JobStatus.COMPLETED,
            result=result_data
        )
    else:
        print(f"Webhook recebido - Job {target_job_id} falhou. Error: {error_data}")
        job_queue.update_job_status(
            target_job_id,
            JobStatus.FAILED,
            error=error_data or "Erro desconhecido"
        )
    
    # Se o job tinha webhook_url externo, chamá-lo
    if job.webhook_url and not job.webhook_url.startswith("http://localhost:8000"):
        try:
            webhook_payload = {
                "status": status,
                "job_id": target_job_id
            }
            if result_data:
                webhook_payload["result"] = result_data
            if error_data:
                webhook_payload["error"] = error_data
            
            requests.post(
                job.webhook_url,
                json=webhook_payload,
                timeout=10
            )
        except Exception as e:
            print(f"Erro ao chamar webhook externo: {e}")
    
    return {"status": "received", "job_id": target_job_id}

@app.get("/api/queue/status", response_model=QueueStatusResponse)
async def get_queue_status():
    """Retorna status da fila"""
    status = job_queue.get_queue_status()
    return QueueStatusResponse(**status)

@app.get("/api/queue/job/{job_id}")
async def get_job_status(job_id: str):
    """Retorna status de um job específico"""
    job = job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")
    
    response = {
        "job_id": job.job_id,
        "status": job.status.value,
        "result": job.result,
        "error": job.error
    }
    print(f"GET /api/queue/job/{job_id} - Status: {job.status.value}, Result: {job.result}")
    return response

@app.post("/api/queue/job/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancela um job"""
    job = job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")
    
    # Só pode cancelar se estiver pending ou processing
    if job.status not in [JobStatus.PENDING, JobStatus.PROCESSING]:
        raise HTTPException(
            status_code=400, 
            detail=f"Job não pode ser cancelado. Status atual: {job.status.value}"
        )
    
    job_queue.update_job_status(job_id, JobStatus.CANCELLED, error="Cancelado pelo usuário")
    
    return {
        "job_id": job_id,
        "status": "cancelled",
        "message": "Job cancelado com sucesso"
    }

@app.get("/api/config")
async def get_config():
    """Retorna configurações (placeholder)"""
    return {"message": "Config endpoint - BASE_DIR deve vir do frontend localStorage"}

@app.post("/api/chat/history", response_model=ChatHistoryResponse)
async def get_chat_history(request: ChatHistoryRequest):
    """Retorna histórico de chat filtrado por período"""
    from datetime import datetime
    import re
    print(request.history_dir)
    history_dir_path = validate_path(request.history_dir)
    
    if not history_dir_path.is_dir():
        raise HTTPException(status_code=400, detail="Diretório de histórico não encontrado")
    
    # Parsear datas se fornecidas
    start_date = None
    end_date = None
    if request.start_date:
        try:
            start_date = datetime.fromisoformat(request.start_date.replace('Z', '+00:00'))
        except:
            raise HTTPException(status_code=400, detail="Formato de data inválido (start_date)")
    if request.end_date:
        try:
            end_date = datetime.fromisoformat(request.end_date.replace('Z', '+00:00'))
        except:
            raise HTTPException(status_code=400, detail="Formato de data inválido (end_date)")
    
    messages = []

    
    # Listar todos os arquivos .md no diretório
    for md_file in history_dir_path.glob("*.md"):
        print(md_file)
        try:
            # Extrair timestamp do nome do arquivo (formato: YYYYMMDD_HHMMSS_microseconds_message.md)
            filename = md_file.name
            match = re.match(r'(\d{8})_(\d{6})_(\d+)_message\.md', filename)
            if not match:
                print(f"Debug - Arquivo: {filename} não corresponde ao formato esperado")
                continue
            
            date_str = match.group(1)
            time_str = match.group(2)
            microseconds = match.group(3)
            
            # Criar datetime do nome do arquivo
            file_datetime = datetime.strptime(f"{date_str}_{time_str}", "%Y%m%d_%H%M%S")
            file_datetime = file_datetime.replace(microsecond=int(microseconds))
            
            # Filtrar por período
            if start_date and file_datetime < start_date:
                continue
            if end_date and file_datetime > end_date:
                continue
            
            # Ler conteúdo do arquivo
            content = md_file.read_text(encoding="utf-8")
            
            # Extrair título, pergunta e resposta usando regex
            # Formato esperado: # Título (opcional)\n\n# Pergunta:\n\n{pergunta}\n\n# Resposta\n\n{resposta}
            title = filename
            question = ""
            answer = ""
            
            # Tentar encontrar título (primeiro h1 que não seja Pergunta ou Resposta)
            title_match = re.search(r'^#\s+([^P].*?)$', content, re.MULTILINE)
            if title_match:
                potential_title = title_match.group(1).strip()
                # Verificar se não é Pergunta ou Resposta
                if potential_title not in ['Pergunta', 'Pergunta:', 'Resposta']:
                    title = potential_title
            
            # Usar método de linhas (mais robusto para conteúdo com headings aninhados)
            # Dividir por linhas e procurar seções
            lines = content.split('\n')
            current_section = None
            section_content = []
            title_found_alt = (title != filename)
            
            for line in lines:
                # Verificar se é um heading de nível 1 (# Pergunta ou # Resposta)
                # Só considerar headings de nível 1 para delimitar seções principais
                heading_match = re.match(r'^#\s+(.+)$', line)
                if heading_match:
                    heading_text = heading_match.group(1).strip().rstrip(':')
                    # Salvar seção anterior antes de mudar
                    if current_section == 'question':
                        question = '\n'.join(section_content).strip()
                    elif current_section == 'answer':
                        answer = '\n'.join(section_content).strip()
                    
                    # Determinar nova seção (apenas headings de nível 1)
                    if heading_text == 'Pergunta':
                        current_section = 'question'
                        section_content = []
                    elif heading_text == 'Resposta':
                        current_section = 'answer'
                        section_content = []
                    elif not title_found_alt and heading_text not in ['Pergunta', 'Resposta', 'Pergunta:', 'Resposta:']:
                        # É um título - salvar seção anterior e parar de coletar
                        if current_section == 'question':
                            question = '\n'.join(section_content).strip()
                        elif current_section == 'answer':
                            answer = '\n'.join(section_content).strip()
                        title = heading_text
                        title_found_alt = True
                        current_section = None
                        section_content = []
                elif current_section:
                    # Adicionar conteúdo à seção atual (inclui headings aninhados, parágrafos, etc)
                    section_content.append(line)
            
            # Salvar última seção
            if current_section == 'question':
                question = '\n'.join(section_content).strip()
            elif current_section == 'answer':
                answer = '\n'.join(section_content).strip()
            
            # Debug: imprimir se não encontrou (apenas para alguns arquivos)
            if (not question or not answer) and len(messages) < 2:
                print(f"Debug - Arquivo: {filename}")
                print(f"  Título: {title}")
                print(f"  Pergunta encontrada: {bool(question)}, tamanho: {len(question)}")
                print(f"  Resposta encontrada: {bool(answer)}, tamanho: {len(answer)}")
                if not question or not answer:
                    print(f"  Primeiras 20 linhas do conteúdo:")
                    for j, line in enumerate(content.split('\n')[:20]):
                        print(f"    [{j}] {line[:80]}")
            
            messages.append(ChatMessage(
                filename=filename,
                title=title,
                question=question,
                answer=answer,
                timestamp=file_datetime.isoformat()
            ))
        except Exception as e:
            print(f"Erro ao processar arquivo {md_file}: {e}")
            continue
    
    # Ordenar por timestamp (mais recente primeiro)
    messages.sort(key=lambda x: x.timestamp, reverse=True)
    print(messages)
    return ChatHistoryResponse(messages=messages)

@app.post("/api/reindex", response_model=ReindexResponse)
async def reindex(request: ReindexRequest):
    """Reindexa arquivos usando index.py"""
    # Se base_dir não fornecido, usar o padrão do constants.py
    if request.base_dir:
        base_dir_path = validate_path(request.base_dir)
    else:
        # Usar BASE_DIR padrão do .env
        DEFAULT_BASE_DIR = os.getenv("BASE_DIR")
        if not DEFAULT_BASE_DIR:
            raise HTTPException(status_code=400, detail="BASE_DIR não configurado no arquivo .env")
        base_dir_path = Path(DEFAULT_BASE_DIR).resolve()
        if not base_dir_path.exists():
            raise HTTPException(status_code=400, detail=f"BASE_DIR padrão não existe: {DEFAULT_BASE_DIR}")
    
    # Preparar ambiente com BASE_DIR
    env = dict(os.environ)
    env['BASE_DIR'] = str(base_dir_path)
    
    # Preparar comando para index.py
    index_script = (PROJECT_ROOT / "src" / "index.py").resolve()
    venv_python = VENV_PYTHON
    
    cmd = [str(venv_python), str(index_script)]
    
    # Adicionar flag --partial se solicitado
    if request.partial:
        cmd.append("--partial")
    
    try:
        result = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            cwd=str(PROJECT_ROOT),
            timeout=600  # 10 minutos timeout para indexação
        )
        
        if result.returncode == 0:
            return ReindexResponse(
                success=True,
                message="Indexação concluída com sucesso",
                output=result.stdout
            )
        else:
            return ReindexResponse(
                success=False,
                message="Erro ao executar indexação: " + str(cmd) + str(VENV_PYTHON), 
                error=result.stderr or result.stdout
            )
    except subprocess.TimeoutExpired:
        return ReindexResponse(
            success=False,
            message="Indexação expirou (timeout de 10 minutos)",
            error="Processo demorou mais de 10 minutos para completar"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao executar indexação: {str(e)}")

@app.post("/api/prompt/save-response", response_model=SavePromptResponseResponse)
async def save_prompt_response(request: SavePromptResponseRequest):
    """Salva pergunta e resposta em arquivo markdown no chat_history"""
    from datetime import datetime
    import re
    
    # Validar diretório de histórico
    history_dir_path = validate_path(request.chat_history_dir)
    
    if not history_dir_path.is_dir():
        raise HTTPException(status_code=400, detail="Diretório de histórico não encontrado")
    
    try:
        # Gerar timestamp no formato: YYYYMMDD_HHMMSS_microseconds
        now = datetime.now()
        timestamp = now.strftime("%Y%m%d_%H%M%S_%f")
        
        # Nome do arquivo
        filename = f"{timestamp}_message.md"
        file_path = history_dir_path / filename
        
        # Função para incrementar headings em uma linha
        def increment_headings(text: str) -> str:
            """Incrementa o nível de todos os headings adicionando um #"""
            # Processar linha por linha para manter a estrutura
            lines = text.split('\n')
            result_lines = []
            for line in lines:
                # Verificar se a linha começa com heading (1-6 # seguidos de espaço ou qualquer caractere)
                # Regex mais flexível: ^(#{1,6})\s*(.+)$ permite espaços opcionais e captura qualquer conteúdo
                heading_match = re.match(r'^(#{1,6})\s*(.+)$', line)
                if heading_match:
                    # Incrementar o heading adicionando um # no início
                    hashes = heading_match.group(1)
                    content = heading_match.group(2)
                    result_lines.append('#' + hashes + ' ' + content)
                else:
                    result_lines.append(line)
            return '\n'.join(result_lines)
        
        # Incrementar headings na pergunta e resposta
        question_with_incremented_headings = increment_headings(request.question)
        answer_with_incremented_headings = increment_headings(request.answer)
        
        # Criar conteúdo do arquivo
        content = f"# Pergunta:\n\n{question_with_incremented_headings}\n\n# Resposta\n\n{answer_with_incremented_headings}\n"
        
        # Salvar arquivo
        file_path.write_text(content, encoding="utf-8")
        
        return SavePromptResponseResponse(
            success=True,
            message="Resposta salva com sucesso",
            filename=filename
        )
    except Exception as e:
        return SavePromptResponseResponse(
            success=False,
            message="Erro ao salvar resposta",
            error=str(e)
        )

@app.post("/api/browse", response_model=BrowseResponse)
async def browse_path(request: BrowseRequest):
    """Lista diretórios e arquivos .md baseado no path fornecido"""
    if request.type not in ["file", "dir"]:
        raise HTTPException(status_code=400, detail="type deve ser 'file' ou 'dir'")
    
    try:
        # Validar e resolver path
        try:
            path_obj = validate_path(request.path)
        except (PermissionError, OSError) as e:
            raise HTTPException(status_code=403, detail=f"Sem permissão para acessar o diretório: {str(e)}")
        
        try:
            if not path_obj.is_dir():
                raise HTTPException(status_code=400, detail="Path deve ser um diretório")
        except (PermissionError, OSError) as e:
            raise HTTPException(status_code=403, detail=f"Sem permissão para acessar o diretório: {str(e)}")
        
        items = []
        
        # Listar todos os itens no diretório, ignorando erros de permissão
        try:
            dir_items = path_obj.iterdir()
        except (PermissionError, OSError) as e:
            raise HTTPException(status_code=403, detail=f"Sem permissão para listar o diretório: {str(e)}")
        
        for item in dir_items:
            try:
                # Verificar se pode acessar o item (evitar Permission denied)
                if not item.exists():
                    continue
                
                # Se type é "dir", retornar apenas diretórios
                if request.type == "dir":
                    if item.is_dir():
                        items.append(BrowseItem(
                            name=item.name,
                            path=str(item),
                            is_directory=True
                        ))
                # Se type é "file", retornar diretórios e arquivos .md
                elif request.type == "file":
                    if item.is_dir():
                        items.append(BrowseItem(
                            name=item.name,
                            path=str(item),
                            is_directory=True
                        ))
                    elif item.is_file() and item.suffix.lower() == ".md":
                        items.append(BrowseItem(
                            name=item.name,
                            path=str(item),
                            is_directory=False
                        ))
            except (PermissionError, OSError) as e:
                print(f"Erro ao acessar item: {e}")
                continue
            except Exception as e:
                # Ignorar outros erros ao acessar itens individuais
                continue
        
        # Ordenar: diretórios primeiro, depois arquivos, ambos alfabeticamente
        items.sort(key=lambda x: (not x.is_directory, x.name.lower()))
        
        return BrowseResponse(
            items=items,
            current_path=str(path_obj)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar diretório: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

