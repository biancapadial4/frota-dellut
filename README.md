# Reserva de Veículo · Dellut

Site para a equipe pedir o carro da empresa (HB20 e Nivus). O pedido fica pendente até o gestor aprovar, e todo mundo vê a agenda da semana.

## Como funciona

```
Site (Vercel)  ──►  API (Google Apps Script, conta frotadellut@gmail.com)  ──►  Planilha + e-mails
index.html          doPost: config · agenda · criar · reserva · decidir         "Reservas do Veículo · Frota Dellut"
aprovar.html
```

- **index.html**: formulário de pedido, aviso de rodízio de SP e agenda da semana.
- **aprovar.html**: página que o gestor abre pelos botões Aprovar/Recusar do e-mail. Abrir o link não decide nada; a decisão só acontece no clique.
- **apps-script/Code.gs**: cópia do código que roda no Google Apps Script. Ele guarda as reservas na planilha, bloqueia horário ocupado e envia os e-mails. **Não roda na Vercel.** Fica aqui como cópia de segurança.

## Configuração

| O quê | Onde |
|---|---|
| Endereço da API | `config.js` |
| E-mail do gestor e do financeiro, carros, centros de custo, endereço do site | bloco `CONFIG` no topo do `Code.gs`, dentro do Apps Script |

Depois de mudar o `Code.gs` no Apps Script: **Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar**. O endereço da API continua o mesmo.

## Publicar na Vercel

1. Suba esta pasta para um repositório no GitHub.
2. Na Vercel: **Add New → Project**, escolha o repositório. Framework: **Other**. Sem comando de build. Clique em **Deploy**.
3. Copie o endereço que a Vercel gerar (ex.: `https://frota-dellut.vercel.app`).
4. No Apps Script, coloque esse endereço em `SITE_URL` no `CONFIG` e publique uma nova versão. Assim os botões do e-mail passam a abrir o site da Vercel.

## Dia a dia

- **Cancelar uma reserva:** na planilha, mude a coluna Status para `Cancelada`.
- **Limite de e-mails:** a conta Gmail gratuita envia para cerca de 100 destinatários por dia (uns 30 pedidos).
- **Rodízio:** o aviso segue a regra de SP (dias úteis, 7h–10h e 17h–20h). Em feriados o rodízio é suspenso, mas o aviso aparece mesmo assim.
