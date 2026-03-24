import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Bot, Phone, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Stats {
  totalClients: number;
  totalAgents: number;
  totalPhoneNumbers: number;
  activeSubscriptions: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    totalAgents: 0,
    totalPhoneNumbers: 0,
    activeSubscriptions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const [clients, agents, phones] = await Promise.all([
        supabase.from('clients').select('id, subscription_status'),
        supabase.from('agents').select('id'),
        supabase.from('phone_numbers').select('id'),
      ]);

      setStats({
        totalClients: clients.data?.length ?? 0,
        totalAgents: agents.data?.length ?? 0,
        totalPhoneNumbers: phones.data?.length ?? 0,
        activeSubscriptions: clients.data?.filter(c => c.subscription_status === 'active').length ?? 0,
      });
      setLoading(false);
    }
    fetchStats();
  }, []);

  const cards = [
    { title: 'Total Clients', value: stats.totalClients, icon: Users, color: 'text-primary' },
    { title: 'Total Agents', value: stats.totalAgents, icon: Bot, color: 'text-success' },
    { title: 'Phone Numbers', value: stats.totalPhoneNumbers, icon: Phone, color: 'text-warning' },
    { title: 'Active Subscriptions', value: stats.activeSubscriptions, icon: TrendingUp, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Dashboard</h1>
        <p className="page-description">Overview of your VoiceOS platform</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title} className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-foreground">
                {loading ? '—' : card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
