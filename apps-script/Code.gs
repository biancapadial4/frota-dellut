/**
 * Reserva de Veículo — Frota Dellut
 * Site de reservas com aprovação do gestor, aviso ao financeiro e alerta de rodízio.
 *
 * Só é preciso mexer no bloco CONFIG abaixo.
 */
const CONFIG = {
  // E-mail de quem aprova ou recusa as reservas
  GESTOR_EMAIL: 'financeiro@dellut.com.br',

  // Recebe uma cópia de todo pedido e de toda decisão
  FINANCEIRO_EMAIL: 'financeiro@dellut.com.br',

  // Nome que aparece como remetente dos e-mails
  NOME_REMETENTE: 'Frota Dellut',

  // Endereço do site na Vercel (ex.: 'https://frota-dellut.vercel.app').
  // Os botões Aprovar/Recusar do e-mail abrem esse site. Vazio = usa a página do próprio Apps Script.
  SITE_URL: 'https://frota-dellut.vercel.app',

  // Quem pode aprovar ou recusar (aparece como lista na página de aprovação)
  APROVADORES: ['Bianca', 'Marco', 'Ana Claudia'],

  VEICULOS: [
    { nome: 'HB20', placa: 'TEK2E75' },
    { nome: 'NIVUS', placa: 'UAF2C07' }
  ],

  CENTROS_CUSTO: [
    '101 · ADM', '2408 · TOPO RMSP E BS', '2409 · GOLFINHOS', '2411 · TOPO INTERIOR', '2414 · ETE LAVAPÉS',
    '2438 · INDAIATUBA', '2440 · PACOTE 11', '2441 · PACOTE 12', '2442 · PACOTE 13',
    '2443 · PACOTE 2B', '2444 · PACOTE 20', '2501 · PACOTE 21', '2503 · PACOTE 18A',
    '2504 · MARESIAS', '2505 · ITAPEVI OSASCO', '2506 · PACOTE 15C', '2507 · PACOTE 19',
    '2508 · GUARUJA', '2513 · ENORSUL 10B', '2514 · ENORSUL 15D', '2519 · MUTINGA 22',
    '2520 · OSASCO 23', '2521 · ITANHAEM', '2522 · PRAIA GRANDE', '2523 · ATE RMBS',
    '2524 · SAA MASSAGUAÇU', '2525 · TAIAÇUPEBA', '2526 · ATO AMPARO', '2527 · SAA ILHA BELA',
    '2603 · INTEGRA - P0TE 35C', '2605 · ILHA COMPRIDA', '2607 · CARAGUATATUBA'
  ]
};

// ---------------------------------------------------------------------------
// Daqui para baixo não precisa alterar nada.
// ---------------------------------------------------------------------------

const TZ = 'America/Sao_Paulo';
// Rodízio municipal de SP: dia da semana (1 = segunda) -> finais de placa
const RODIZIO = { 1: [1, 2], 2: [3, 4], 3: [5, 6], 4: [7, 8], 5: [9, 0] };
const JANELAS = [['07:00', '10:00'], ['17:00', '20:00']];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const CAB = ['ID', 'Criado em', 'Status', 'Veículo', 'Saída', 'Devolução', 'Nome de quem vai usar',
  'E-mail do solicitante', 'Destino', 'Finalidade', 'Centro de custo', 'Alerta de rodízio',
  'Decidido em', 'Observação do gestor', 'Token', 'Decidido por'];
const C = { id: 0, criado: 1, status: 2, veiculo: 3, inicio: 4, fim: 5, nome: 6, email: 7, destino: 8,
  finalidade: 9, centro: 10, alerta: 11, decidido: 12, obs: 13, token: 14, por: 15 };

