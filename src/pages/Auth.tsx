import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2 } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companySlug = searchParams.get('company');
  
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyInfo, setCompanyInfo] = useState<{ name: string; slug: string } | null>(null);

  useEffect(() => {
    // Check if there's a company slug in the URL
    if (companySlug) {
      fetchCompanyInfo(companySlug);
    }
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });
  }, [navigate, companySlug]);

  const fetchCompanyInfo = async (slug: string) => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('name, slug, is_active, subscription_status')
        .eq('slug', slug)
        .maybeSingle();

      if (error) {
        console.error('Error fetching company:', error);
        return;
      }

      if (data) {
        if (!data.is_active || data.subscription_status === 'cancelled') {
          toast.error("Bu kompaniyaning obunasi tugagan yoki bekor qilingan");
          return;
        }
        setCompanyInfo({ name: data.name, slug: data.slug });
      } else {
        toast.error("Kompaniya topilmadi");
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      toast.success("Ro'yxatdan o'tish muvaffaqiyatli!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("Kirish muvaffaqiyatli!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          {companyInfo ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold text-center">{companyInfo.name}</CardTitle>
              <CardDescription className="text-center">
                Tizimga kirish
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle className="text-2xl font-bold text-center">ROP Seller</CardTitle>
              <CardDescription className="text-center">
                Sotuvchilar boshqaruv tizimi
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className={`grid w-full ${companyInfo ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <TabsTrigger value="signin">Kirish</TabsTrigger>
              {!companyInfo && <TabsTrigger value="signup">Ro'yxat</TabsTrigger>}
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Parol</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Yuklanmoqda..." : "Kirish"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">To'liq ism</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Ismingiz"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Parol</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Yuklanmoqda..." : "Ro'yxatdan o'tish"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
