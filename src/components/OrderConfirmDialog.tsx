import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OrderItem {
  product_name: string;
  quantity: string;
  price: string;
}

interface OrderConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  customerName: string;
  customerPhone: string;
  customerPhone2?: string;
  region: string;
  district: string;
  items: OrderItem[];
  totalAmount: number;
  advancePayment: number;
  notes?: string;
  isSubmitting: boolean;
}

export function OrderConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  customerName,
  customerPhone,
  customerPhone2,
  region,
  district,
  items,
  totalAmount,
  advancePayment,
  notes,
  isSubmitting,
}: OrderConfirmDialogProps) {
  const remainingAmount = Math.max(0, totalAmount - advancePayment);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Buyurtmani tasdiqlash</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left">
              <p className="text-muted-foreground">
                Haqiqatdan ham bu buyurtmani yaratmoqchimisiz?
              </p>
              
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Mijoz:</span>
                  <span className="font-medium">{customerName}</span>
                  
                  {customerPhone && (
                    <>
                      <span className="text-muted-foreground">Telefon 1:</span>
                      <span className="font-medium">{customerPhone}</span>
                    </>
                  )}
                  
                  {customerPhone2 && (
                    <>
                      <span className="text-muted-foreground">Telefon 2:</span>
                      <span className="font-medium">{customerPhone2}</span>
                    </>
                  )}
                  
                  {region && (
                    <>
                      <span className="text-muted-foreground">Viloyat:</span>
                      <span className="font-medium">{region}</span>
                    </>
                  )}
                  
                  {district && (
                    <>
                      <span className="text-muted-foreground">Tuman:</span>
                      <span className="font-medium">{district}</span>
                    </>
                  )}
                </div>

                {items.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-sm font-medium mb-2">Mahsulotlar:</p>
                    <ul className="text-sm space-y-1">
                      {items.map((item, index) => (
                        <li key={index} className="flex justify-between">
                          <span>{item.product_name} × {item.quantity}</span>
                          <span className="font-medium">
                            {(parseInt(item.quantity) * parseFloat(item.price)).toLocaleString()} so'm
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="border-t pt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Jami:</span>
                    <span className="font-bold text-lg">{totalAmount.toLocaleString()} so'm</span>
                  </div>
                  {advancePayment > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Oldindan to'lov:</span>
                      <span className="font-medium text-green-600">{advancePayment.toLocaleString()} so'm</span>
                    </div>
                  )}
                  {remainingAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Qolgan:</span>
                      <span className="font-medium text-orange-600">{remainingAmount.toLocaleString()} so'm</span>
                    </div>
                  )}
                </div>

                {notes && (
                  <div className="border-t pt-3">
                    <p className="text-sm text-muted-foreground">Izoh:</p>
                    <p className="text-sm">{notes}</p>
                  </div>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Bekor qilish</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Saqlanmoqda..." : "Ha, tasdiqlash"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
