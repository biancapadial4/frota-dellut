// Página que quem pediu abre pelo botão "Cancelar reserva" do e-mail.
// Nada é cancelado só por abrir o link: é preciso clicar e confirmar.
(function () {
  const { api, el } = window.Frota;
  const box = document.getElementById("conteudo");
  const p = new URLSearchParams(location.search);
  const id = p.get("id"), c = p.get("c");
  const aviso = (txt, tipo) => el("div", "notice " + tipo, txt);

  function mostra(r) {
    box.innerHTML = "";
    const painel = el("div", "panel");
    const dl = el("dl", "dados");
    [["Status", r.status], ["Veículo", r.veiculo], ["Saída", r.inicio], ["Devolução", r.fim],
      ["Solicitante", r.solicitante || r.nome], ["Motorista", r.nome], ["Destino", r.destino], ["Centro de custo", r.centro]]
      .forEach(([k, v]) => dl.append(el("dt", "", k), el("dd", "", v)));
    painel.appendChild(dl);
    box.appendChild(painel);

    if (r.status !== "Pendente" && r.status !== "Aprovada") {
      box.appendChild(aviso('Esta reserva já está com status "' + r.status + '". Nada mais precisa ser feito.', "good"));
      return;
    }
    const acao = el("div", "panel");
    acao.appendChild(el("p", "sub", "Se você não vai mais usar o carro, cancele para liberar o horário para outra pessoa."));
    const lbl = el("label", "", "Motivo (opcional)");
    const obs = el("textarea"); obs.id = "obs"; obs.maxLength = 300; lbl.appendChild(obs);
    const row = el("div", "row");
    const bC = el("button", "btn bad", "Cancelar reserva"); bC.type = "button";
    row.appendChild(bC);
    const msg = el("div"); msg.hidden = true;
    acao.append(lbl, row, msg);
    box.appendChild(acao);

    let confirmando = false;
    bC.addEventListener("click", async () => {
      if (!confirmando) {
        confirmando = true;
        bC.textContent = "Sim, cancelar esta reserva";
        const voltar = el("button", "btn", "Não, manter"); voltar.type = "button";
        voltar.addEventListener("click", () => { confirmando = false; bC.textContent = "Cancelar reserva"; voltar.remove(); });
        row.appendChild(voltar);
        return;
      }
      bC.disabled = true; msg.hidden = true;
      try {
        const res = await api("cancelar", { id: id, c: c, obs: obs.value });
        if (res && res.ok) {
          acao.replaceChildren(aviso("Reserva cancelada. O horário já está livre na agenda e o financeiro foi avisado por e-mail.", "good"));
        } else {
          bC.disabled = false;
          msg.className = "notice bad"; msg.textContent = (res && res.erro) || "Não foi possível cancelar. Tente de novo."; msg.hidden = false;
        }
      } catch (err) {
        bC.disabled = false;
        msg.className = "notice bad"; msg.textContent = "Não foi possível cancelar agora. Tente de novo."; msg.hidden = false;
      }
    });
  }

  (async function () {
    if (!id || !c) { box.replaceChildren(aviso("Este link não é válido. Use o botão do e-mail da reserva.", "bad")); return; }
    try {
      const r = await api("reserva_c", { id: id, c: c });
      if (r && r.ok) mostra(r.reserva);
      else box.replaceChildren(aviso((r && r.erro) || "Este link não é válido ou a reserva não existe mais.", "bad"));
    } catch (err) {
      box.replaceChildren(aviso("Não foi possível carregar a reserva. Recarregue a página.", "bad"));
    }
  })();
})();