/** Rode esta função uma vez no editor para autorizar e criar a planilha. */
function instalar() {
  const ss = planilha_();
  Logger.log('Planilha de reservas: ' + ss.getUrl());
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.acao && p.id && p.t) {
    const r = buscar_(p.id);
    const ok = r && r.token === p.t;
    const t = HtmlService.createTemplateFromFile('Decisao');
    t.logo = logo_();
    t.dados = json_({ acao: p.acao === 'recusar' ? 'recusar' : 'aprovar', id: p.id, t: p.t,
      reserva: ok ? publico_(r) : null });
    return t.evaluate().setTitle('Aprovação de reserva · Frota Dellut')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  const t = HtmlService.createTemplateFromFile('Index');
  t.logo = logo_();
  t.cfg = json_({ veiculos: CONFIG.VEICULOS, centros: CONFIG.CENTROS_CUSTO, hoje: agora_().slice(0, 10) });
  return t.evaluate().setTitle('Reserva de Veículo · Frota Dellut')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** API usada pelo site da Vercel. Recebe JSON com o campo "acao". */
function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (x) { return saida_({ ok: false, erro: 'Pedido inválido.' }); }
  let res;
  try {
    switch (body.acao) {
      case 'config':
        res = { ok: true, veiculos: CONFIG.VEICULOS, centros: CONFIG.CENTROS_CUSTO, aprovadores: CONFIG.APROVADORES, hoje: agora_().slice(0, 10) };
        break;
      case 'agenda':
        res = { ok: true, reservas: getAgenda(String(body.ini || ''), String(body.fim || '')) };
        break;
      case 'criar':
        res = criarReserva(body.dados);
        break;
      case 'reserva': {
        const r = buscar_(String(body.id || ''));
        res = r && r.token === String(body.t || '') ? { ok: true, reserva: publico_(r) }
          : { ok: false, erro: 'Este link não é válido ou o pedido não existe mais.' };
        break;
      }
      case 'decidir':
        res = decidir(String(body.id || ''), String(body.t || ''), body.tipo, body.obs, body.por);
        break;
      default:
        res = { ok: false, erro: 'Ação desconhecida.' };
    }
  } catch (err) {
    console.error(err);
    res = { ok: false, erro: 'Erro no servidor. Tente de novo em instantes.' };
  }
  return saida_(res);
}
function saida_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function linkDecisao_(acao, id, token) {
  const q = '?acao=' + acao + '&id=' + encodeURIComponent(id) + '&t=' + token;
  if (CONFIG.SITE_URL) return CONFIG.SITE_URL.replace(/\/+$/, '') + '/aprovar' + q;
  return ScriptApp.getService().getUrl() + q;
}

/** Reservas pendentes e aprovadas entre duas datas (YYYY-MM-DD). */
function getAgenda(ini, fim) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ini) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) return [];
  const a = ini + ' 00:00', b = fim + ' 24:00';
  return lerTodas_()
    .filter(r => (r.status === 'Pendente' || r.status === 'Aprovada') && r.inicio < b && a < r.fim)
    .map(r => ({ veiculo: r.veiculo, inicio: r.inicio, fim: r.fim, status: r.status, nome: r.nome, destino: r.destino }));
}

