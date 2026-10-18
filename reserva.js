// Página de pedido e agenda.
(function () {
  const { pad, parse, add, api, el } = window.Frota;
  const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const RODIZIO = { 1: [1, 2], 2: [3, 4], 3: [5, 6], 4: [7, 8], 5: [9, 0] };
  const JANELAS = [["07:00", "10:00"], ["17:00", "20:00"]];
  const $ = s => document.querySelector(s);

  // Carros fixos: aparecem na tela mesmo se o servidor estiver fora do ar.
  const VEICULOS_PADRAO = [{ nome: "HB20", placa: "TEK2E75" }, { nome: "NIVUS", placa: "UAF2C07" }];
  let CFG = { veiculos: VEICULOS_PADRAO, centros: [], hoje: hojeLocal() };
  let semana = monday(CFG.hoje), reservas = [];

  function hojeLocal() { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function monday(s) { return add(s, -((parse(s).getUTCDay() + 6) % 7)); }
  function fmt(s) { return s.slice(8, 10) + "/" + s.slice(5, 7) + " " + s.slice(11, 16); }
  function finalPlaca(nome) { const v = CFG.veiculos.find(x => x.nome === nome); const m = v && v.placa.match(/(\d)\s*$/); return m ? +m[1] : null; }
  function diaRodizio(nome) { const f = finalPlaca(nome); for (const k in RODIZIO) if (RODIZIO[k].includes(f)) return +k; return null; }
  function rodizio(nome, ini, fim) {
    const f = finalPlaca(nome); if (f === null || !ini || !fim || fim <= ini) return "";
    const hits = [];
    for (let d = ini.slice(0, 10), n = 0; d <= fim.slice(0, 10) && n < 60; d = add(d, 1), n++) {
      const wd = parse(d).getUTCDay();
      if (!RODIZIO[wd] || !RODIZIO[wd].includes(f)) continue;
      for (const [a, b] of JANELAS) {
        if (ini < d + " " + b && d + " " + a < fim) hits.push(DIAS[wd] + " " + d.slice(8, 10) + "/" + d.slice(5, 7) + " das " + a.slice(0, 2) + "h às " + b.slice(0, 2) + "h");
      }
    }
    if (!hits.length) return "";
    return "Rodízio: placa final " + f + " não pode circular no centro expandido de SP " + hits.slice(0, 4).join(", ") + (hits.length > 4 ? " e outros horários" : "") + ".";
  }

  function montaCarros() {
    const cars = $("#cars"); cars.innerHTML = "";
    const sel = $("#veiculo"); sel.innerHTML = "";
    CFG.veiculos.forEach(v => {
      const card = el("div", "car");
      const pl = el("span", "plate"); pl.appendChild(el("span", "", v.placa));
      const dr = diaRodizio(v.nome);
      const prox = el("div", "prox"); prox.dataset.veiculo = v.nome;
      card.append(el("div", "nm", v.nome), pl, el("div", "rz", dr !== null ? "Não Circular: " + DIAS[dr] + "s, 7h–10h e 17h–20h (rodízio)" : ""), prox);
      cars.appendChild(card);
      const o = el("option", "", v.nome + " · " + v.placa); o.value = v.nome; sel.appendChild(o);
    });
    const cc = $("#centro"); cc.innerHTML = "";
    const o0 = el("option", "", "Selecione…"); o0.value = ""; cc.appendChild(o0);
    CFG.centros.forEach(c => { const o = el("option", "", c); o.value = c; cc.appendChild(o); });
  }

  function valoresIniciais() {
    const hora = Math.min(new Date().getHours() + 1, 22);
    $("#di").value = CFG.hoje; $("#hi").value = pad(hora) + ":00";
    $("#df").value = CFG.hoje; $("#hf").value = pad(Math.min(hora + 2, 23)) + ":00";
    $("#di").min = CFG.hoje; $("#df").min = CFG.hoje;
  }

  function dados() {
    return { nome: $("#nome").value, email: $("#email").value, veiculo: $("#veiculo").value,
      di: $("#di").value, hi: $("#hi").value, df: $("#df").value, hf: $("#hf").value,
      destino: $("#destino").value, finalidade: $("#finalidade").value, centro: $("#centro").value };
  }
  function atualizaRodizio() {
    const d = dados();
    const msg = (d.di && d.hi && d.df && d.hf) ? rodizio(d.veiculo, d.di + " " + d.hi, d.df + " " + d.hf) : "";
    $("#rod").textContent = msg ? msg + " Ajuste o horário ou escolha o outro carro." : "";
    $("#rod").hidden = !msg;
  }
  function mensagem(t, tipo) { const m = $("#msg"); m.className = "notice full" + (tipo ? " " + tipo : ""); m.textContent = t || ""; m.hidden = !t; }

  $("#di").addEventListener("change", () => { if (!$("#df").value || $("#df").value < $("#di").value) $("#df").value = $("#di").value; });
  $("#form").addEventListener("input", atualizaRodizio);
  $("#form").addEventListener("change", atualizaRodizio);

  $("#form").addEventListener("submit", async e => {
    e.preventDefault();
    const d = dados();
    if (!d.nome.trim() || !d.email.trim() || !d.destino.trim() || !d.finalidade.trim() || !d.centro || !d.di || !d.hi || !d.df || !d.hf)
      return mensagem("Preencha todos os campos.", "bad");
    if (d.df + " " + d.hf <= d.di + " " + d.hi) return mensagem("A devolução precisa ser depois da saída.", "bad");
    const b = $("#enviar"); b.disabled = true; b.textContent = "Enviando…"; mensagem("");
    try {
      const r = await api("criar", { dados: d });
      if (!r || !r.ok) { mensagem((r && r.erro) || "Não foi possível enviar. Tente de novo.", "bad"); return; }
      mensagem("Pedido enviado. Ele aparece como pendente na agenda, e você recebe um e-mail quando o gestor responder.", "good");
      $("#destino").value = ""; $("#finalidade").value = "";
      semana = monday(d.di); carrega();
    } catch (err) {
      mensagem("Não foi possível enviar agora. Confira sua internet e tente de novo.", "bad");
    } finally {
      b.disabled = false; b.textContent = "Enviar pedido";
    }
  });

  // Próximas reservas aprovadas de cada carro (30 dias), com nome e horário.
  async function carregaProximas() {
    try {
      const r = await api("agenda", { ini: CFG.hoje, fim: add(CFG.hoje, 30) });
      const agora = new Date(); const agoraTxt = CFG.hoje + " " + pad(agora.getHours()) + ":" + pad(agora.getMinutes());
      const lista = ((r && r.reservas) || []).filter(x => x.status === "Aprovada" && x.fim > agoraTxt)
        .sort((a, b) => a.inicio.localeCompare(b.inicio));
      document.querySelectorAll(".prox").forEach(box => {
        box.innerHTML = "";
        const doCarro = lista.filter(x => x.veiculo === box.dataset.veiculo);
        box.appendChild(el("div", "prox-t", doCarro.length ? "Próximas reservas" : "Sem reservas aprovadas nos próximos 30 dias"));
        doCarro.slice(0, 3).forEach(x => {
          const mesmoDia = x.inicio.slice(0, 10) === x.fim.slice(0, 10);
          const quando = mesmoDia ? fmt(x.inicio) + "–" + x.fim.slice(11, 16) : fmt(x.inicio) + " → " + fmt(x.fim);
          const li = el("div", "prox-i"); li.append(el("span", "time", quando), el("b", "", x.nome));
          box.appendChild(li);
        });
        if (doCarro.length > 3) box.appendChild(el("div", "prox-t", "+ " + (doCarro.length - 3) + " na agenda"));
      });
    } catch (err) { /* os cartões continuam sem a lista */ }
  }

  async function carrega() {
    const fim = add(semana, 6);
    $("#wlbl").textContent = (+semana.slice(8, 10)) + " " + MES[+semana.slice(5, 7) - 1] + " – " + (+fim.slice(8, 10)) + " " + MES[+fim.slice(5, 7) - 1] + (semana === monday(CFG.hoje) ? " · esta semana" : "");
    try {
      const r = await api("agenda", { ini: semana, fim: fim });
      reservas = (r && r.reservas) || [];
      desenha();
    } catch (err) {
      const box = $("#semana"); box.innerHTML = ""; box.appendChild(el("p", "free", "Não foi possível carregar a agenda. Recarregue a página."));
    }
  }

  function desenha() {
    const box = $("#semana"); box.innerHTML = "";
    for (let n = 0; n < 7; n++) {
      const d = add(semana, n);
      const row = el("div", "day" + (d === CFG.hoje ? " today" : "") + (d < CFG.hoje ? " past" : ""));
      const dl = el("div", "dl");
      dl.append(el("span", "wd", WD[parse(d).getUTCDay()] + (d === CFG.hoje ? " · hoje" : "")), el("span", "dn", String(+d.slice(8, 10))));
      const list = el("div", "list");
      const doDia = reservas.filter(r => r.inicio < d + " 24:00" && d + " 00:00" < r.fim).sort((a, b) => a.inicio.localeCompare(b.inicio));
      if (!doDia.length) list.appendChild(el("div", "free", "Os dois carros livres"));
      doDia.forEach(r => {
        const c = el("div", "res " + r.status);
        const rt = el("div", "rt");
        const left = el("span", "left");
        const vv = CFG.veiculos.find(x => x.nome === r.veiculo);
        // Selo no formato de placa: placa na faixa azul em cima, modelo embaixo.
        const pl = el("span", "plate sm"); pl.append(el("span", "pb", vv ? vv.placa : ""), el("span", "", r.veiculo));
        const mesmoDia = r.inicio.slice(0, 10) === r.fim.slice(0, 10);
        left.append(pl, el("span", "time", mesmoDia ? r.inicio.slice(11) + " – " + r.fim.slice(11) : fmt(r.inicio) + " → " + fmt(r.fim)));
        rt.append(left, el("span", "pill " + r.status, r.status === "Aprovada" ? "reservado" : "pendente"));
        const meta = el("div", "meta"); meta.append(el("b", "", r.nome), document.createTextNode(" → " + r.destino));
        c.append(rt, meta); list.appendChild(c);
      });
      row.append(dl, list); box.appendChild(row);
    }
  }

  $("#prev").addEventListener("click", () => { semana = add(semana, -7); carrega(); });
  $("#next").addEventListener("click", () => { semana = add(semana, 7); carrega(); });

  (async function inicia() {
    try {
      const c = await api("config");
      if (c && c.ok) { CFG = { veiculos: c.veiculos, centros: c.centros, hoje: c.hoje }; semana = monday(CFG.hoje); }
      montaCarros(); valoresIniciais(); atualizaRodizio(); carregaProximas();
      $("#enviar").disabled = false;
    } catch (err) {
      montaCarros(); valoresIniciais(); atualizaRodizio();
      mensagem("O sistema de reservas está fora do ar no momento. Para reservar, fale com o financeiro (financeiro@dellut.com.br).", "bad");
    }
    carrega();
  })();
})();
