import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Target, DollarSign, TrendingUp, Package, CheckCircle2, XCircle } from "lucide-react";

interface EmployeeStatsCardProps {
  sellerName: string;
  totalOrders: number;
  totalLeads: number;
  totalSales: number;
  averageCheck: number;
  conversionRate: number;
  pendingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  onViewOrders: (status: string) => void;
}

const EmployeeStatsCard = ({
  sellerName,
  totalOrders,
  totalLeads,
  totalSales,
  averageCheck,
  conversionRate,
  pendingOrders,
  deliveredOrders,
  cancelledOrders,
  onViewOrders
}: EmployeeStatsCardProps) => {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{sellerName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Jami zakazlar</span>
            </div>
            <p className="text-2xl font-bold">{totalOrders}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Jami lidlar</span>
            </div>
            <p className="text-2xl font-bold">{totalLeads}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Jami savdo</span>
            </div>
            <p className="text-lg font-bold">{totalSales.toLocaleString()} so'm</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">O'rtacha chek</span>
            </div>
            <p className="text-lg font-bold">{Math.round(averageCheck).toLocaleString()} so'm</p>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Konversiya</span>
            <Badge variant="secondary" className="text-lg font-semibold">
              {conversionRate.toFixed(1)}%
            </Badge>
          </div>
        </div>

        {/* Order Status */}
        <div className="pt-3 border-t space-y-2">
          <p className="text-sm font-medium mb-2">Zakazlar holati</p>
          
          <div 
            className="flex items-center justify-between p-2 rounded-md bg-blue-500/10 hover:bg-blue-500/20 cursor-pointer transition-colors"
            onClick={() => onViewOrders('pending')}
          >
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              <span className="text-sm">Jarayonda</span>
            </div>
            <Badge variant="secondary">{pendingOrders}</Badge>
          </div>
          
          <div 
            className="flex items-center justify-between p-2 rounded-md bg-green-500/10 hover:bg-green-500/20 cursor-pointer transition-colors"
            onClick={() => onViewOrders('delivered')}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">Yetkazildi</span>
            </div>
            <Badge variant="default">{deliveredOrders}</Badge>
          </div>
          
          <div 
            className="flex items-center justify-between p-2 rounded-md bg-red-500/10 hover:bg-red-500/20 cursor-pointer transition-colors"
            onClick={() => onViewOrders('cancelled')}
          >
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm">Bekor qilindi</span>
            </div>
            <Badge variant="destructive">{cancelledOrders}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmployeeStatsCard;
