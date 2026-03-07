interface PrintReceiptData {
  order_number: number;
  customer_name: string;
  customer_phone: string;
  region?: string;
  district?: string;
  order_date: string;
  items: Array<{ product_name: string; quantity: number; price: number }>;
  total_amount: number;
  advance_payment: number;
  notes?: string;
}

export function printReceipt(data: PrintReceiptData) {
  const remaining = data.total_amount - (data.advance_payment || 0);
  const address = [data.region, data.district].filter(Boolean).join(", ") || "-";
  const dateStr = new Date(data.order_date).toLocaleDateString("uz-UZ");

  const qrData = `ID:${data.order_number}\n${data.customer_name}\n${data.customer_phone}\n${data.total_amount}`;

  const itemsRows = data.items
    .map(
      (item) =>
        `<tr>
          <td style="text-align:left;padding:1px 0;font-size:11px;">${item.product_name}</td>
          <td style="text-align:center;padding:1px 0;font-size:11px;">${item.quantity}</td>
          <td style="text-align:right;padding:1px 0;font-size:11px;">${(item.quantity * item.price).toLocaleString()}</td>
        </tr>`
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Chek #${data.order_number}</title>
      <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"><\/script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: 80mm auto; margin: 0; }
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          width: 72mm;
          margin: 0 auto;
          padding: 4mm 2mm;
          color: #000;
        }
        .header {
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          letter-spacing: 2px;
          padding-bottom: 4px;
        }
        .sub-header {
          text-align: center;
          font-size: 10px;
          color: #555;
          margin-bottom: 6px;
        }
        .dashed {
          border: none;
          border-top: 1px dashed #000;
          margin: 5px 0;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 1px 0;
          font-size: 11px;
        }
        .info-row .lbl { color: #333; }
        .info-row .val { font-weight: bold; text-align: right; max-width: 58%; word-break: break-word; }
        table { width: 100%; border-collapse: collapse; }
        table th {
          font-size: 10px;
          border-bottom: 1px solid #000;
          padding: 2px 0;
          text-align: left;
        }
        table th:nth-child(2) { text-align: center; }
        table th:nth-child(3) { text-align: right; }
        .total-section .info-row { font-size: 12px; }
        .total-section .big { font-size: 14px; font-weight: bold; }
        .qr-box { text-align: center; margin: 6px 0 2px; }
        .footer { text-align: center; font-size: 9px; color: #888; margin-top: 4px; }
        @media print {
          body { width: 72mm; }
          @page { margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">DARAJA</div>
      <div class="sub-header">Buyurtma cheki</div>
      <hr class="dashed">

      <div class="info-row"><span class="lbl">Chek №:</span><span class="val">${data.order_number}</span></div>
      <div class="info-row"><span class="lbl">Sana:</span><span class="val">${dateStr}</span></div>
      <div class="info-row"><span class="lbl">Mijoz:</span><span class="val">${data.customer_name}</span></div>
      <div class="info-row"><span class="lbl">Tel:</span><span class="val">${data.customer_phone || "-"}</span></div>
      <div class="info-row"><span class="lbl">Manzil:</span><span class="val">${address}</span></div>
      
      <hr class="dashed">
      <table>
        <thead><tr><th>Mahsulot</th><th>Soni</th><th>Narxi</th></tr></thead>
        <tbody>${itemsRows}</tbody>
      </table>
      <hr class="dashed">

      <div class="total-section">
        <div class="info-row"><span class="lbl">Jami:</span><span class="val big">${data.total_amount.toLocaleString()} so'm</span></div>
        <div class="info-row"><span class="lbl">Avans:</span><span class="val" style="color:#16a34a">${(data.advance_payment || 0).toLocaleString()} so'm</span></div>
        <div class="info-row"><span class="lbl">Qoldiq:</span><span class="val" style="color:#dc2626">${remaining.toLocaleString()} so'm</span></div>
      </div>

      ${data.notes ? `<hr class="dashed"><div style="font-size:10px;"><b>Izoh:</b> ${data.notes}</div>` : ""}

      <div class="qr-box"><canvas id="qr"></canvas></div>
      <hr class="dashed">
      <div class="footer">Xaridingiz uchun rahmat!</div>

      <script>
        try {
          var q = qrcode(0, 'M');
          q.addData(${JSON.stringify(qrData)});
          q.make();
          var c = document.getElementById('qr');
          var s = 3, m = 4, mc = q.getModuleCount(), sz = mc * s + m * 2;
          c.width = sz; c.height = sz;
          var ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, sz, sz);
          ctx.fillStyle = '#000';
          for (var r = 0; r < mc; r++)
            for (var cl = 0; cl < mc; cl++)
              if (q.isDark(r, cl))
                ctx.fillRect(cl * s + m, r * s + m, s, s);
        } catch(e) {}
        window.onload = function() {
          setTimeout(function() { window.print(); }, 500);
        };
      <\/script>
    </body>
    </html>
  `;

  // Use iframe to avoid popup blockers
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    // Fallback to window.open
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) {
      alert("Popup bloklangan. Iltimos, popup'ga ruxsat bering.");
      return;
    }
    w.document.write(html);
    w.document.close();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for content + QR to render, then print
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      // Clean up after printing
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
    }, 800);
  };
}
