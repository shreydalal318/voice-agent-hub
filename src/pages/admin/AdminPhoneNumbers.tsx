import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Link2, Unlink } from 'lucide-react';

interface PhoneNumber {
  id: string;
  number: string;
  label: string | null;
  status: string | null;
  assigned_client_id: string | null;
  assigned_agent_id: string | null;
  created_at: string;
}

interface ClientOption {
  id: string;
  business_name: string;
}

export default function AdminPhoneNumbers() {
  const [phones, setPhones] = useState<PhoneNumber[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ number: '', label: '' });
  const [assignDialog, setAssignDialog] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState('');

  const fetchData = async () => {
    const [phonesRes, clientsRes] = await Promise.all([
      supabase.from('phone_numbers').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, business_name'),
    ]);
    setPhones(phonesRes.data ?? []);
    setClients(clientsRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('phone_numbers').insert({
      number: form.number,
      label: form.label || null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Phone number added');
      setDialogOpen(false);
      setForm({ number: '', label: '' });
      fetchData();
    }
  };

  const handleAssign = async (phoneId: string) => {
    const { error } = await supabase.from('phone_numbers').update({
      assigned_client_id: selectedClient || null,
      status: selectedClient ? 'assigned' : 'available',
    }).eq('id', phoneId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(selectedClient ? 'Number assigned' : 'Number unassigned');
      setAssignDialog(null);
      setSelectedClient('');
      fetchData();
    }
  };

  const getClientName = (id: string | null) => {
    if (!id) return '—';
    return clients.find(c => c.id === id)?.business_name ?? 'Unknown';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Phone Numbers</h1>
          <p className="page-description">Manage and assign phone numbers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> Add Number
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Phone Number</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Label (optional)</Label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="Main line"
                />
              </div>
              <Button type="submit" className="w-full">Add Number</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading...</TableCell>
                </TableRow>
              ) : phones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No phone numbers yet.</TableCell>
                </TableRow>
              ) : (
                phones.map((phone) => (
                  <TableRow key={phone.id}>
                    <TableCell className="font-mono text-sm">{phone.number}</TableCell>
                    <TableCell>{phone.label ?? '—'}</TableCell>
                    <TableCell>
                      <span className={phone.status === 'assigned' ? 'status-active' : 'status-inactive'}>
                        {phone.status ?? 'available'}
                      </span>
                    </TableCell>
                    <TableCell>{getClientName(phone.assigned_client_id)}</TableCell>
                    <TableCell>
                      <Dialog open={assignDialog === phone.id} onOpenChange={(o) => setAssignDialog(o ? phone.id : null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            {phone.assigned_client_id ? <Unlink className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Assign {phone.number}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Client</Label>
                              <Select value={selectedClient} onValueChange={setSelectedClient}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select client..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">— Unassign —</SelectItem>
                                  {clients.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button className="w-full" onClick={() => handleAssign(phone.id)}>
                              Save Assignment
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
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
