import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClientId } from '@/hooks/useClientId';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Phone } from 'lucide-react';

interface PhoneNumber {
  id: string;
  number: string;
  label: string | null;
  status: string | null;
  assigned_agent_id: string | null;
}

interface AgentOption {
  id: string;
  name: string;
}

export default function ClientPhoneNumbers() {
  const { clientId, loading: clientLoading } = useClientId();
  const [phones, setPhones] = useState<PhoneNumber[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!clientId) return;
    const [phonesRes, agentsRes] = await Promise.all([
      supabase.from('phone_numbers').select('*').eq('assigned_client_id', clientId),
      supabase.from('agents').select('id, name').eq('client_id', clientId),
    ]);
    setPhones(phonesRes.data ?? []);
    setAgents(agentsRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (clientId) fetchData(); }, [clientId]);

  const linkAgent = async (phoneId: string, agentId: string) => {
    const actualAgentId = agentId === 'none' ? null : agentId;
    const { error } = await supabase.from('phone_numbers').update({
      assigned_agent_id: actualAgentId,
    }).eq('id', phoneId);
    if (error) toast.error(error.message);
    else {
      toast.success('Phone number updated');
      fetchData();
    }
  };

  if (clientLoading) return <div className="text-muted-foreground p-8">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Phone Numbers</h1>
        <p className="page-description">View your assigned numbers and link them to agents</p>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-16">Loading...</div>
      ) : phones.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Phone className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">No phone numbers assigned</h3>
            <p className="text-sm text-muted-foreground">Contact your admin to get a phone number assigned</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Linked Agent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phones.map((phone) => (
                  <TableRow key={phone.id}>
                    <TableCell className="font-mono">{phone.number}</TableCell>
                    <TableCell>{phone.label ?? '—'}</TableCell>
                    <TableCell>
                      <Select
                        value={phone.assigned_agent_id ?? 'none'}
                        onValueChange={(v) => linkAgent(phone.id, v)}
                      >
                        <SelectTrigger className="w-48 h-8">
                          <SelectValue placeholder="Select agent..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— No agent —</SelectItem>
                          {agents.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
