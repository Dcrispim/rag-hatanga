import sys
import os
import argparse
from pathlib import Path
from prompt_preview import generate_prompt_markdown
import pyperclip

MAIN_DIR = Path(__file__).parent


def generate_prompt(title: str, base_path=os.path.join(MAIN_DIR, "prompt_base.md")):
    base = Path(base_path).read_text(encoding="utf-8")
    if not base:
        raise ValueError(f"Template não encontrado: {base_path} \n Crie um arquivo prompt_base.md em {MAIN_DIR} ou forneça um caminho válido com --template")
    prompt = base.replace("[TITLE_STRING]", title)
    return prompt

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Gerar prompt a partir de um template",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  python unit.py "Título do Capítulo"
  python unit.py -q "o que é um failure mapping"
  python unit.py -t "Título" --template ./custom_template.md -o output.md
        """
    )
    
    # Suporta tanto -q (question) quanto -t (title) ou argumento posicional
    parser.add_argument(
        "-q", "--question",
        help="Pergunta/título para usar no prompt"
    )
    parser.add_argument(
        "-t", "--title",
        help="Título para usar no prompt"
    )
    parser.add_argument(
        "--template",
        default=os.path.join(MAIN_DIR, "prompt_base.md"),
        help=f"Caminho do template (padrão: {os.path.join(MAIN_DIR, 'prompt_base.md')})"
    )
    parser.add_argument(
        "-o", "--output",
        help="Salvar o resultado em um arquivo (ao invés de copiar para clipboard)"
    )
    # Argumento posicional para compatibilidade com uso antigo
    parser.add_argument(
        "positional_title",
        nargs="?",
        help="Título (argumento posicional, compatibilidade com uso antigo)"
    )
    
    args = parser.parse_args()
    
    # Determina o título: -q tem prioridade, depois -t, depois posicional
    if args.question:
        title = args.question
    elif args.title:
        title = args.title
    elif args.positional_title:
        title = args.positional_title
    else:
        parser.error("É necessário fornecer um título. Use -q/--question, -t/--title ou forneça como argumento posicional.")
    
    # Verifica se o template existe
    template_path = Path(args.template)
    if not template_path.exists():
        print(f"❌ Erro: Template não encontrado: {template_path} \n Crie um arquivo prompt_base.md em src/ ou forneça um caminho válido com --template", file=sys.stderr)
        sys.exit(1)
    
    try:
        prompt = generate_prompt(title, str(template_path))
        result = generate_prompt_markdown(prompt)
        
        if args.output:
            # Salvar no arquivo de destino
            dest_path = Path(args.output)
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            dest_path.write_text(result, encoding="utf-8")
            print(f"✅ Prompt salvo em: {dest_path}")
        else:
            # Comportamento padrão: copiar para clipboard
            pyperclip.copy(result)
            print("✅ Prompt copiado para clipboard")
        
        print("\n" + result)
    except Exception as e:
        print(f"❌ Erro ao gerar prompt: {e}", file=sys.stderr)
        sys.exit(1)