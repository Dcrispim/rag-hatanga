# Instalação de Dependências do Sistema para Electron

O Electron requer algumas bibliotecas do sistema para funcionar no Linux/WSL.

## Instalação no Ubuntu/Debian/WSL

Execute o seguinte comando para instalar todas as dependências necessárias:

```bash
sudo apt-get update
sudo apt-get install -y \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libxss1 \
  libgtk-3-0
```

## Verificação

Após instalar, você pode verificar se todas as dependências estão disponíveis:

```bash
ldd /home/diego/projs/rag-hatanga/electron/node_modules/electron/dist/electron | grep "not found"
```

Se não houver saída, todas as dependências estão instaladas corretamente.

## Alternativa: Usar Electron via npx

Se você não quiser instalar as dependências do sistema, pode tentar usar o Electron via npx:

```bash
cd electron
npx electron .
```

Mas isso ainda pode requerer as mesmas dependências do sistema.

