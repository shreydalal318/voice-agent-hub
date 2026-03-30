import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClientId } from '@/hooks/useClientId';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Phone } from 'lucide-react';

interface PhoneNumber {
  id: string;
  number: string;
  label: string | null;
  status: string | null;
  assigned_agent_id: string | null;
  elevenlabs_phone_number_id: string | null;
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
  const [dialToByPhoneId, setDialToByPhoneId] = useState<Record<string, string>>({});

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

      // Keep ElevenLabs inbound agent assignment in sync with the selected agent.
      // This enables inbound calls to be routed to the correct agent.
      const { error: syncError, data: syncData } = await supabase.functions.invoke(
        'sync-elevenlabs-phone-number-agent',
        { body: { phoneNumberId: phoneId, agentId: actualAgentId } },
      );
      if (syncError || syncData?.error) {
        toast.error(syncData?.error ?? syncError?.message ?? 'Failed to sync to ElevenLabs');
      } else {
        toast.success('Inbound routing updated');
      }

      fetchData();
    }
  };

  const initiateOutboundCall = async (phone: PhoneNumber) => {
    const to = (dialToByPhoneId[phone.id] ?? '').trim();
    if (!to) {
      toast.error('Enter a destination number first');
      return;
    }
    if (!phone.assigned_agent_id) {
      toast.error('Assign an agent to this number first');
      return;
    }
    if (!phone.elevenlabs_phone_number_id) {
      toast.error('This number is not synced into ElevenLabs yet (ask admin to sync it)');
      return;
    }

    const { data, error } = await supabase.functions.invoke('initiate-outbound-call', {
      body: {
        phoneNumberId: phone.id,
        toNumber: to,
      },
    });

    const typed = data as { error?: string; message?: string; success?: boolean } | null;
    if (error) {
      toast.error(error.message || 'Failed to start call');
      return;
    }

    if (typed?.error) {
      toast.error(typed.error);
      return;
    }

    if (typed?.success === false || typed?.message) {
      toast.error(typed.message || 'Failed to start call');
      return;
    }

    toast.success('Call initiated');
    setDialToByPhoneId((prev) => ({ ...prev, [phone.id]: '' }));
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
                  <TableHead>Dial</TableHead>
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
                    <TableCell className="w-72">
                      <div className="flex items-center gap-2">
                        <Input
                          value={dialToByPhoneId[phone.id] ?? ''}
                          onChange={(e) => setDialToByPhoneId((prev) => ({ ...prev, [phone.id]: e.target.value }))}
                          placeholder="To number (e.g. +14155550100)"
                          className="h-8"
                        />
                        <Button
                          size="sm"
                          onClick={() => initiateOutboundCall(phone)}
                          disabled={!phone.assigned_agent_id || !phone.elevenlabs_phone_number_id || !(dialToByPhoneId[phone.id] ?? '').trim()}
                        >
                          Dial
                        </Button>
                      </div>
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
