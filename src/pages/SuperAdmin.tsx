import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRoles } from '@/hooks/useUserRoles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Building2, Plus, Users, Calendar, Settings, LogOut, RefreshCw, Ban, CheckCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface Company {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  subscription_status: string;
  subscription_ends_at: string | null;
  max_users: number;
  created_at: string;
  user_count?: number;
}

const SuperAdmin = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: rolesLoading } = useUserRoles();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [creating, setCreating] = useState(false);

  // Form states
  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [subscriptionDays, setSubscriptionDays] = useState('30');
  const [maxUsers, setMaxUsers] = useState('5');
  
  // Subscription form
  const [extendDays, setExtendDays] = useState('30');
  const [newSubscriptionStatus, setNewSubscriptionStatus] = useState('basic');

  useEffect(() => {
    if (!rolesLoading && !isSuperAdmin) {
      navigate('/');
      return;
    }
    if (isSuperAdmin) {
      fetchCompanies();
    }
  }, [isSuperAdmin, rolesLoading, navigate]);

  const fetchCompanies = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      // Fetch companies using RPC or direct query with super_admin access
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user counts for each company
      const companiesWithCounts = await Promise.all(
        (data || []).map(async (company) => {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id);
          
          return { ...company, user_count: count || 0 };
        })
      );

      setCompanies(companiesWithCounts);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Kompaniyalarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      console.log('Creating company with:', {
        company_name: companyName,
        admin_email: adminEmail,
        admin_full_name: adminFullName,
        subscription_days: parseInt(subscriptionDays),
        max_users: parseInt(maxUsers),
      });

      const response = await supabase.functions.invoke('create-company', {
        body: {
          company_name: companyName,
          admin_email: adminEmail,
          admin_password: adminPassword,
          admin_full_name: adminFullName,
          admin_phone: adminPhone,
          subscription_days: parseInt(subscriptionDays),
          max_users: parseInt(maxUsers),
          subscription_status: 'trial'
        }
      });

      console.log('Response:', response);

      if (response.error) {
        console.error('Function error:', response.error);
        throw new Error(response.error.message || 'Funksiya xatosi');
      }
      if (response.data?.error) {
        console.error('Data error:', response.data.error);
        throw new Error(response.data.error);
      }

      toast.success('Kompaniya muvaffaqiyatli yaratildi');
      setIsCreateDialogOpen(false);
      resetForm();
      fetchCompanies();
    } catch (error: any) {
      console.error('Error creating company:', error);
      toast.error(error.message || 'Kompaniya yaratishda xatolik');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateSubscription = async (action: 'extend' | 'cancel' | 'activate') => {
    if (!selectedCompany) return;

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('update-company-subscription', {
        body: {
          company_id: selectedCompany.id,
          action,
          days: action === 'extend' ? parseInt(extendDays) : undefined,
          subscription_status: action !== 'cancel' ? newSubscriptionStatus : 'cancelled'
        }
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      toast.success(
        action === 'extend' ? 'Obuna uzaytirildi' : 
        action === 'cancel' ? 'Obuna bekor qilindi' : 
        'Obuna faollashtirildi'
      );
      setIsSubscriptionDialogOpen(false);
      fetchCompanies();
    } catch (error: any) {
      console.error('Error updating subscription:', error);
      toast.error(error.message || 'Obunani yangilashda xatolik');
    }
  };

  const resetForm = () => {
    setCompanyName('');
    setAdminEmail('');
    setAdminPassword('');
    setAdminFullName('');
    setAdminPhone('');
    setSubscriptionDays('30');
    setMaxUsers('5');
  };

  const getSubscriptionBadge = (status: string, endsAt: string | null) => {
    const isExpired = endsAt && new Date(endsAt) < new Date();
    const daysLeft = endsAt ? differenceInDays(new Date(endsAt), new Date()) : 0;

    if (status === 'cancelled' || isExpired) {
      return <Badge variant="destructive">Bekor qilingan</Badge>;
    }
    
    if (status === 'trial') {
      return <Badge variant="secondary">{daysLeft} kun trial</Badge>;
    }
    
    if (status === 'premium') {
      return <Badge className="bg-purple-500">{daysLeft} kun premium</Badge>;
    }
    
    return <Badge variant="default">{daysLeft} kun basic</Badge>;
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (rolesLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Super Admin Panel</h1>
              <p className="text-sm text-muted-foreground">Kompaniyalarni boshqarish</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Chiqish
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Jami Kompaniyalar</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{companies.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Faol Kompaniyalar</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {companies.filter(c => c.is_active).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Trial</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-600">
                {companies.filter(c => c.subscription_status === 'trial').length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Premium</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600">
                {companies.filter(c => c.subscription_status === 'premium').length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Companies Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Kompaniyalar</CardTitle>
              <CardDescription>Barcha ro'yxatdan o'tgan kompaniyalar</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchCompanies}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Yangilash
              </Button>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Yangi Kompaniya
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Yangi Kompaniya Yaratish</DialogTitle>
                    <DialogDescription>
                      Yangi kompaniya va uning admini ma'lumotlarini kiriting
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateCompany} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Kompaniya nomi</Label>
                      <Input 
                        value={companyName} 
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Misol: ABC Company"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Trial kunlari</Label>
                        <Input 
                          type="number"
                          value={subscriptionDays} 
                          onChange={(e) => setSubscriptionDays(e.target.value)}
                          min="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max foydalanuvchilar</Label>
                        <Input 
                          type="number"
                          value={maxUsers} 
                          onChange={(e) => setMaxUsers(e.target.value)}
                          min="1"
                        />
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium mb-2">Admin ma'lumotlari</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Admin ismi</Label>
                      <Input 
                        value={adminFullName} 
                        onChange={(e) => setAdminFullName(e.target.value)}
                        placeholder="To'liq ism"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Admin email</Label>
                      <Input 
                        type="email"
                        value={adminEmail} 
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@company.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Admin parol</Label>
                      <Input 
                        type="password"
                        value={adminPassword} 
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Kamida 6 ta belgi"
                        minLength={6}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Admin telefon (ixtiyoriy)</Label>
                      <Input 
                        value={adminPhone} 
                        onChange={(e) => setAdminPhone(e.target.value)}
                        placeholder="+998901234567"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={creating}>
                      {creating ? 'Yaratilmoqda...' : 'Kompaniya Yaratish'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kompaniya</TableHead>
                  <TableHead>Foydalanuvchilar</TableHead>
                  <TableHead>Obuna</TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead>Yaratilgan</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{company.name}</p>
                        <p className="text-sm text-muted-foreground">{company.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{company.user_count || 0} / {company.max_users}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getSubscriptionBadge(company.subscription_status, company.subscription_ends_at)}
                    </TableCell>
                    <TableCell>
                      {company.is_active ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Faol
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600 border-red-600">
                          <Ban className="h-3 w-3 mr-1" />
                          Nofaol
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(company.created_at), 'dd.MM.yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedCompany(company);
                          setIsSubscriptionDialogOpen(true);
                        }}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Boshqarish
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {companies.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Hozircha kompaniyalar yo'q
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* Subscription Management Dialog */}
      <Dialog open={isSubscriptionDialogOpen} onOpenChange={setIsSubscriptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Obunani Boshqarish</DialogTitle>
            <DialogDescription>
              {selectedCompany?.name} kompaniyasi obunasini boshqarish
            </DialogDescription>
          </DialogHeader>
          {selectedCompany && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Joriy holat</p>
                <p className="font-medium">{selectedCompany.subscription_status}</p>
                {selectedCompany.subscription_ends_at && (
                  <p className="text-sm">
                    Tugash sanasi: {format(new Date(selectedCompany.subscription_ends_at), 'dd.MM.yyyy')}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Obuna turi</Label>
                <Select value={newSubscriptionStatus} onValueChange={setNewSubscriptionStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Uzaytirish (kun)</Label>
                <Input 
                  type="number"
                  value={extendDays}
                  onChange={(e) => setExtendDays(e.target.value)}
                  min="1"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => handleUpdateSubscription('extend')}
                  className="flex-1"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Uzaytirish
                </Button>
                {selectedCompany.is_active ? (
                  <Button 
                    variant="destructive"
                    onClick={() => handleUpdateSubscription('cancel')}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Bekor qilish
                  </Button>
                ) : (
                  <Button 
                    variant="outline"
                    onClick={() => handleUpdateSubscription('activate')}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Faollashtirish
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdmin;
