import { useRef } from "react";
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
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const remaining = order.total_amount - (order.advance_payment || 0);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Chek #${order.order_number}</title>
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
              background: white;
              color: black;
            }
            .receipt {
              width: 100%;
            }
            .header {
              text-align: center;
              border-bottom: 1px dashed #000;
              padding-bottom: 4px;
              margin-bottom: 6px;
            }
            .header h1 {
              font-size: 14px;
              font-weight: bold;
            }
            .order-number {
              font-size: 16px;
              font-weight: bold;
              margin: 4px 0;
            }
            .date {
              font-size: 11px;
            }
            .section {
              margin-bottom: 6px;
            }
            .row {
              display: flex;
              justify-content: space-between;
              margin: 2px 0;
              font-size: 11px;
            }
            .row .label {
              font-weight: bold;
            }
            .divider {
              border-top: 1px dashed #000;
              margin: 6px 0;
            }
            .total-row {
              font-size: 13px;
              font-weight: bold;
            }
            .remaining {
              font-size: 14px;
              font-weight: bold;
              text-align: center;
              border: 1px solid #000;
              padding: 4px;
              margin-top: 6px;
            }
            @media print {
              body {
                width: 76mm;
              }
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
                <span>${order.customer_name}</span>
              </div>
              ${order.customer_phone ? `
                <div class="row">
                  <span class="label">Tel 1:</span>
                  <span>${order.customer_phone}</span>
                </div>
              ` : ''}
              ${order.customer_phone2 ? `
                <div class="row">
                  <span class="label">Tel 2:</span>
                  <span>${order.customer_phone2}</span>
                </div>
              ` : ''}
            </div>
            
            ${order.region || order.district ? `
              <div class="section">
                ${order.region ? `
                  <div class="row">
                    <span class="label">Viloyat:</span>
                    <span>${order.region}</span>
                  </div>
                ` : ''}
                ${order.district ? `
                  <div class="row">
                    <span class="label">Tuman:</span>
                    <span>${order.district}</span>
                  </div>
                ` : ''}
              </div>
            ` : ''}
            
            <div class="divider"></div>
            
            <div class="section">
              <div class="row total-row">
                <span>Jami:</span>
                <span>${order.total_amount.toLocaleString()} so'm</span>
              </div>
              <div class="row">
                <span class="label">Oldindan:</span>
                <span>${(order.advance_payment || 0).toLocaleString()} so'm</span>
              </div>
            </div>
            
            <div class="remaining">
              Qoldiq: ${remaining.toLocaleString()} so'm
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <Button variant="outline" size="sm" onClick={handlePrint}>
      <Printer className="h-4 w-4 mr-1" />
      Chek
    </Button>
  );
};
