// Página que o gestor abre pelo botão do e-mail. Nada é decidido só por abrir o link:
// a decisão acontece no clique, para que verificadores de link do e-mail não aprovem sozinhos.
(function () {
  const { api, el } = window.Frota;
  const box = document.getElementById("conteudo");
  const p = new URLSearchParams(location.search);
  const acao = ["recusar", "cancelar"].indexOf(p.get("acao")) >= 0 ? p.get("acao") : "aprovar";
  const id = p.get("id"), t = p.get("t");
  const aviso = (txt, tipo) => el("div", "notice " + tipo, txt);

  let APROVADORES = [];

  function mostra(r) {
    box.innerHTML = "";
    const painel = el("div", "panel");
    const dl = el("dl", "dados");
    [["Status", r.status], ["Veículo", r.veiculo], ["Saída", r.inicio], ["Devolução", r.fim], ["Solicitante", r.solicitante || r.nome], ["Motorista", r.nome],
      ["E-mail", r.email], ["Destino", r.destino], ["Finalidade", r.finalidade], ["Centro de custo", r.centro]]
      .concat(r.por ? [[r.status === "Recusada" ? "Recusado por" : r.status === "Cancelada" ? "Cancelado por" : "Aprovado por", r.por]] : [])
      .forEach(([k, v]) => dl.append(el("dt", "", k), el("dd", "", v)));
    painel.appendChild(dl);
    if (r.alerta) painel.appendChild(aviso(r.alerta, "warn"));
    if (r.solicitante) painel.appendChild(aviso("A CNH do motorista está anexada ao e-mail do pedido.", ""));
    box.appendChild(painel);

    if (r.status === "Aprovada" || (r.status === "Pendente" && acao === "cancelar")) { mostraCancelar(r.status); return; }
    if (r.status !== "Pendente") {
      box.appendChild(aviso('Este pedido já está com status "' + r.status + '". Nada mais precisa ser feito.', "good"));
      return;
    }
    document.getElementById("titulo").textContent = acao === "recusar" ? "Recusar reserva?" : "Aprovar reserva?";
    const acaoBox = el("div", "panel");
    const lblPor = el("label", "", "Quem está aprovando");
    const por = el("select"); por.id = "por"; por.required = true;
    const op0 = el("option", "", "Selecione seu nome…"); op0.value = ""; por.appendChild(op0);
    APROVADORES.forEach(n => { const o = el("option", "", n); o.value = n; por.appendChild(o); });
    lblPor.appendChild(por);
    const lbl = el("label", "", acao === "recusar" ? "Motivo da recusa (opcional)" : "Observação para quem pediu (opcional)");
    const obs = el("textarea"); obs.id = "obs"; obs.maxLength = 300; lbl.appendChild(obs);
    const row = el("div", "row");
    const bA = el("button", "btn ok", "Aprovar reserva"); bA.type = "button";
    const bR = el("button", "btn bad", "Recusar reserva"); bR.type = "button";
    if (acao === "recusar") row.append(bR, bA); else row.append(bA, bR);
    const msg = el("div"); msg.hidden = true;
    acaoBox.append(lblPor, lbl, row, msg);
    box.appendChild(acaoBox);

    async function decide(tipo) {
      if (!por.value) {
        msg.className = "notice bad"; msg.textContent = "Escolha quem está aprovando antes de continuar."; msg.hidden = false;
        por.focus(); return;
      }
      bA.disabled = bR.disabled = true; msg.hidden = true;
      try {
        const res = await api("decidir", { id: id, t: t, tipo: tipo, obs: obs.value, por: por.value });
        if (res && res.ok) {
          acaoBox.replaceChildren(aviso(res.status === "Aprovada"
            ? "Reserva aprovada por " + por.value + ". Quem pediu e o financeiro já foram avisados por e-mail."
            : "Reserva recusada por " + por.value + ". Quem pediu e o financeiro já foram avisados por e-mail.", "good"));
        } else {
          bA.disabled = bR.disabled = false;
          msg.className = "notice bad"; msg.textContent = (res && res.erro) || "Não foi possível salvar. Tente de novo."; msg.hidden = false;
        }
      } catch (err) {
        bA.disabled = bR.disabled = false;
        msg.className = "notice bad"; msg.textContent = "Não foi possível salvar agora. Tente de novo."; msg.hidden = false;
      }
    }
    bA.addEventListener("click", () => decide("aprovar"));
    bR.addEventListener("click", () => decide("recusar"));
  }

  // Reserva já aprovada: o gestor pode cancelar (ex.: a pessoa desistiu e avisou).
  function mostraCancelar(status) {
    document.getElementById("titulo").textContent = status === "Aprovada" ? "Reserva aprovada" : "Cancelar pedido?";
    const caixa = el("div", "panel");
    caixa.appendChild(el("p", "sub", "Se quem pediu desistiu do carro, cancele aqui para liberar o horário."));
    const lblPor = el("label", "", "Quem está cancelando");
    const por = el("select"); por.id = "por";
    const op0 = el("option", "", "Selecione seu nome…"); op0.value = ""; por.appendChild(op0);
    APROVADORES.forEach(n => { const o = el("option", "", n); o.value = n; por.appendChild(o); });
    lblPor.appendChild(por);
    const lbl = el("label", "", "Motivo (opcional)");
    const obs = el("textarea"); obs.id = "obs"; obs.maxLength = 300; lbl.appendChild(obs);
    const row = el("div", "row");
    const bC = el("button", "btn bad", "Cancelar reserva"); bC.type = "button";
    row.appendChild(bC);
    const msg = el("div"); msg.hidden = true;
    caixa.append(lblPor, lbl, row, msg);
    box.appendChild(caixa);
    let confirmando = false;
    bC.addEventListener("click", async () => {
      if (!por.value) { msg.className = "notice bad"; msg.textContent = "Escolha quem está cancelando antes de continuar."; msg.hidden = false; por.focus(); return; }
      if (!confirmando) {
        confirmando = true; msg.hidden = true;
        bC.textContent = "Sim, cancelar esta reserva";
        const voltar = el("button", "btn", "Não, manter"); voltar.type = "button";
        voltar.addEventListener("click", () => { confirmando = false; bC.textContent = "Cancelar reserva"; voltar.remove(); });
        row.appendChild(voltar);
        return;
      }
      bC.disabled = true; msg.hidden = true;
      try {
        const res = await api("cancelar_gestor", { id: id, t: t, por: por.value, obs: obs.value });
        if (res && res.ok) caixa.replaceChildren(aviso("Reserva cancelada por " + por.value + ". Quem pediu e o financeiro foram avisados por e-mail.", "good"));
        else { bC.disabled = false; msg.className = "notice bad"; msg.textContent = (res && res.erro) || "Não foi possível cancelar. Tente de novo."; msg.hidden = false; }
      } catch (err) {
        bC.disabled = false; msg.className = "notice bad"; msg.textContent = "Não foi possível cancelar agora. Tente de novo."; msg.hidden = false;
      }
    });
  }

  (async function () {
    if (!id || !t) { box.replaceChildren(aviso("Este link não é válido. Use o botão do e-mail do pedido.", "bad")); return; }
    try {
      const [r, cfg] = await Promise.all([api("reserva", { id: id, t: t }), api("config").catch(() => null)]);
      APROVADORES = (cfg && cfg.aprovadores) || ["Bianca", "Marco", "Ana Claudia"];
      if (r && r.ok) mostra(r.reserva);
      else box.replaceChildren(aviso((r && r.erro) || "Este link não é válido ou o pedido não existe mais.", "bad"));
    } catch (err) {
      box.replaceChildren(aviso("Não foi possível carregar o pedido. Recarregue a página.", "bad"));
    }
  })();
})();
