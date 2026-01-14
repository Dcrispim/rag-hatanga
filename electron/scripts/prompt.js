const process = require('process');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const VENV_PYTHON = path.join(PROJECT_ROOT, '.venv', 'bin', 'python');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');

/**
 * Gera prompt markdown usando prompt_preview.py
 * Cria um script Python temporário para chamar a função
 * @param {string} question - Pergunta do usuário
 * @param {string} baseDir - Diretório base (absoluto)
 * @returns {Promise<{success: boolean, markdown?: string, error?: string}>}
 */
function generatePrompt(question, baseDir) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      BASE_DIR: baseDir
    };

    // Criar script Python temporário
    const tempScript = path.join(os.tmpdir(), `ragatanga_prompt_${Date.now()}.py`);
    const pythonCode = `import sys
import json
import os
sys.path.insert(0, r'${SRC_DIR.replace(/\\/g, '/')}')
from prompt_preview import generate_prompt_markdown

try:
    args = json.loads(sys.stdin.read())
    markdown = generate_prompt_markdown(args['question'], base_dir=args['base_dir'])
    print(json.dumps({"success": True, "markdown": markdown}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
    sys.exit(1)
`;

    fs.writeFileSync(tempScript, pythonCode, 'utf-8');

    const argsJson = JSON.stringify({ question, base_dir: baseDir });
    const cmd = [VENV_PYTHON, tempScript];

    const process = spawn(cmd[0], cmd.slice(1), {
      env,
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Enviar JSON via stdin
    process.stdin.write(argsJson);
    process.stdin.end();

    process.on('close', (code) => {
      // Limpar script temporário
      try {
        fs.unlinkSync(tempScript);
      } catch (e) {
        // Ignorar erro de limpeza
      }

      try {
        const output = JSON.parse(stdout);
        if (output.success) {
          resolve({ success: true, markdown: output.markdown });
        } else {
          resolve({ success: false, error: output.error || stderr });
        }
      } catch (e) {
        resolve({ success: false, error: stderr || stdout || 'Erro ao processar resposta' });
      }
    });

    process.on('error', (error) => {
      // Limpar script temporário em caso de erro
      try {
        fs.unlinkSync(tempScript);
      } catch (e) {
        // Ignorar erro de limpeza
      }
      resolve({ success: false, error: error.message });
    });
  });
}

module.exports = { generatePrompt };

