// ============================================================
//  print.js — Stampa scontrino
// ============================================================

window.printReceipt = function(order, payments) {
  const active = (order.items || []).filter(i => i.status !== 'cancelled');
  const gross  = active.reduce((s, i) => s + i.unit_price_snapshot * i.quantity, 0);
  let   net    = gross;
  if (order.discount_type === 'percent') net = gross * (1 - (order.discount_value||0) / 100);
  if (order.discount_type === 'flat')    net = Math.max(gross - (order.discount_value||0), 0);
  net = Math.round(net * 100) / 100;

  const paymentLine = (payments || []).map(p => {
    const label = { cash: 'Contanti', card: 'Carta', voucher: 'Voucher' }[p.method] || p.method;
    return `<tr><td>${label}</td><td style="text-align:right">€ ${Number(p.amount).toFixed(2)}</td></tr>`;
  }).join('');

  const itemsHtml = active.map(i =>
    `<tr>
      <td>${i.product_name_snapshot}${ i.notes ? '<br><small style="color:#888">↳ '+i.notes+'</small>' : '' }</td>
      <td style="text-align:center">${i.quantity}</td>
      <td style="text-align:right">€ ${(i.unit_price_snapshot * i.quantity).toFixed(2)}</td>
    </tr>`
  ).join('');

  const discountRow = order.discount_type
    ? `<tr><td colspan="2">Sconto (${order.discount_type === 'percent' ? order.discount_value+'%' : '€ '+order.discount_value})</td><td style="text-align:right;color:#e74c3c">€ -${(gross-net).toFixed(2)}</td></tr>`
    : '';

  const now = new Date();
  const dateStr = now.toLocaleDateString('it-IT') + ' ' + now.toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' });
  const tableLabel = order.table_id ? `Tavolo #${order.table_id}` : 'Banco';

  const receiptHtml = `
    <div style="font-family:monospace;max-width:320px;margin:0 auto;padding:16px">
      <h2 style="text-align:center;margin-bottom:4px">Bar Gestionale</h2>
      <p style="text-align:center;font-size:12px;color:#888">${dateStr} — ${tableLabel} — Comanda #${order.id}</p>
      <hr style="margin:8px 0">
      <table style="width:100%;font-size:13px;border-collapse:collapse">
        <thead><tr><th style="text-align:left">Articolo</th><th>Q.</th><th style="text-align:right">Totale</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <hr style="margin:8px 0">
      <table style="width:100%;font-size:13px">
        ${discountRow}
        <tr style="font-weight:bold"><td colspan="2">TOTALE</td><td style="text-align:right">€ ${net.toFixed(2)}</td></tr>
      </table>
      <hr style="margin:8px 0">
      <table style="width:100%;font-size:12px">${paymentLine}</table>
      <p style="text-align:center;margin-top:12px;font-size:11px;color:#888">Grazie e arrivederci!</p>
    </div>
  `;

  const printDiv = document.getElementById('receipt-print');
  if (printDiv) {
    printDiv.innerHTML = receiptHtml;
    printDiv.style.display = 'block';
  }
  window.print();
  if (printDiv) printDiv.style.display = 'none';
};
