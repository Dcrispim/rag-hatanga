const fs = require('fs').promises;
const path = require('path');
const MarkdownIt = require('markdown-it');

const md = new MarkdownIt();

/**
 * Processa histórico de chat a partir de arquivos .md
 * @param {string} historyDir - Diretório com arquivos de histórico (absoluto)
 * @param {string} startDate - Data inicial (ISO format, opcional)
 * @param {string} endDate - Data final (ISO format, opcional)
 * @returns {Promise<{success: boolean, messages?: Array, error?: string}>}
 */
async function getChatHistory(historyDir, startDate = null, endDate = null) {
  try {
    const files = await fs.readdir(historyDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    
    const messages = [];
    
    // Parsear datas se fornecidas
    let start = null;
    let end = null;
    if (startDate) {
      start = new Date(startDate);
    }
    if (endDate) {
      end = new Date(endDate);
    }

    for (const filename of mdFiles) {
      try {
        // Extrair timestamp do nome do arquivo (formato: YYYYMMDD_HHMMSS_microseconds_message.md)
        const match = filename.match(/^(\d{8})_(\d{6})_(\d+)_message\.md$/);
        if (!match) {
          continue;
        }

        const [, dateStr, timeStr, microseconds] = match;
        // Criar datetime do nome do arquivo: YYYYMMDD_HHMMSS_microseconds
        const year = dateStr.slice(0, 4);
        const month = dateStr.slice(4, 6);
        const day = dateStr.slice(6, 8);
        const hours = timeStr.slice(0, 2);
        const minutes = timeStr.slice(2, 4);
        const seconds = timeStr.slice(4, 6);
        // Microseconds precisa ter 6 dígitos para Date, mas pode ter menos no filename
        const paddedMicroseconds = microseconds.padEnd(6, '0').slice(0, 6);
        const fileDatetime = new Date(
          `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${paddedMicroseconds}Z`
        );

        // Filtrar por período
        if (start && fileDatetime < start) {
          continue;
        }
        if (end && fileDatetime > end) {
          continue;
        }

        // Ler conteúdo do arquivo
        const filePath = path.join(historyDir, filename);
        const content = await fs.readFile(filePath, 'utf-8');

        // Parsear markdown
        const tokens = md.parse(content);

        let title = filename;
        let question = '';
        let answer = '';
        let currentSection = null;
        let currentContent = [];

        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i];

          // Procurar por heading
          if (token.type === 'heading_open') {
            const level = parseInt(token.tag[1]);
            if (i + 1 < tokens.length && tokens[i + 1].type === 'inline') {
              const headingText = tokens[i + 1].content.trim();

              if (headingText === 'Pergunta') {
                if (currentSection === 'question') {
                  question = currentContent.join('\n').trim();
                }
                currentSection = 'question';
                currentContent = [];
              } else if (headingText === 'Resposta') {
                if (currentSection === 'question') {
                  question = currentContent.join('\n').trim();
                }
                currentSection = 'answer';
                currentContent = [];
              } else if (level === 1) {
                title = headingText;
              }
            }
            i += 2; // Pular heading_open e inline
            continue;
          }

          // Coletar conteúdo quando em uma seção
          if (currentSection) {
            if (token.type === 'paragraph_open') {
              if (i + 1 < tokens.length && tokens[i + 1].type === 'inline') {
                const paraContent = tokens[i + 1].content.trim();
                if (paraContent) {
                  currentContent.push(paraContent);
                }
              }
              i += 2; // Pular paragraph_open e inline
              continue;
            } else if (token.type === 'hr') {
              if (currentSection === 'answer') {
                answer = currentContent.join('\n').trim();
                currentSection = null;
                currentContent = [];
                break;
              }
            } else if (token.type === 'heading_close' || token.type === 'paragraph_close') {
              // Ignorar tokens de fechamento
              continue;
            }
          }
        }

        // Salvar última seção se ainda estava coletando
        if (currentSection === 'question') {
          question = currentContent.join('\n').trim();
        } else if (currentSection === 'answer') {
          answer = currentContent.join('\n').trim();
        }

        // Se ainda não encontrou título, tentar regex como fallback
        if (title === filename) {
          const titleMatch = content.match(/^#\s+(.+)$/m);
          if (titleMatch) {
            title = titleMatch[1].trim();
          }
        }

        messages.push({
          filename,
          title,
          question,
          answer,
          timestamp: fileDatetime.toISOString()
        });
      } catch (e) {
        console.error(`Erro ao processar arquivo ${filename}:`, e);
        continue;
      }
    }

    // Ordenar por timestamp (mais recente primeiro)
    messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return { success: true, messages };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Salva pergunta e resposta em arquivo markdown
 * @param {string} question - Pergunta
 * @param {string} answer - Resposta
 * @param {string} chatHistoryDir - Diretório de histórico (absoluto)
 * @returns {Promise<{success: boolean, message: string, filename?: string, error?: string}>}
 */
async function savePromptResponse(question, answer, chatHistoryDir) {
  try {
    // Gerar timestamp no formato: YYYYMMDD_HHMMSS_microseconds
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const microseconds = String(now.getMilliseconds()).padStart(6, '0');
    
    const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}_${microseconds}`;
    const filename = `${timestamp}_message.md`;
    const filePath = path.join(chatHistoryDir, filename);

    // Função para incrementar headings
    function incrementHeadings(text) {
      return text.split('\n').map(line => {
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          const hashes = headingMatch[1];
          const content = headingMatch[2];
          return '#' + hashes + ' ' + content;
        }
        return line;
      }).join('\n');
    }

    const questionWithIncrementedHeadings = incrementHeadings(question);
    const answerWithIncrementedHeadings = incrementHeadings(answer);

    const content = `# Pergunta:\n\n${questionWithIncrementedHeadings}\n\n# Resposta\n\n${answerWithIncrementedHeadings}\n`;

    await fs.writeFile(filePath, content, 'utf-8');

    return {
      success: true,
      message: 'Resposta salva com sucesso',
      filename
    };
  } catch (error) {
    return {
      success: false,
      message: 'Erro ao salvar resposta',
      error: error.message
    };
  }
}

module.exports = { getChatHistory, savePromptResponse };

