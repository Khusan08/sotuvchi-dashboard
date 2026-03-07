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

  const qrData = JSON.stringify(`ID:${data.order_number}\n${data.customer_name}\n${data.customer_phone}\n${data.total_amount}`);

  const itemsRows = data.items
    .map(
      (item) =>
        `<tr>
          <td style="text-align:left;padding:2px 0;font-size:11px;">${item.product_name}</td>
          <td style="text-align:center;padding:2px 0;font-size:11px;">${item.quantity}</td>
          <td style="text-align:right;padding:2px 0;font-size:11px;">${(item.quantity * item.price).toLocaleString()}</td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Chek #${data.order_number}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
@page{size:80mm auto;margin:0;}
body{font-family:'Courier New',monospace;font-size:12px;width:72mm;margin:0 auto;padding:4mm 2mm;color:#000;}
.header{text-align:center;font-size:18px;font-weight:bold;letter-spacing:2px;padding-bottom:4px;}
.sub{text-align:center;font-size:10px;color:#555;margin-bottom:6px;}
hr.d{border:none;border-top:1px dashed #000;margin:5px 0;}
.r{display:flex;justify-content:space-between;padding:1px 0;font-size:11px;}
.r .l{color:#333;}.r .v{font-weight:bold;text-align:right;max-width:58%;word-break:break-word;}
table{width:100%;border-collapse:collapse;}
table th{font-size:10px;border-bottom:1px solid #000;padding:2px 0;text-align:left;}
table th:nth-child(2){text-align:center;}table th:nth-child(3){text-align:right;}
.big{font-size:14px;font-weight:bold;}
.qr{text-align:center;margin:6px 0 2px;}
.ft{text-align:center;font-size:9px;color:#888;margin-top:4px;}
@media print{body{width:72mm;}@page{margin:0;}}
</style>
</head>
<body>
<div class="header">DARAJA</div>
<div class="sub">Buyurtma cheki</div>
<hr class="d">
<div class="r"><span class="l">Chek №:</span><span class="v">${data.order_number}</span></div>
<div class="r"><span class="l">Sana:</span><span class="v">${dateStr}</span></div>
<div class="r"><span class="l">Mijoz:</span><span class="v">${data.customer_name}</span></div>
<div class="r"><span class="l">Tel:</span><span class="v">${data.customer_phone || "-"}</span></div>
<div class="r"><span class="l">Manzil:</span><span class="v">${address}</span></div>
<hr class="d">
<table><thead><tr><th>Mahsulot</th><th>Soni</th><th>Narxi</th></tr></thead><tbody>${itemsRows}</tbody></table>
<hr class="d">
<div class="r"><span class="l">Jami:</span><span class="v big">${data.total_amount.toLocaleString()} so'm</span></div>
<div class="r"><span class="l">Avans:</span><span class="v" style="color:#16a34a">${(data.advance_payment || 0).toLocaleString()} so'm</span></div>
<div class="r"><span class="l">Qoldiq:</span><span class="v" style="color:#dc2626">${remaining.toLocaleString()} so'm</span></div>
${data.notes ? `<hr class="d"><div style="font-size:10px;"><b>Izoh:</b> ${data.notes}</div>` : ""}
<div class="qr"><canvas id="qr" width="100" height="100"></canvas></div>
<hr class="d">
<div class="ft">Xaridingiz uchun rahmat!</div>
<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"><\/script>
<script>
(function(){
  try{
    var q=qrcode(0,'M');q.addData(${qrData});q.make();
    var c=document.getElementById('qr'),s=3,m=4,mc=q.getModuleCount(),sz=mc*s+m*2;
    c.width=sz;c.height=sz;var ctx=c.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,sz,sz);ctx.fillStyle='#000';
    for(var r=0;r<mc;r++)for(var cl=0;cl<mc;cl++)if(q.isDark(r,cl))ctx.fillRect(cl*s+m,r*s+m,s,s);
  }catch(e){console.log('QR:',e);}
  setTimeout(function(){window.print();},600);
})();
<\/script>
</body>
</html>`;

  const w = window.open("", "receipt_print", "width=350,height=600,scrollbars=yes");
  if (!w) {
    // Fallback: try without name
    const w2 = window.open("", "_blank");
    if (!w2) {
      alert("Brauzer popup ni bloklayapti. Iltimos, sayt sozlamalarida popup ga ruxsat bering.");
      return;
    }
    w2.document.open();
    w2.document.write(html);
    w2.document.close();
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
