import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClientId } from '@/hooks/useClientId';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays } from 'lucide-react';

interface Booking {
  id: string;
  booking_type: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  date_time: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
}

export default function ClientBookings() {
  const { clientId, loading: clientLoading } = useClientId();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!clientId) return;
    const fetchBookings = async () => {
      let query = supabase.from('bookings').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
      if (filter !== 'all') query = query.eq('status', filter);
      const { data } = await query;
      setBookings(data ?? []);
      setLoading(false);
    };
    fetchBookings();
  }, [clientId, filter]);

  const statusClass = (status: string | null) => {
    switch (status) {
      case 'confirmed': return 'status-active';
      case 'pending': return 'status-pending';
      case 'cancelled': return 'status-inactive';
      default: return 'status-pending';
    }
  };

  if (clientLoading) return <div className="text-muted-foreground p-8">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Bookings</h1>
          <p className="page-description">View bookings made by your AI agents</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-16">Loading...</div>
      ) : bookings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <CalendarDays className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">No bookings yet</h3>
            <p className="text-sm text-muted-foreground">Bookings will appear here when your agents handle calls</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="capitalize font-medium">{b.booking_type}</TableCell>
                    <TableCell>{b.customer_name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-sm">{b.customer_phone ?? '—'}</TableCell>
                    <TableCell className="text-sm">
                      {b.date_time ? new Date(b.date_time).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell>
                      <span className={statusClass(b.status)}>{b.status ?? 'pending'}</span>
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
