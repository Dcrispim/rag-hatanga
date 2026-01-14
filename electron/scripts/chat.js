const { spawn } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const VENV_PYTHON = path.join(PROJECT_ROOT, '.venv', 'bin', 'python');
const CLI_SCRIPT = path.join(PROJECT_ROOT, 'src', 'cli.py');

/**
 * Executa comando de chat via CLI Python
 * @param {string} question - Pergunta do usuário
 * @param {string} baseDir - Diretório base (absoluto)
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
function executeChat(question, baseDir) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      BASE_DIR: baseDir
    };

    const cmd = [
      VENV_PYTHON,
      CLI_SCRIPT,
      '--base-dir', baseDir,
      'chat',
      '-q', question,
      '--json'
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
        try {
          const output = JSON.parse(stdout);
          resolve({ success: true, data: output });
        } catch (e) {
          resolve({ success: true, data: { message: stdout } });
        }
      } else {
        resolve({ success: false, error: stderr || stdout || 'Erro desconhecido' });
      }
    });

    process.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });
  });
}

module.exports = { executeChat };

