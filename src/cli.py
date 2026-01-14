import argparse
import subprocess
from pathlib import Path
import os
import sys
import threading
import requests
import json

FILE_DIR = Path(__file__).parent.parent.resolve()

VENV_PYTHON = os.path.join(FILE_DIR, ".venv", "bin", "python")

def call_webhook(webhook_url: str, status: str, result: dict = None, error: str = None, job_id: str = None):
    """Chama webhook com resultado da execução"""
    try:
        payload = {
            "status": status,
            "job_id": job_id or "unknown"
        }
        if result:
            payload["result"] = result
        if error:
            payload["error"] = error
        
        print(f"Chamando webhook: {webhook_url} com payload: {payload}", file=sys.stderr)
        # Adicionar job_id no query param se não estiver na URL
        if job_id and "job_id" not in webhook_url:
            separator = "&" if "?" in webhook_url else "?"
            webhook_url = f"{webhook_url}{separator}job_id={job_id}"
        response = requests.post(webhook_url, json=payload, timeout=30)
        response.raise_for_status()
        print(f"Webhook chamado com sucesso. Status: {response.status_code}", file=sys.stderr)
    except Exception as e:
        print(f"Erro ao chamar webhook: {e}", file=sys.stderr)

def run_command_with_webhook(command_args: list, env: dict, webhook_url: str, job_id: str = None):
    """Executa comando e chama webhook ao terminar"""
    try:
        result = subprocess.run(
            command_args,
            env=env,
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            # Tentar parsear JSON se possível (chat.py com --json retorna JSON)
            try:
                output_data = json.loads(result.stdout)
                call_webhook(webhook_url, "success", result=output_data, job_id=job_id)
            except json.JSONDecodeError:
                # Se não for JSON, tratar como texto simples
                call_webhook(webhook_url, "success", result={"output": result.stdout}, job_id=job_id)
        else:
            error_msg = result.stderr or result.stdout or "Erro desconhecido"
            call_webhook(webhook_url, "error", error=error_msg, job_id=job_id)
    except Exception as e:
        call_webhook(webhook_url, "error", error=str(e), job_id=job_id)

def main():
    parser = argparse.ArgumentParser(description="CLI unificado Ragatanga RAG")
    parser.add_argument(
        "--base-dir",
        type=str,
        default=".",
        help="Diretório base dos arquivos"
    )
    parser.add_argument(
        "--webhook-url",
        type=str,
        help="URL do webhook para chamar ao completar execução"
    )
    parser.add_argument(
        "--job-id",
        type=str,
        help="ID do job (usado no webhook)"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("index", help="Indexa arquivos")
    subparsers.add_parser("chat", help="Inicia chat")
    subparsers.add_parser("prompt", help="Executa prompt")

    # Parse conhecendo que --webhook-url e --job-id podem vir depois do comando
    args, unknown = parser.parse_known_args()
    
    # Remover --webhook-url e --job-id de unknown se estiverem lá
    # (isso pode acontecer se vierem depois do subparser)
    filtered_unknown = []
    i = 0
    while i < len(unknown):
        arg = unknown[i]
        if arg in ['--webhook-url', '--job-id']:
            i += 2  # Pular o argumento e seu valor
            continue
        filtered_unknown.append(arg)
        i += 1
    unknown = filtered_unknown
    base_dir = str(Path(args.base_dir).resolve())

    env = dict(os.environ)
    env['BASE_DIR'] = base_dir

    if args.webhook_url:
        # Modo assíncrono: executar em background e chamar webhook
        # unknown já foi filtrado acima para remover --webhook-url e --job-id
        command_args = []
        if args.command == "index":
            command_args = [VENV_PYTHON, os.path.join(FILE_DIR, "src", "index.py")] + unknown
        elif args.command == "chat":
            command_args = [VENV_PYTHON, os.path.join(FILE_DIR, "src", "chat.py")] + unknown
        elif args.command == "prompt":
            command_args = [VENV_PYTHON, os.path.join(FILE_DIR, "src", "prompt.py")] + unknown
        
        # Executar em thread separada
        thread = threading.Thread(
            target=run_command_with_webhook,
            args=(command_args, env, args.webhook_url, args.job_id),
            daemon=False
        )
        thread.start()
        # Retornar imediatamente
        sys.exit(0)
    else:
        # Modo síncrono: executar normalmente
        if args.command == "index":
            subprocess.run(
                [VENV_PYTHON, os.path.join(FILE_DIR, "src", "index.py")] + unknown,
                env=env,
                check=True
            )
        elif args.command == "chat":
            subprocess.run(
                [VENV_PYTHON, os.path.join(FILE_DIR, "src", "chat.py")] + unknown,
                env=env,
                check=True
            )
        elif args.command == "prompt":
            subprocess.run(
                [VENV_PYTHON, os.path.join(FILE_DIR, "src", "prompt.py")] + unknown,
                env=env,
                check=True
            )

if __name__ == "__main__":
    import os
    main()
