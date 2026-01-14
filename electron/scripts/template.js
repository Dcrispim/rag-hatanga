const { spawn } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const VENV_PYTHON = path.join(PROJECT_ROOT, '.venv', 'bin', 'python');
const UNIT_SCRIPT = path.join(PROJECT_ROOT, 'src', 'unit.py');

/**
 * Gera template usando unit.py
 * @param {string} title - Título do template
 * @param {string} templatePath - Caminho do template (absoluto)
 * @param {string} baseDir - Diretório base (absoluto)
 * @param {string} destination - Caminho de destino (absoluto, opcional)
 * @returns {Promise<{success: boolean, markdown?: string, error?: string}>}
 */
function generateTemplate(title, templatePath, baseDir, destination = null) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      BASE_DIR: baseDir
    };

    const cmd = [
      VENV_PYTHON,
      UNIT_SCRIPT,
      title,
      templatePath,
      ...(destination ? [destination] : [])
    ];

    const process = spawn(cmd[0], cmd.slice(1), {
      env,
      cwd: PROJECT_ROOT
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        // unit.py imprime o markdown no stdout
        const markdown = stdout.trim();
        resolve({ success: true, markdown });
      } else {
        resolve({ success: false, error: stderr || stdout || 'Erro ao gerar template' });
      }
    });

    process.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });
  });
}

module.exports = { generateTemplate };