function criarReserva(d) {
  d = d || {};
  const r = {
    nome: txt_(d.nome, 80), email: txt_(d.email, 120).toLowerCase(), veiculo: txt_(d.veiculo, 20),
    inicio: txt_(d.di, 10) + ' ' + txt_(d.hi, 5), fim: txt_(d.df, 10) + ' ' + txt_(d.hf, 5),
    destino: txt_(d.destino, 120), finalidade: txt_(d.finalidade, 400), centro: txt_(d.centro, 80)
  };
  const dt = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
  if (!r.nome || !r.destino || !r.finalidade) return erro_('Preencha nome, destino e finalidade.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) return erro_('Informe um e-mail válido para receber a resposta.');
  if (!CONFIG.VEICULOS.some(v => v.nome === r.veiculo)) return erro_('Escolha um dos veículos da lista.');
  if (CONFIG.CENTROS_CUSTO.indexOf(r.centro) < 0) return erro_('Escolha um centro de custo da lista.');
  if (!dt.test(r.inicio) || !dt.test(r.fim)) return erro_('Preencha data e hora de saída e de devolução.');
  if (r.fim <= r.inicio) return erro_('A devolução precisa ser depois da saída.');
  if (r.fim <= agora_()) return erro_('Esse horário já passou. Escolha um horário futuro.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let id, token, alerta;
  try {
    const conflito = lerTodas_().find(o => (o.status === 'Pendente' || o.status === 'Aprovada') &&
      o.veiculo === r.veiculo && r.inicio < o.fim && o.inicio < r.fim);
    if (conflito) {
      return erro_('O ' + r.veiculo + ' já tem ' + (conflito.status === 'Aprovada' ? 'reserva aprovada' : 'um pedido aguardando aprovação') +
        ' de ' + fmt_(conflito.inicio) + ' até ' + fmt_(conflito.fim) + '. Escolha outro horário ou o outro carro.');
    }
    id = Utilities.formatDate(new Date(), TZ, 'yyMMdd-HHmmss') + '-' + Math.floor(100 + Math.random() * 900);
    token = Utilities.getUuid().replace(/-/g, '');
    alerta = rodizio_(r.veiculo, r.inicio, r.fim);
    const linha = [];
    linha[C.id] = id; linha[C.criado] = agora_(); linha[C.status] = 'Pendente'; linha[C.veiculo] = r.veiculo;
    linha[C.inicio] = r.inicio; linha[C.fim] = r.fim; linha[C.nome] = r.nome; linha[C.email] = r.email;
    linha[C.destino] = r.destino; linha[C.finalidade] = r.finalidade; linha[C.centro] = r.centro;
    linha[C.alerta] = alerta; linha[C.decidido] = ''; linha[C.obs] = ''; linha[C.token] = token;
    aba_().appendRow(linha);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  r.id = id; r.status = 'Pendente'; r.alerta = alerta;
  const assunto = '[Frota] Pedido de reserva · ' + r.veiculo + ' · ' + fmt_(r.inicio);
  if (CONFIG.FINANCEIRO_EMAIL.toLowerCase() !== CONFIG.GESTOR_EMAIL.toLowerCase()) {
    enviar_(CONFIG.FINANCEIRO_EMAIL, assunto, email_('Novo pedido de reserva', 'Um pedido de reserva do veículo foi feito e aguarda a aprovação do gestor.', r));
  }
  enviar_(CONFIG.GESTOR_EMAIL, assunto + ' · aguardando sua aprovação',
    email_('Pedido aguardando sua aprovação', 'Confira o pedido abaixo e escolha uma opção.', r, [
      { rotulo: 'Aprovar', url: linkDecisao_('aprovar', id, token), cor: '#1D7448' },
      { rotulo: 'Recusar', url: linkDecisao_('recusar', id, token), cor: '#AE2A21' }
    ]), r.email);
  enviar_(r.email, '[Frota] Recebemos seu pedido · ' + r.veiculo + ' · ' + fmt_(r.inicio),
    email_('Pedido recebido', 'Seu pedido foi enviado ao gestor. Você vai receber outro e-mail quando ele aprovar ou recusar. Até lá, a reserva não está confirmada.', r));
  return { ok: true, id: id, alerta: alerta };
}

/** Chamado pela página de aprovação. */
function decidir(id, t, acao, obs, por) {
  acao = acao === 'recusar' ? 'recusar' : 'aprovar';
  obs = txt_(obs, 300);
  por = CONFIG.APROVADORES.indexOf(String(por || '')) >= 0 ? String(por) : '';
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let r;
  try {
    const sh = aba_();
    const vals = sh.getDataRange().getValues();
    let i = vals.findIndex((row, k) => k > 0 && String(row[C.id]) === String(id));
    if (i < 1 || String(vals[i][C.token]) !== String(t)) return erro_('Link inválido. Use o botão do e-mail mais recente.');
    r = linhaParaObj_(vals[i]);
    if (r.status !== 'Pendente') return erro_('Este pedido já está com status "' + r.status + '". Nada foi alterado.');
    if (acao === 'aprovar') {
      const choque = vals.slice(1).map(linhaParaObj_).find(o => o.id !== r.id && o.status === 'Aprovada' &&
        o.veiculo === r.veiculo && r.inicio < o.fim && o.inicio < r.fim);
      if (choque) return erro_('Não dá para aprovar: o ' + r.veiculo + ' já está aprovado para ' + choque.nome + ' de ' + fmt_(choque.inicio) + ' até ' + fmt_(choque.fim) + '.');
    }
    r.status = acao === 'aprovar' ? 'Aprovada' : 'Recusada';
    r.obs = obs;
    r.por = por;
    if (!String(sh.getRange(1, C.por + 1).getValue())) sh.getRange(1, C.por + 1).setValue(CAB[C.por]).setFontWeight('bold').setBackground('#E2ECF5');
    sh.getRange(i + 1, C.por + 1).setValue(por);
    sh.getRange(i + 1, C.status + 1).setValue(r.status);
    sh.getRange(i + 1, C.decidido + 1).setValue(agora_());
    sh.getRange(i + 1, C.obs + 1).setValue(obs);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  const aprovada = r.status === 'Aprovada';
  const assunto = '[Frota] Reserva ' + (aprovada ? 'APROVADA' : 'RECUSADA') + ' · ' + r.veiculo + ' · ' + fmt_(r.inicio);
  const msg = aprovada ? 'A reserva foi aprovada pelo gestor. O carro está reservado neste horário.'
    : 'O gestor recusou o pedido.' + (obs ? '' : ' Fale com ele para combinar outro horário.');
  enviar_(r.email, assunto, email_(aprovada ? 'Reserva aprovada' : 'Reserva recusada', msg, r));
  enviar_(CONFIG.FINANCEIRO_EMAIL, assunto, email_(aprovada ? 'Reserva aprovada' : 'Reserva recusada', msg, r));
  return { ok: true, status: r.status };
}

// ----------------------------------------------------------------- planilha

function planilha_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { /* recria abaixo */ } }
  const ss = SpreadsheetApp.create('Reservas do Veículo · Frota Dellut');
  props.setProperty('SHEET_ID', ss.getId());
  const sh = ss.getSheets()[0];
  sh.setName('Reservas');
  sh.getRange(1, 1, 1000, CAB.length).setNumberFormat('@');
  sh.getRange(1, 1, 1, CAB.length).setValues([CAB]).setFontWeight('bold').setBackground('#E2ECF5');
  sh.setFrozenRows(1);
  sh.hideColumns(C.token + 1);
  sh.getRange(2, C.status + 1, 999, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['Pendente', 'Aprovada', 'Recusada', 'Cancelada'], true).build());
  return ss;
}
function aba_() {
  const ss = planilha_();
  return ss.getSheetByName('Reservas') || ss.getSheets()[0];
}
function lerTodas_() {
  const vals = aba_().getDataRange().getValues();
  return vals.slice(1).filter(row => row[C.id]).map(linhaParaObj_);
}
function linhaParaObj_(row) {
  const s = k => String(row[C[k]] == null ? '' : row[C[k]]).trim();
  return { id: s('id'), status: s('status'), veiculo: s('veiculo'), inicio: s('inicio'), fim: s('fim'), nome: s('nome'),
    email: s('email'), destino: s('destino'), finalidade: s('finalidade'), centro: s('centro'), alerta: s('alerta'),
    obs: s('obs'), token: s('token'), por: s('por') };
}
function buscar_(id) { return lerTodas_().find(r => r.id === String(id)) || null; }
function publico_(r) {
  return { id: r.id, status: r.status, veiculo: r.veiculo, inicio: fmt_(r.inicio), fim: fmt_(r.fim), nome: r.nome,
    email: r.email, destino: r.destino, finalidade: r.finalidade, centro: r.centro, alerta: r.alerta, por: r.por };
}

// ----------------------------------------------------------------- rodízio

function finalPlaca_(veiculo) {
  const v = CONFIG.VEICULOS.find(x => x.nome === veiculo);
  const m = v && String(v.placa).match(/(\d)\s*$/);
  return m ? Number(m[1]) : null;
}
function diaSemana_(ymd) { const p = ymd.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); }
function somaDia_(ymd, n) {
  const p = ymd.split('-').map(Number); const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}
