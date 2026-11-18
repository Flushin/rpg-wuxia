# App Android (Capacitor)

O app das lojas é o mesmo jogo do `dist/` dentro de um WebView nativo (Capacitor 8).
Tudo o que muda entre web e app fica em `src/platform/` (ver `src/platform/index.ts`).

## Baixar e instalar o APK de teste

1. Em todo PR o GitHub Actions roda **"APK Android"** e gera um APK de teste (debug).
   Para gerar sem PR: aba **Actions → APK Android → Run workflow**.
2. Abra a execução e baixe **`wanderers-debug-apk`** em "Artifacts", no fim da página (vem num `.zip`).
3. No celular: copie o `app-debug.apk` para o aparelho e abra. O Android pede para permitir
   "instalar apps desconhecidos" para o app que abriu o arquivo (Arquivos, Chrome, Drive…).
4. O APK de teste é assinado com uma chave de debug: para trocar por um APK de outra máquina, desinstale antes
   (desinstalar apaga o save do app).

O app e o jogo no navegador/PWA **não** compartilham o save: são armazenamentos separados.

## Roteiro de teste no celular (D2)

- Criar personagem e jogar um pouco.
- Botão home → voltar ao app: o jogo continua.
- Botão/gesto de voltar no mapa: aparece o aviso; voltar de novo logo em seguida fecha o app.
- Fechar o app pela lista de apps recentes e abrir de novo: o personagem está lá.
- A barra de status (hora, bateria) não aparece por cima do jogo.

## Gerar no próprio computador

Precisa de Node 22, JDK 21 e Android SDK (o Android Studio instala o SDK).

```bash
npm ci
npm run android:apk
```

O APK sai em `android/app/build/outputs/apk/debug/app-debug.apk`. Para abrir no Android Studio:
`npm run android:prepare` e depois `npx cap open android`.

## Como está montado

- `capacitor.config.ts`: `appId` (**provisório**: o nome do jogo pode mudar; depois do primeiro envio à Play Store
  nunca mais muda), nome do app e `webDir: 'dist'`.
- A pasta `android/` **não** está no repositório: `npm run android:prepare` a gera a partir do `capacitor.config.ts`
  (`npx cap add android`) e copia o `dist/` para dentro (`npx cap sync`). Assim o `appId` fica num lugar só.
  Quando for preciso mexer em arquivos nativos (ícones, splash, versionCode — D7), a pasta passa a ser versionada.
- Save no app: arquivo JSON na pasta de dados do app (`@capacitor/filesystem`), com gravação atômica
  (`.tmp` → atual) e 1 backup (`.bak`). Ver `src/platform/storage.ts`.
- Segundo plano: eventos `pause`/`resume` do `@capacitor/app` (salva ao sair da tela).
- Voltar: botão Voltar do Android pelo `@capacitor/app` (primeiro avisa, segundo fecha). A D3 faz fechar a janela aberta.
- O service worker (PWA) não é registrado no app.
