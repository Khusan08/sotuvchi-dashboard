import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Phone, Facebook, MessageSquare, Loader2, Link } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Integrations = () => {
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);

  const webhooks = [
    {
      id: "myzvonki",
      name: "My Zvonki",
      description: "Qo'ng'iroqlarni avtomatik lid sifatida qabul qilish",
      icon: Phone,
      url: "https://ffqcwcbrfzvytsokkrln.supabase.co/functions/v1/myzvonki-webhook",
      hasAutoConnect: true,
      instructions: [
        "Quyidagi 'Ulash' tugmasini bosing",
        "Yoki qo'lda: My Zvonki dashboardga kiring",
        "Sozlamalar → Webhooks bo'limiga o'ting",
        "Yangi webhook qo'shing va URL ni kiriting",
        "Hodisalarni tanlang: 'Kiruvchi qo'ng'iroq', 'Qo'ng'iroq tugadi'",
        "Saqlang"
      ],
      status: "ready"
    },
    {
      id: "facebook",
      name: "Facebook Lead Ads",
      description: "Facebook/Instagram reklamalardan lidlarni avtomatik qabul qilish",
      icon: Facebook,
      url: "https://ffqcwcbrfzvytsokkrln.supabase.co/functions/v1/facebook-leads-webhook",
      verifyToken: "lovable_crm_verify_token_2024",
      instructions: [
        "developers.facebook.com ga kiring",
        "Yangi app yarating (Business turi)",
        "Webhooks mahsulotini qo'shing",
        "Page → leadgen uchun webhook sozlang",
        "Callback URL va Verify Token ni kiriting",
        "Facebook sahifangizni ulang"
      ],
      status: "ready"
    },
    {
      id: "telegram",
      name: "Telegram Bot",
      description: "Yangi lidlar haqida Telegram orqali xabar olish",
      icon: MessageSquare,
      url: "Bot orqali - profilingizda Telegram ID ni kiriting",
      instructions: [
        "Telegram'da @userinfobot ga /start yozing",
        "Sizning ID raqamingizni oling",
        "CRM'da Profil sahifasiga o'ting",
        "Telegram User ID maydoniga ID ni kiriting",
        "Endi yangi lidlar haqida xabar olasiz"
      ],
      status: "ready"
    }
  ];

  const copyToClipboard = async (text: string, webhookId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWebhook(webhookId);
      toast.success("Nusxalandi!");
      setTimeout(() => setCopiedWebhook(null), 2000);
    } catch (err) {
      toast.error("Nusxalashda xatolik");
    }
  };

  const connectMyZvonki = async () => {
    setIsConnecting("myzvonki");
    try {
      const { data, error } = await supabase.functions.invoke('register-myzvonki-webhook');
      
      if (error) {
        console.error('Error connecting My Zvonki:', error);
        toast.error("My Zvonki bilan ulanishda xatolik: " + error.message);
        return;
      }

      if (data?.success) {
        toast.success("My Zvonki muvaffaqiyatli ulandi!");
      } else {
        toast.error("Xatolik: " + (data?.error || "Noma'lum xatolik"));
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error("Xatolik yuz berdi");
    } finally {
      setIsConnecting(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integratsiyalar</h1>
          <p className="text-muted-foreground mt-1">
            Tashqi xizmatlarni CRM bilan ulash
          </p>
        </div>

        <div className="grid gap-6">
          {webhooks.map((webhook) => (
            <Card key={webhook.id} className="overflow-hidden">
              <CardHeader className="bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <webhook.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{webhook.name}</CardTitle>
                      <CardDescription>{webhook.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                    Tayyor
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {'hasAutoConnect' in webhook && webhook.hasAutoConnect && (
                  <div className="space-y-2">
                    <Button
                      onClick={connectMyZvonki}
                      disabled={isConnecting === webhook.id}
                      className="w-full"
                    >
                      {isConnecting === webhook.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Ulanmoqda...
                        </>
                      ) : (
                        <>
                          <Link className="mr-2 h-4 w-4" />
                          Avtomatik ulash
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Bir tugma bilan My Zvonki webhook'ini ro'yxatdan o'tkazing
                    </p>
                  </div>
                )}

                {webhook.url && !webhook.url.startsWith("Bot") && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Webhook URL:</label>
                    <div className="flex gap-2">
                      <Input 
                        value={webhook.url} 
                        readOnly 
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(webhook.url, webhook.id)}
                      >
                        {copiedWebhook === webhook.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {webhook.verifyToken && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Verify Token:</label>
                    <div className="flex gap-2">
                      <Input 
                        value={webhook.verifyToken} 
                        readOnly 
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(webhook.verifyToken!, `${webhook.id}-token`)}
                      >
                        {copiedWebhook === `${webhook.id}-token` ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Sozlash qadamlari:</label>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg">
                    {webhook.instructions.map((instruction, index) => (
                      <li key={index}>{instruction}</li>
                    ))}
                  </ol>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Integrations;
