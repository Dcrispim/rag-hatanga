import sys
from pathlib import Path
from prompt_preview import generate_prompt_markdown
import pyperclip

def generate_prompt(title: str, base_path="./src/prompt_base.md"):
    base = Path(base_path).read_text(encoding="utf-8")
    prompt = base.replace("TITLE_STRING", title)
    return prompt

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python unit.py 'Título do Capítulo' [caminho_do_template.md] [caminho_destino]")
        sys.exit(1)
    title = sys.argv[1]
    template_path = sys.argv[2] if len(sys.argv) > 2 else "./src/prompt_base.md"
    destination = sys.argv[3] if len(sys.argv) > 3 else None
    prompt = generate_prompt(title, template_path)
    result = generate_prompt_markdown(prompt)
    
    if destination:
        # Salvar no arquivo de destino
        dest_path = Path(destination)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        dest_path.write_text(result, encoding="utf-8")
        print(f"Prompt salvo em: {dest_path}")
    else:
        # Comportamento padrão: copiar para clipboard
        pyperclip.copy(result)
    
    print(result)