function rodizio_(veiculo, ini, fim) {
  const f = finalPlaca_(veiculo); if (f === null) return '';
  const hits = [];
  let dia = ini.slice(0, 10);
  for (let n = 0; dia <= fim.slice(0, 10) && n < 60; n++, dia = somaDia_(dia, 1)) {
    const wd = diaSemana_(dia);
    if (!RODIZIO[wd] || RODIZIO[wd].indexOf(f) < 0) continue;
    JANELAS.forEach(j => {
      if (ini < dia + ' ' + j[1] && dia + ' ' + j[0] < fim) hits.push(DIAS[wd] + ' ' + dia.slice(8, 10) + '/' + dia.slice(5, 7) + ' das ' + j[0].slice(0, 2) + 'h às ' + j[1].slice(0, 2) + 'h');
    });
  }
  if (!hits.length) return '';
  return 'Rodízio: placa final ' + f + ' não pode circular no centro expandido de SP ' + hits.slice(0, 4).join(', ') + (hits.length > 4 ? ' e outros horários' : '') + '.';
}

// ----------------------------------------------------------------- e-mail

function enviar_(para, assunto, html, replyTo) {
  if (!para || para.indexOf('@') < 0) return;
  const opt = { to: para, subject: assunto, htmlBody: html, name: CONFIG.NOME_REMETENTE };
  if (replyTo) opt.replyTo = replyTo;
  try { MailApp.sendEmail(opt); } catch (e) { console.error('Falha ao enviar para ' + para + ': ' + e); }
}
function email_(titulo, intro, r, botoes) {
  const linhas = [
    ['Status', r.status], ['Veículo', r.veiculo + ' · ' + placa_(r.veiculo)], ['Saída', fmt_(r.inicio)], ['Devolução', fmt_(r.fim)],
    ['Quem vai usar', r.nome], ['E-mail do solicitante', r.email], ['Destino', r.destino], ['Finalidade', r.finalidade],
    ['Centro de custo', r.centro]
  ];
  if (r.por) linhas.push([r.status === 'Recusada' ? 'Recusado por' : 'Aprovado por', r.por]);
  if (r.obs) linhas.push(['Observação do gestor', r.obs]);
  const tabela = linhas.map(l => '<tr><td style="padding:6px 12px 6px 0;color:#5A6774;white-space:nowrap;vertical-align:top">' + esc_(l[0]) +
    '</td><td style="padding:6px 0;color:#15202B;font-weight:600">' + esc_(l[1]) + '</td></tr>').join('');
  const alerta = r.alerta ? '<p style="background:#FAEFD6;color:#8F5E00;padding:10px 12px;border-radius:8px;font-weight:600">' + esc_(r.alerta) + '</p>' : '';
  const btns = (botoes || []).map(b => '<a href="' + b.url + '" style="display:inline-block;background:' + b.cor +
    ';color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;margin:0 8px 8px 0">' + esc_(b.rotulo) + '</a>').join('');
  return '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;color:#15202B">' +
    '<h2 style="margin:0 0 8px">' + esc_(titulo) + '</h2><p style="margin:0 0 14px;color:#5A6774">' + esc_(intro) + '</p>' +
    alerta + '<table style="border-collapse:collapse;font-size:14px;margin-bottom:16px">' + tabela + '</table>' + btns +
    '<p style="color:#93A0AD;font-size:12px;margin-top:18px">Pedido ' + esc_(r.id) + ' · Frota Dellut</p></div>';
}
function logo_() { try { return HtmlService.createHtmlOutputFromFile('Logo').getContent().replace(/[^A-Za-z0-9+\/=]/g, ''); } catch (e) { return ''; } }
function placa_(veiculo) { const v = CONFIG.VEICULOS.find(x => x.nome === veiculo); return v ? v.placa : ''; }

// ----------------------------------------------------------------- utilitários

function agora_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function fmt_(s) { s = String(s || ''); return s.length >= 16 ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) + ' ' + s.slice(11, 16) : s; }
function txt_(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function erro_(m) { return { ok: false, erro: m }; }
function json_(o) { return JSON.stringify(o).replace(/</g, '\\u003c'); }
