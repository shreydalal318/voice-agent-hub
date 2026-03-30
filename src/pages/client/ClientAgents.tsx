import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useClientId } from '@/hooks/useClientId';
import { ELEVENLABS_VOICES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Bot, Volume2 } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  voice_id: string | null;
  prompt: string | null;
  status: string | null;
  total_calls: number | null;
  total_minutes: number | null;
  elevenlabs_agent_id: string | null;
  created_at: string;
}

export default function ClientAgents() {
  const { clientId, loading: clientLoading } = useClientId();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from('agents')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    setAgents(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (clientId) fetchAgents();
  }, [clientId]);

  const openCreate = () => {
    navigate('/dashboard/agents/new');
  };

  const openEdit = (agent: Agent) => {
    navigate(`/dashboard/agents/${agent.id}`);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('agents').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Agent deleted');
      fetchAgents();
    }
  };

  const getVoiceName = (id: string | null) => {
    if (!id) return 'Not set';
    return ELEVENLABS_VOICES.find(v => v.id === id)?.name ?? id;
  };

  if (clientLoading) return <div className="text-muted-foreground p-8">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Agents</h1>
          <p className="page-description">Create and manage your AI voice agents</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> New Agent
        </Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-center py-16">Loading agents...</div>
      ) : agents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Bot className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">No agents yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first AI voice agent to get started</p>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Create Agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card key={agent.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between pb-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <CardTitle className="text-base truncate">{agent.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className={agent.status === 'active' ? 'status-active' : 'status-inactive'}>
                      {agent.status ?? 'inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(agent)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(agent.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{getVoiceName(agent.voice_id)}</span>
                </div>
                {agent.prompt && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{agent.prompt}</p>
                )}
                <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t">
                  <span>{agent.total_calls ?? 0} calls</span>
                  <span>{Number(agent.total_minutes ?? 0).toFixed(1)} min</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
