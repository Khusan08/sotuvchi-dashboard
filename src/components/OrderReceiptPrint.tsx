import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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

// ESC/POS commands for thermal printers
const ESC = '\x1B';
const GS = '\x1D';
const COMMANDS = {
  INIT: ESC + '@',
  ALIGN_CENTER: ESC + 'a' + '\x01',
  ALIGN_LEFT: ESC + 'a' + '\x00',
  BOLD_ON: ESC + 'E' + '\x01',
  BOLD_OFF: ESC + 'E' + '\x00',
  DOUBLE_HEIGHT: GS + '!' + '\x10',
  DOUBLE_WIDTH: GS + '!' + '\x20',
  DOUBLE_BOTH: GS + '!' + '\x30',
  NORMAL: GS + '!' + '\x00',
  CUT: GS + 'V' + '\x00',
  FEED: ESC + 'd' + '\x03',
};

export const OrderReceiptPrint = ({ order }: OrderReceiptPrintProps) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const remaining = order.total_amount - (order.advance_payment || 0);

  const generateReceiptData = () => {
    const divider = '--------------------------------';
    const dateStr = format(new Date(order.order_date), "dd.MM.yyyy");
    
    let receipt = '';
    
    // Initialize printer
    receipt += COMMANDS.INIT;
    
    // Header
    receipt += COMMANDS.ALIGN_CENTER;
    receipt += COMMANDS.BOLD_ON;
    receipt += COMMANDS.DOUBLE_BOTH;
    receipt += 'ZAKAZ CHEKI\n';
    receipt += COMMANDS.NORMAL;
    receipt += COMMANDS.BOLD_ON;
    receipt += `#${order.order_number}\n`;
    receipt += COMMANDS.BOLD_OFF;
    receipt += `${dateStr}\n`;
    receipt += divider + '\n';
    
    // Customer info
    receipt += COMMANDS.ALIGN_LEFT;
    receipt += COMMANDS.BOLD_ON;
    receipt += 'Mijoz: ';
    receipt += COMMANDS.BOLD_OFF;
    receipt += `${order.customer_name}\n`;
    
    if (order.customer_phone) {
      receipt += COMMANDS.BOLD_ON;
      receipt += 'Tel 1: ';
      receipt += COMMANDS.BOLD_OFF;
      receipt += `${order.customer_phone}\n`;
    }
    
    if (order.customer_phone2) {
      receipt += COMMANDS.BOLD_ON;
      receipt += 'Tel 2: ';
      receipt += COMMANDS.BOLD_OFF;
      receipt += `${order.customer_phone2}\n`;
    }
    
    // Address
    if (order.region) {
      receipt += COMMANDS.BOLD_ON;
      receipt += 'Viloyat: ';
      receipt += COMMANDS.BOLD_OFF;
      receipt += `${order.region}\n`;
    }
    
    if (order.district) {
      receipt += COMMANDS.BOLD_ON;
      receipt += 'Tuman: ';
      receipt += COMMANDS.BOLD_OFF;
      receipt += `${order.district}\n`;
    }
    
    receipt += divider + '\n';
    
    // Totals
    receipt += COMMANDS.BOLD_ON;
    receipt += COMMANDS.DOUBLE_HEIGHT;
    receipt += `Jami: ${order.total_amount.toLocaleString()} so'm\n`;
    receipt += COMMANDS.NORMAL;
    receipt += `Oldindan: ${(order.advance_payment || 0).toLocaleString()} so'm\n`;
    
    receipt += divider + '\n';
    
    // Remaining amount (highlighted)
    receipt += COMMANDS.ALIGN_CENTER;
    receipt += COMMANDS.BOLD_ON;
    receipt += COMMANDS.DOUBLE_BOTH;
    receipt += `Qoldiq: ${remaining.toLocaleString()}\n`;
    receipt += `so'm\n`;
    receipt += COMMANDS.NORMAL;
    
    // Feed and cut
    receipt += COMMANDS.FEED;
    receipt += COMMANDS.CUT;
    
    return receipt;
  };

  const printWithQZTray = async () => {
    setIsPrinting(true);
    
    try {
      // Dynamic import of qz-tray
      const qz = await import('qz-tray');
      
      // Connect to QZ Tray
      if (!qz.websocket.isActive()) {
        await qz.websocket.connect();
      }
      
      // Find printer
      const printers = await qz.printers.find();
      console.log('Available printers:', printers);
      
      // Look for Xprinter or use default
      let printerName = printers.find((p: string) => 
        p.toLowerCase().includes('xp') || 
        p.toLowerCase().includes('365') ||
        p.toLowerCase().includes('xprinter')
      );
      
      if (!printerName && printers.length > 0) {
        printerName = printers[0];
      }
      
      if (!printerName) {
        toast.error("Printer topilmadi. QZ Tray o'rnatilganligini tekshiring.");
        return;
      }
      
      console.log('Using printer:', printerName);
      
      // Create config
      const config = qz.configs.create(printerName, {
        encoding: 'UTF-8',
      });
      
      // Generate receipt data
      const receiptData = generateReceiptData();
      
      // Print
      await qz.print(config, [{
        type: 'raw',
        format: 'plain',
        data: receiptData
      }]);
      
      toast.success("Chek chiqarildi!");
      setPreviewOpen(false);
      
    } catch (error: any) {
      console.error('Print error:', error);
      
      if (error.message?.includes('Unable to connect')) {
        toast.error(
          "QZ Tray ishlamayapti. Iltimos qz.io/download dan yuklab o'rnating.",
          { duration: 5000 }
        );
      } else {
        toast.error(`Xato: ${error.message || 'Noma\'lum xato'}`);
      }
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
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
            className="bg-white text-black p-4 font-mono text-sm border rounded"
            style={{ width: '100%', maxWidth: '300px', margin: '0 auto' }}
          >
            <div className="text-center border-b border-dashed border-black pb-2 mb-3">
              <h1 className="text-sm font-bold">ZAKAZ CHEKI</h1>
              <div className="text-lg font-bold my-1">#{order.order_number}</div>
              <div className="text-xs">{format(new Date(order.order_date), "dd.MM.yyyy")}</div>
            </div>
            
            <div className="mb-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="font-bold">Mijoz:</span>
                <span>{order.customer_name}</span>
              </div>
              {order.customer_phone && (
                <div className="flex justify-between">
                  <span className="font-bold">Tel 1:</span>
                  <span>{order.customer_phone}</span>
                </div>
              )}
              {order.customer_phone2 && (
                <div className="flex justify-between">
                  <span className="font-bold">Tel 2:</span>
                  <span>{order.customer_phone2}</span>
                </div>
              )}
            </div>
            
            {(order.region || order.district) && (
              <div className="mb-3 text-xs space-y-1">
                {order.region && (
                  <div className="flex justify-between">
                    <span className="font-bold">Viloyat:</span>
                    <span>{order.region}</span>
                  </div>
                )}
                {order.district && (
                  <div className="flex justify-between">
                    <span className="font-bold">Tuman:</span>
                    <span>{order.district}</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="border-t border-dashed border-black my-3"></div>
            
            <div className="mb-2 space-y-1">
              <div className="flex justify-between text-sm font-bold">
                <span>Jami:</span>
                <span>{order.total_amount.toLocaleString()} so'm</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-bold">Oldindan:</span>
                <span>{(order.advance_payment || 0).toLocaleString()} so'm</span>
              </div>
            </div>
            
            <div className="text-base font-bold text-center border-2 border-black p-2 mt-3">
              Qoldiq: {remaining.toLocaleString()} so'm
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setPreviewOpen(false)} 
              className="flex-1"
              disabled={isPrinting}
            >
              Bekor qilish
            </Button>
            <Button 
              onClick={printWithQZTray} 
              className="flex-1"
              disabled={isPrinting}
            >
              {isPrinting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Chiqarilmoqda...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4 mr-2" />
                  Chop etish
                </>
              )}
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground text-center mt-2 space-y-1">
            <p>
              <a 
                href="https://qz.io/download/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                QZ Tray
              </a>
              {" "}o'rnatilgan bo'lishi kerak
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
