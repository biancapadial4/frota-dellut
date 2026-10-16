// Funções usadas pelas duas páginas.
(function () {
  const pad = n => String(n).padStart(2, "0");
  const parse = ymd => { const p = ymd.split("-").map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); };
  const ymd = d => d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  const add = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };

  // Chama a API do Apps Script. O corpo vai como texto simples para o navegador não bloquear a chamada.
  async function api(acao, dados) {
    const resp = await fetch(window.FROTA_API, {
      method: "POST",
      body: JSON.stringify(Object.assign({ acao: acao }, dados || {})),
      redirect: "follow"
    });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    return resp.json();
  }

  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  window.Frota = { pad, parse, ymd, add, api, el };
})();
