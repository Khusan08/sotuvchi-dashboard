import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");

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

  const getQZ = async () => {
    // Dynamic import of qz-tray (CJS interop-safe)
    const qzImport: any = await import("qz-tray");
    return qzImport?.default ?? qzImport;
  };

  const loadPrinters = async () => {
    setIsLoadingPrinters(true);

    try {
      const qz: any = await getQZ();

      if (!qz.websocket.isActive()) {
        await qz.websocket.connect();
      }

      const found = await qz.printers.find();
      const list: string[] = Array.isArray(found) ? found : found ? [found] : [];
      const unique = Array.from(new Set(list)).filter(Boolean);

      // Prefer real printers (avoid virtual PDF/XPS printers)
      const virtualRe = /pdf|xps|fax|onenote/i;
      const candidates = unique.filter((p) => !virtualRe.test(p));

      const defaultPrinter: string | null = await qz.printers
        .getDefault()
        .then((p: any) => (typeof p === "string" ? p : null))
        .catch(() => null);

      setPrinters(candidates.length ? candidates : unique);

      if (!selectedPrinter) {
        const safeDefault = defaultPrinter && !virtualRe.test(defaultPrinter) ? defaultPrinter : "";
        const guessed =
          candidates.find((p) => /xprinter|xp[-\s_]?365/i.test(p)) ??
          safeDefault ??
          candidates[0] ??
          unique[0] ??
          "";

        if (guessed) setSelectedPrinter(guessed);
      }
    } catch (error: any) {
      console.error("QZ printers load error:", error);

      const msg = error?.message ? String(error.message) : String(error);

      if (/ERR_CERT|certificate|TLS|secure/i.test(msg)) {
        toast.error(
          "Chrome QZ Tray sertifikatini bloklayapti. Brauzerda 1 marta https://localhost:8181 ni ochib ruxsat bering, keyin qayta urinib ko'ring.",
          { duration: 9000 }
        );
      } else if (/unable to connect|connection refused|failed to fetch/i.test(msg)) {
        toast.error(
          "QZ Tray'ga ulanib bo'lmadi. QZ Tray ochiq ekanini tekshiring va qayta urinib ko'ring.",
          { duration: 7000 }
        );
      } else {
        toast.error(`Printerlarni yuklashda xato: ${msg}`);
      }

      setPrinters([]);
      setSelectedPrinter("");
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  useEffect(() => {
    if (previewOpen) {
      void loadPrinters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen]);

  const printWithQZTray = async () => {
    setIsPrinting(true);

    try {
      const qz: any = await getQZ();

      // Connect to QZ Tray
      if (!qz.websocket.isActive()) {
        await qz.websocket.connect();
      }

      if (!selectedPrinter) {
        await loadPrinters();
      }

      const printerName = selectedPrinter?.trim();
      const virtualRe = /pdf|xps|fax|onenote/i;

      if (!printerName) {
        toast.error("Printerni tanlang (yoki 'Yangilash' ni bosing).");
        return;
      }

      if (virtualRe.test(printerName)) {
        toast.error("PDF printer tanlangan (shuning uchun Save chiqadi). Xprinter ni tanlang.");
        return;
      }

      console.log("Using printer:", printerName);

      // Create config (raw printing)
      const config = qz.configs.create(printerName, {
        encoding: "UTF-8",
        forceRaw: true,
      });

      const receiptData = generateReceiptData();
      await qz.print(config, [receiptData]);

      toast.success(`Chek printerga yuborildi: ${printerName}`);
      setPreviewOpen(false);
    } catch (error: any) {
      console.error("Print error:", error);

      const msg = error?.message ? String(error.message) : String(error);

      if (/unable to connect|connection refused|failed to fetch/i.test(msg)) {
        toast.error(
          "QZ Tray ishlamayapti (ishga tushmagan bo'lishi mumkin). QZ Tray'ni ochib qayta urinib ko'ring.",
          { duration: 6000 }
        );
      } else if (/ERR_CERT|certificate|TLS|secure/i.test(msg)) {
        toast.error(
          "Chrome QZ Tray sertifikatini bloklayapti. 1 marta https://localhost:8181 ni ochib ruxsat bering, keyin qayta urinib ko'ring.",
          { duration: 9000 }
        );
      } else if (/signature|sign/i.test(msg)) {
        toast.error(
          "QZ Tray ruxsat bermayapti. QZ Tray'da 'Allow unsigned requests' ni yoqing, so'ng qayta urinib ko'ring.",
          { duration: 8000 }
        );
      } else {
        toast.error(`Xato: ${msg || "Noma'lum xato"}`);
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

          <div className="space-y-2">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-sm">Printer</Label>
                <Select
                  value={selectedPrinter}
                  onValueChange={setSelectedPrinter}
                  disabled={isLoadingPrinters || isPrinting || printers.length === 0}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue
                      placeholder={
                        isLoadingPrinters
                          ? "Yuklanmoqda..."
                          : printers.length
                            ? "Printerni tanlang"
                            : "Printer topilmadi"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {printers.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadPrinters}
                disabled={isLoadingPrinters || isPrinting}
              >
                {isLoadingPrinters ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Yangilanmoqda...
                  </>
                ) : (
                  "Yangilash"
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Agar “Save” chiqsa — PDF printer tanlangan bo‘lishi mumkin. Xprinter ni tanlang.
            </p>
          </div>

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
              disabled={isPrinting || isLoadingPrinters || !selectedPrinter}
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
