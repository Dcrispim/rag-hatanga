import os
import sys

PREFIX = "user"

def process_directory(directory):
    for filename in os.listdir(directory):
        if not filename.endswith(".md"):
            continue

        if not filename.startswith(f"{PREFIX}_"):
            continue

        name, ext = os.path.splitext(filename)

        if name.startswith(f"{PREFIX}_"):
            
            # remove prefix do início
            rest = name[len(PREFIX) + 1:]
            new_name = f"{rest}_{PREFIX}{ext}"

            old_path = os.path.join(directory, filename)
            new_path = os.path.join(directory, new_name)

            if old_path != new_path:
                os.rename(old_path, new_path)
                print(f"Renomeado: {filename} -> {new_name}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python move_prefix.py <diretorio>")
        sys.exit(1)

    process_directory(sys.argv[1])
