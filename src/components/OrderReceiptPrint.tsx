import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { format } from "date-fns";

interface OrderReceiptPrintProps {
  order: {
    order_number: number;
    customer_name: string;
    customer_phone?: string | null;
    customer_phone2?: string | null;
    region?: string | null;
    district?: string | null;
    total_amount: number;
    advance_payment?: number | null;
    order_date: string;
    items?: Array<{ product_name: string; quantity: number; price: number }>;
  };
}

export const OrderReceiptPrint = ({ order }: OrderReceiptPrintProps) => {

  const handlePrint = () => {
    const remaining = order.total_amount - (order.advance_payment || 0);

    // Create iframe for printing (better for Mac + thermal printers)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.left = '-9999px';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Chek #${order.order_number}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            @page {
              size: 80mm auto;
              margin: 0;
            }
            @media print {
              html, body {
                width: 80mm;
                margin: 0;
                padding: 0;
              }
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              width: 80mm;
              max-width: 80mm;
              padding: 3mm;
              background: white;
              color: black;
              line-height: 1.3;
            }
            .receipt {
              width: 100%;
            }
            .header {
              text-align: center;
              border-bottom: 1px dashed #000;
              padding-bottom: 5px;
              margin-bottom: 8px;
            }
            .header h1 {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 3px;
            }
            .order-number {
              font-size: 18px;
              font-weight: bold;
              margin: 5px 0;
            }
            .date {
              font-size: 11px;
            }
            .section {
              margin-bottom: 8px;
            }
            .row {
              display: block;
              margin: 3px 0;
              font-size: 11px;
              overflow: hidden;
            }
            .row::after {
              content: "";
              display: table;
              clear: both;
            }
            .row .label {
              font-weight: bold;
              float: left;
            }
            .row .value {
              float: right;
              text-align: right;
            }
            .divider {
              border-top: 1px dashed #000;
              margin: 8px 0;
            }
            .total-row {
              font-size: 14px;
              font-weight: bold;
            }
            .remaining {
              font-size: 16px;
              font-weight: bold;
              text-align: center;
              border: 2px solid #000;
              padding: 6px;
              margin-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>ZAKAZ CHEKI</h1>
              <div class="order-number">#${order.order_number}</div>
              <div class="date">${format(new Date(order.order_date), "dd.MM.yyyy")}</div>
            </div>
            
            <div class="section">
              <div class="row">
                <span class="label">Mijoz:</span>
                <span class="value">${order.customer_name}</span>
              </div>
              ${order.customer_phone ? `
                <div class="row">
                  <span class="label">Tel 1:</span>
                  <span class="value">${order.customer_phone}</span>
                </div>
              ` : ''}
              ${order.customer_phone2 ? `
                <div class="row">
                  <span class="label">Tel 2:</span>
                  <span class="value">${order.customer_phone2}</span>
                </div>
              ` : ''}
            </div>
            
            ${order.region || order.district ? `
              <div class="section">
                ${order.region ? `
                  <div class="row">
                    <span class="label">Viloyat:</span>
                    <span class="value">${order.region}</span>
                  </div>
                ` : ''}
                ${order.district ? `
                  <div class="row">
                    <span class="label">Tuman:</span>
                    <span class="value">${order.district}</span>
                  </div>
                ` : ''}
              </div>
            ` : ''}
            
            <div class="divider"></div>
            
            <div class="section">
              <div class="row total-row">
                <span class="label">Jami:</span>
                <span class="value">${order.total_amount.toLocaleString()} so'm</span>
              </div>
              <div class="row">
                <span class="label">Oldindan:</span>
                <span class="value">${(order.advance_payment || 0).toLocaleString()} so'm</span>
              </div>
            </div>
            
            <div class="remaining">
              Qoldiq: ${remaining.toLocaleString()} so'm
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    // Wait for content to load then print
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Print error:', e);
        }
        // Remove iframe after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 100);
    };

    // Fallback for browsers that don't trigger onload
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error('Print fallback error:', e);
      }
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 500);
  };

  return (
    <Button variant="outline" size="sm" onClick={handlePrint}>
      <Printer className="h-4 w-4 mr-1" />
      Chek
    </Button>
  );
};
