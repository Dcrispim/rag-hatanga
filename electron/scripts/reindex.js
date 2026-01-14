const { spawn } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const VENV_PYTHON = path.join(PROJECT_ROOT, '.venv', 'bin', 'python');
const INDEX_SCRIPT = path.join(PROJECT_ROOT, 'src', 'index.py');

/**
 * Reindexa arquivos usando index.py
 * @param {string|null} baseDir - Diretório base (absoluto). Se null, usa o padrão do constants.py
 * @param {boolean} partial - Se true, indexa apenas arquivos novos
 * @returns {Promise<{success: boolean, message: string, output?: string, error?: string}>}
 */
function reindex(baseDir, partial = false) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env
    };
    
    // Se baseDir fornecido, usar. Caso contrário, deixar o Python usar o padrão do constants.py
    if (baseDir) {
      env.BASE_DIR = baseDir;
    }

    const cmd = [
      VENV_PYTHON,
      INDEX_SCRIPT,
      ...(partial ? ['--partial'] : [])
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
        resolve({
          success: true,
          message: 'Indexação concluída com sucesso',
          output: stdout
        });
      } else {
        resolve({
          success: false,
          message: 'Erro ao executar indexação',
          error: stderr || stdout || 'Erro desconhecido'
        });
      }
    });

    process.on('error', (error) => {
      resolve({
        success: false,
        message: 'Erro ao executar indexação',
        error: error.message
      });
    });
  });
}

module.exports = { reindex };

