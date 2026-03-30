import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Link2, Unlink, RefreshCcw, Trash2 } from 'lucide-react';

interface PhoneNumber {
  id: string;
  number: string;
  label: string | null;
  status: string | null;
  assigned_client_id: string | null;
  assigned_agent_id: string | null;
  vobiz_phone_number_id: string | null;
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

  // Vobiz Inventory Purchase
  const [inventoryCountry, setInventoryCountry] = useState<string>('');
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryPerPage, setInventoryPerPage] = useState(10);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [inventoryItems, setInventoryItems] = useState<
    Array<{
      id: string;
      e164: string;
      country: string;
      region: string;
      setup_fee: number | string | null;
      monthly_fee: number | string | null;
      currency: string | null;
    }>
  >([]);

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
    const { data: inserted, error } = await supabase
      .from('phone_numbers')
      .insert({
      number: form.number,
      label: form.label || null,
      })
      .select('id')
      .single();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Phone number added');

      // Sync/import this number into ElevenLabs using Vobiz SIP trunk credentials.
      // (This requires that you set the required Supabase Edge Function secrets.)
      if (inserted?.id) {
        const { data: importData, error: importError } = await supabase.functions.invoke(
          'import-vobiz-phone-number',
          { body: { phoneNumberId: inserted.id } },
        );

        if (importError || importData?.error) {
          toast.error(importData?.error ?? importError?.message ?? 'Failed to sync with ElevenLabs');
        } else {
          toast.success('Synced to ElevenLabs');
        }
      }

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

  const handleSyncToElevenLabs = async (phoneId: string) => {
    const { data, error } = await supabase.functions.invoke('import-vobiz-phone-number', {
      body: { phoneNumberId: phoneId, force: true },
    });

    if (error || data?.error) {
      toast.error(data?.error ?? error?.message ?? 'Failed to sync to ElevenLabs');
      return;
    }

    toast.success('Synced to ElevenLabs');
    fetchData();
  };

  const loadInventory = async (opts?: { page?: number; per_page?: number; country?: string }) => {
    const page = typeof opts?.page === 'number' && Number.isFinite(opts.page) ? opts.page : inventoryPage;
    const perPage = typeof opts?.per_page === 'number' && Number.isFinite(opts.per_page) ? opts.per_page : inventoryPerPage;
    const country = typeof opts?.country === 'string' ? opts.country : inventoryCountry;
    setInventoryLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'vobiz-list-inventory-phone-numbers',
        {
          body: {
            country: country || undefined,
            page,
            per_page: perPage,
          },
        },
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setInventoryItems(data?.items ?? []);
      setInventoryTotal(data?.total ?? 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load inventory';
      toast.error(msg);
    } finally {
      setInventoryLoading(false);
    }
  };

  const purchaseInventoryItem = async (item: { e164: string; currency: string | null; id: string }) => {
    const confirmed = window.confirm(`Purchase ${item.e164} from Vobiz inventory? This will debit your balance.`);
    if (!confirmed) return;

    const { data, error } = await supabase.functions.invoke('vobiz-purchase-from-inventory', {
      body: {
        e164: item.e164,
        currency: item.currency ?? undefined,
      },
    });

    if (error || data?.error) {
      toast.error(data?.error ?? error?.message ?? 'Failed to purchase');
      return;
    }

    if (data?.trunk_assignment_error) {
      const msg = typeof data.trunk_assignment_error === 'string'
        ? data.trunk_assignment_error
        : (data.trunk_assignment_error?.message ?? JSON.stringify(data.trunk_assignment_error));
      toast.error(`Purchased, but failed to assign to Vobiz trunk: ${msg}`);
    } else {
      toast.success('Number purchased successfully');
    }

    // After purchase, sync it into ElevenLabs automatically (so clients can use it).
    if (data?.phone_number_id) {
      const { error: syncErr, data: syncData } = await supabase.functions.invoke(
        'import-vobiz-phone-number',
        { body: { phoneNumberId: data.phone_number_id, force: true } },
      );
      if (syncErr || syncData?.error) {
        toast.error(syncData?.error ?? syncErr?.message ?? 'Purchased but failed to sync into ElevenLabs');
      }
    }

    fetchData();
  };

  const releasePhoneNumber = async (phone: PhoneNumber) => {
    if (!phone.vobiz_phone_number_id) {
      toast.error('This number is not present in Vobiz (can’t release).');
      return;
    }

    const confirmed = window.confirm(`Release ${phone.number} back to Vobiz inventory? This cannot be undone.`);
    if (!confirmed) return;

    const { data, error } = await supabase.functions.invoke('vobiz-release-phone-number', {
      body: { e164: phone.number },
    });

    if (error || data?.error) {
      toast.error(data?.error ?? error?.message ?? 'Failed to release number');
      return;
    }

    toast.success('Number released to inventory');
    fetchData();
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
        <CardHeader>
          <CardTitle className="text-base">Purchase From Vobiz Inventory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="space-y-2">
              <Label className="text-sm">Country Code (optional)</Label>
              <Input
                value={inventoryCountry}
                onChange={(e) => setInventoryCountry(e.target.value)}
                placeholder="e.g. IN"
                className="w-40"
              />
            </div>
            <Button
              onClick={() => {
                const firstPage = 1;
                setInventoryPage(firstPage);
                void loadInventory({ page: firstPage });
              }}
              disabled={inventoryLoading}
            >
              {inventoryLoading ? 'Loading...' : 'Load Inventory'}
            </Button>
          </div>

          {inventoryItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Load inventory to see available numbers you can purchase.
            </div>
          ) : (
            <div className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Setup Fee</TableHead>
                    <TableHead>Monthly Fee</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="w-28">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.e164}</TableCell>
                      <TableCell>{item.setup_fee ?? '—'}</TableCell>
                      <TableCell>{item.monthly_fee ?? '—'}</TableCell>
                      <TableCell>{item.currency ?? '—'}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => purchaseInventoryItem({ e164: item.e164, currency: item.currency, id: item.id })}
                          disabled={inventoryLoading}
                        >
                          Purchase
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={inventoryPage <= 1 || inventoryLoading}
                  onClick={() => {
                    const next = Math.max(1, inventoryPage - 1);
                    setInventoryPage(next);
                    void loadInventory({ page: next });
                  }}
                >
                  Prev
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {inventoryPage} / {Math.max(1, Math.ceil(inventoryTotal / inventoryPerPage))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={inventoryLoading || inventoryPage >= Math.ceil(inventoryTotal / inventoryPerPage)}
                  onClick={() => {
                    const next = inventoryPage + 1;
                    setInventoryPage(next);
                    void loadInventory({ page: next });
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead className="w-24">Actions</TableHead>
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
                      <div className="flex items-center gap-2">
                        {phone.vobiz_phone_number_id ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => releasePhoneNumber(phone)}
                            title="Release this Vobiz number back to inventory"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSyncToElevenLabs(phone.id)}
                          title="Sync this Vobiz number into ElevenLabs again"
                        >
                          <RefreshCcw className="w-4 h-4" />
                        </Button>

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
                      </div>
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
