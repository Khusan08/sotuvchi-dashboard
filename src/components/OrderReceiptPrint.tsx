import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const remaining = order.total_amount - (order.advance_payment || 0);

  const handlePrint = () => {
    setPreviewOpen(true);
  };

  const executePrint = () => {
    const printArea = document.getElementById(`receipt-${order.order_number}`);
    if (!printArea) return;

    const printContent = printArea.innerHTML;
    
    const printWindow = window.open('', '', 'width=300,height=600');
    if (!printWindow) {
      alert("Popup bloklangan. Iltimos popup ruxsat bering.");
      return;
    }

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
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              width: 80mm;
              padding: 3mm;
              background: white;
              color: black;
            }
            .receipt-content {
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
              display: flex;
              justify-content: space-between;
              margin: 3px 0;
              font-size: 11px;
            }
            .label {
              font-weight: bold;
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
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handlePrint}>
        <Printer className="h-4 w-4 mr-1" />
        Chek
      </Button>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Chek #{order.order_number}</DialogTitle>
          </DialogHeader>
          
          {/* Receipt Preview */}
          <div 
            id={`receipt-${order.order_number}`}
            className="bg-white text-black p-4 font-mono text-sm border rounded"
            style={{ width: '100%', maxWidth: '300px', margin: '0 auto' }}
          >
            <div className="receipt-content">
              <div className="header text-center border-b border-dashed border-black pb-2 mb-3">
                <h1 className="text-sm font-bold">ZAKAZ CHEKI</h1>
                <div className="order-number text-lg font-bold my-1">#{order.order_number}</div>
                <div className="date text-xs">{format(new Date(order.order_date), "dd.MM.yyyy")}</div>
              </div>
              
              <div className="section mb-3 text-xs">
                <div className="row flex justify-between my-1">
                  <span className="label font-bold">Mijoz:</span>
                  <span>{order.customer_name}</span>
                </div>
                {order.customer_phone && (
                  <div className="row flex justify-between my-1">
                    <span className="label font-bold">Tel 1:</span>
                    <span>{order.customer_phone}</span>
                  </div>
                )}
                {order.customer_phone2 && (
                  <div className="row flex justify-between my-1">
                    <span className="label font-bold">Tel 2:</span>
                    <span>{order.customer_phone2}</span>
                  </div>
                )}
              </div>
              
              {(order.region || order.district) && (
                <div className="section mb-3 text-xs">
                  {order.region && (
                    <div className="row flex justify-between my-1">
                      <span className="label font-bold">Viloyat:</span>
                      <span>{order.region}</span>
                    </div>
                  )}
                  {order.district && (
                    <div className="row flex justify-between my-1">
                      <span className="label font-bold">Tuman:</span>
                      <span>{order.district}</span>
                    </div>
                  )}
                </div>
              )}
              
              <div className="divider border-t border-dashed border-black my-3"></div>
              
              <div className="section mb-2">
                <div className="row total-row flex justify-between text-sm font-bold">
                  <span>Jami:</span>
                  <span>{order.total_amount.toLocaleString()} so'm</span>
                </div>
                <div className="row flex justify-between text-xs my-1">
                  <span className="label font-bold">Oldindan:</span>
                  <span>{(order.advance_payment || 0).toLocaleString()} so'm</span>
                </div>
              </div>
              
              <div className="remaining text-base font-bold text-center border-2 border-black p-2 mt-3">
                Qoldiq: {remaining.toLocaleString()} so'm
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setPreviewOpen(false)} className="flex-1">
              Bekor qilish
            </Button>
            <Button onClick={executePrint} className="flex-1">
              <Printer className="h-4 w-4 mr-2" />
              Chop etish
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground text-center mt-2">
            Print dialogda Xprinter XP-365B ni tanlang
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
};
