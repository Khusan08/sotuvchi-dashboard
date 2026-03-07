import { QRCodeCanvas } from "qrcode.react";

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
  
  // Products list
  const productsList = data.items
    .map((item) => `${item.product_name} x${item.quantity}`)
    .join(", ");

  // QR code data - order info
  const qrData = `ID:${data.order_number}\n${data.customer_name}\n${data.customer_phone}\n${data.total_amount}`;

  const printWindow = window.open("", "_blank", "width=400,height=600");
  if (!printWindow) {
    alert("Popup bloklangan. Iltimos, popup'ga ruxsat bering.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Chek #${data.order_number}</title>
      <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"><\/script>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        @page {
          size: 80mm auto;
          margin: 2mm;
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          width: 76mm;
          padding: 2mm;
          color: #000;
        }
        .center {
          text-align: center;
        }
        .bold {
          font-weight: bold;
        }
        .title {
          font-size: 16px;
          font-weight: bold;
          text-align: center;
          margin-bottom: 4px;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }
        .row .label {
          font-weight: normal;
        }
        .row .value {
          font-weight: bold;
          text-align: right;
          max-width: 55%;
        }
        .qr-container {
          text-align: center;
          margin: 8px 0 4px;
        }
        .qr-container canvas {
          width: 100px !important;
          height: 100px !important;
        }
        @media print {
          body {
            width: 76mm;
          }
        }
      </style>
    </head>
    <body>
      <div class="title">DARAJA</div>
      <div class="divider"></div>
      
      <div class="row">
        <span class="label">ID:</span>
        <span class="value">${data.order_number}</span>
      </div>
      <div class="row">
        <span class="label">Ism:</span>
        <span class="value">${data.customer_name}</span>
      </div>
      <div class="row">
        <span class="label">Phone:</span>
        <span class="value">${data.customer_phone || '-'}</span>
      </div>
      <div class="row">
        <span class="label">Manzil:</span>
        <span class="value">${address}</span>
      </div>
      <div class="row">
        <span class="label">Sana:</span>
        <span class="value">${dateStr}</span>
      </div>
      <div class="row">
        <span class="label">Kitob narxi:</span>
        <span class="value">${data.total_amount.toLocaleString()}</span>
      </div>
      <div class="row">
        <span class="label">Avans:</span>
        <span class="value">${(data.advance_payment || 0).toLocaleString()}</span>
      </div>
      <div class="row">
        <span class="label">To'lov:</span>
        <span class="value">${remaining.toLocaleString()}</span>
      </div>

      <div class="qr-container">
        <canvas id="qrcode"></canvas>
      </div>

      <div class="divider"></div>
      
      <script>
        try {
          var qr = qrcode(0, 'M');
          qr.addData(${JSON.stringify(qrData)});
          qr.make();
          var canvas = document.getElementById('qrcode');
          var cellSize = 3;
          var margin = 4;
          var moduleCount = qr.getModuleCount();
          var size = moduleCount * cellSize + margin * 2;
          canvas.width = size;
          canvas.height = size;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);
          ctx.fillStyle = '#000000';
          for (var row = 0; row < moduleCount; row++) {
            for (var col = 0; col < moduleCount; col++) {
              if (qr.isDark(row, col)) {
                ctx.fillRect(col * cellSize + margin, row * cellSize + margin, cellSize, cellSize);
              }
            }
          }
        } catch(e) {
          console.error('QR error:', e);
        }
        
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      <\/script>
    </body>
    </html>
  `);
  
  printWindow.document.close();
}
