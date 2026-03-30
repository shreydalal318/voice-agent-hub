import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Bot, Phone, TrendingUp, Wallet, RefreshCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Stats {
  totalClients: number;
  totalAgents: number;
  totalPhoneNumbers: number;
  activeSubscriptions: number;
}

interface VobizBalance {
  currency: string;
  available_balance: number;
  reserved_funds: number;
  promotional_balance?: number;
  promo_credits?: number;
  status?: string;
}

interface VobizTrunkInfo {
  trunk_id: string;
  trunk_domain?: string;
  trunk_direction?: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    totalAgents: 0,
    totalPhoneNumbers: 0,
    activeSubscriptions: 0,
  });
  const [balance, setBalance] = useState<VobizBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [trunks, setTrunks] = useState<VobizTrunkInfo[]>([]);
  const [trunksLoading, setTrunksLoading] = useState(false);
  const [ensureState, setEnsureState] = useState<{ loading: boolean; created?: boolean; error?: string }>(
    { loading: false },
  );

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

  useEffect(() => {
    async function fetchBalance() {
      try {
        const { data, error } = await supabase.functions.invoke('vobiz-get-account-balance', {
          body: { currency: 'INR' },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Vobiz returns numbers like available_balance/reserved_funds.
        setBalance(data as VobizBalance);
      } catch {
        // Silent fail; admin can still use the dashboard.
      } finally {
        setBalanceLoading(false);
      }
    }
    fetchBalance();
  }, []);

  useEffect(() => {
    async function loadTrunks() {
      setTrunksLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('vobiz-list-trunks', {
          body: { limit: 50, offset: 0 },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setTrunks(data?.objects ?? []);
      } catch (e) {
        setTrunks([]);
      } finally {
        setTrunksLoading(false);
      }
    }
    void loadTrunks();
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            Vobiz Balance
          </CardTitle>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            {balanceLoading ? 'Loading...' : balance?.currency ?? '—'}
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Available</span>
            <span className="font-semibold">
              {balanceLoading ? '—' : (balance?.available_balance ?? 0)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Reserved</span>
            <span className="font-semibold">
              {balanceLoading ? '—' : (balance?.reserved_funds ?? 0)}
            </span>
          </div>
          {typeof balance?.promotional_balance !== 'undefined' ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Promotional</span>
              <span className="font-semibold">{balance?.promotional_balance ?? 0}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between flex-row gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" />
            Vobiz Trunk Routing
          </CardTitle>
          <div className="flex items-center gap-2">
            <RefreshCcw
              className={`w-4 h-4 ${trunksLoading ? 'animate-spin' : ''}`}
              aria-hidden
            />
            <button
              className="text-sm px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              disabled={ensureState.loading}
              onClick={async () => {
                setEnsureState({ loading: true });
                try {
                  const { data, error } = await supabase.functions.invoke('vobiz-ensure-trunk', {
                    body: {},
                  });
                  if (error) throw error;
                  if (data?.error) throw new Error(data.error);
                  setEnsureState({ loading: false, created: data?.created });
                  toast.success(`Vobiz trunk ready (${data?.created ? 'created' : 'already exists'})`);
                } catch (e) {
                  const msg = e instanceof Error ? e.message : 'Failed to ensure trunk';
                  setEnsureState({ loading: false, error: msg });
                  toast.error(msg);
                }
              }}
            >
              {ensureState.loading ? 'Ensuring...' : 'Ensure Trunk'}
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {trunksLoading ? (
            <div className="text-sm text-muted-foreground">Loading trunks...</div>
          ) : trunks.length === 0 ? (
            <div className="text-sm text-muted-foreground">No trunks found (or API failed).</div>
          ) : (
            <div className="text-sm space-y-2">
              <div className="text-muted-foreground">Existing trunks:</div>
              {trunks.slice(0, 5).map((t) => (
                <div key={t.trunk_id} className="font-mono text-xs break-all">
                  {t.trunk_domain ?? '—'} ({t.trunk_id}) dir={t.trunk_direction ?? '—'}
                </div>
              ))}
              {trunks.length > 5 ? (
                <div className="text-xs text-muted-foreground">Showing first 5 of {trunks.length}.</div>
              ) : null}
            </div>
          )}
          {ensureState.error ? (
            <div className="text-sm text-destructive">{ensureState.error}</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
