import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClientId } from '@/hooks/useClientId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Phone, CalendarDays, TrendingUp, Clock } from 'lucide-react';

interface ClientStats {
  agentCount: number;
  phoneCount: number;
  bookingCount: number;
  usedMinutes: number;
  maxMinutes: number;
  totalCalls: number;
  plan: string;
}

export default function ClientDashboard() {
  const { clientId, loading: clientLoading } = useClientId();
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    const fetch = async () => {
      const [agentsRes, phonesRes, bookingsRes, clientRes] = await Promise.all([
        supabase.from('agents').select('id').eq('client_id', clientId),
        supabase.from('phone_numbers').select('id').eq('assigned_client_id', clientId),
        supabase.from('bookings').select('id').eq('client_id', clientId),
        supabase.from('clients').select('used_minutes, max_minutes, total_calls, subscription_plan').eq('id', clientId).maybeSingle(),
      ]);
      setStats({
        agentCount: agentsRes.data?.length ?? 0,
        phoneCount: phonesRes.data?.length ?? 0,
        bookingCount: bookingsRes.data?.length ?? 0,
        usedMinutes: Number(clientRes.data?.used_minutes ?? 0),
        maxMinutes: clientRes.data?.max_minutes ?? 0,
        totalCalls: clientRes.data?.total_calls ?? 0,
        plan: clientRes.data?.subscription_plan ?? 'free',
      });
      setLoading(false);
    };
    fetch();
  }, [clientId]);

  if (clientLoading || loading) return <div className="text-muted-foreground p-8">Loading...</div>;

  const cards = [
    { title: 'Active Agents', value: stats?.agentCount ?? 0, icon: Bot, color: 'text-primary' },
    { title: 'Phone Numbers', value: stats?.phoneCount ?? 0, icon: Phone, color: 'text-success' },
    { title: 'Bookings', value: stats?.bookingCount ?? 0, icon: CalendarDays, color: 'text-warning' },
    { title: 'Total Calls', value: stats?.totalCalls ?? 0, icon: TrendingUp, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Dashboard</h1>
        <p className="page-description">Welcome to your VoiceOS workspace</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title} className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-foreground">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Usage Bar */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Usage</CardTitle>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">{stats?.plan} plan</span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Minutes Used</span>
            </div>
            <span className="font-medium">{stats?.usedMinutes.toFixed(0)} / {stats?.maxMinutes}</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${Math.min(((stats?.usedMinutes ?? 0) / (stats?.maxMinutes || 1)) * 100, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Create your first AI voice agent in the <strong>Agents</strong> section</p>
          <p>2. Upload knowledge base files to improve agent responses</p>
          <p>3. Link a phone number to your agent to start receiving calls</p>
          <p>4. Monitor bookings and performance from this dashboard</p>
        </CardContent>
      </Card>
    </div>
  );
}
