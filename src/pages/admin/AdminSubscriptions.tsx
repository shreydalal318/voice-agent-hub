import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface ClientSub {
  id: string;
  business_name: string;
  subscription_plan: string | null;
  subscription_status: string | null;
  max_agents: number | null;
  max_minutes: number | null;
  used_minutes: number | null;
  total_calls: number | null;
}

const PLANS = ['free', 'starter', 'pro', 'enterprise'];

export default function AdminSubscriptions() {
  const [clients, setClients] = useState<ClientSub[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, business_name, subscription_plan, subscription_status, max_agents, max_minutes, used_minutes, total_calls').order('created_at', { ascending: false });
    setClients(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const updatePlan = async (clientId: string, plan: string) => {
    const limits: Record<string, { max_agents: number; max_minutes: number }> = {
      free: { max_agents: 1, max_minutes: 50 },
      starter: { max_agents: 3, max_minutes: 200 },
      pro: { max_agents: 10, max_minutes: 1000 },
      enterprise: { max_agents: 50, max_minutes: 5000 },
    };
    const { error } = await supabase.from('clients').update({
      subscription_plan: plan,
      ...limits[plan],
    }).eq('id', clientId);
    if (error) toast.error(error.message);
    else {
      toast.success('Plan updated');
      fetchClients();
    }
  };

  const toggleStatus = async (clientId: string, current: string | null) => {
    const newStatus = current === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('clients').update({ subscription_status: newStatus }).eq('id', clientId);
    if (error) toast.error(error.message);
    else {
      toast.success(`Subscription ${newStatus}`);
      fetchClients();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Subscriptions</h1>
        <p className="page-description">Manage client subscription plans and usage</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Agents</TableHead>
                <TableHead>Minutes Used</TableHead>
                <TableHead>Total Calls</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell>
                </TableRow>
              ) : clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No clients yet.</TableCell>
                </TableRow>
              ) : (
                clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.business_name}</TableCell>
                    <TableCell>
                      <Select value={client.subscription_plan ?? 'free'} onValueChange={(v) => updatePlan(client.id, v)}>
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLANS.map(p => (
                            <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <button onClick={() => toggleStatus(client.id, client.subscription_status)}>
                        <span className={client.subscription_status === 'active' ? 'status-active' : 'status-inactive'}>
                          {client.subscription_status ?? 'inactive'}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>{client.max_agents ?? 0}</TableCell>
                    <TableCell>{Number(client.used_minutes ?? 0).toFixed(0)} / {client.max_minutes ?? 0}</TableCell>
                    <TableCell>{client.total_calls ?? 0}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
