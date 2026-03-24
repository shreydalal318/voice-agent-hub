import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClientId } from '@/hooks/useClientId';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Save, Webhook, Calendar, Link2 } from 'lucide-react';

export default function ClientSettings() {
  const { clientId, loading: clientLoading } = useClientId();
  const { signOut } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [crmApiKey, setCrmApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    supabase.from('clients').select('business_name, business_type').eq('id', clientId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBusinessName(data.business_name);
          setBusinessType(data.business_type);
        }
      });
  }, [clientId]);

  const handleSaveBusiness = async () => {
    if (!clientId) return;
    setSaving(true);
    const { error } = await supabase.from('clients').update({
      business_name: businessName,
      business_type: businessType,
    }).eq('id', clientId);
    if (error) toast.error(error.message);
    else toast.success('Business info updated');
    setSaving(false);
  };

  if (clientLoading) return <div className="text-muted-foreground p-8">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="page-header">Settings</h1>
        <p className="page-description">Manage your account and integrations</p>
      </div>

      {/* Business Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Business Name</Label>
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Business Type</Label>
            <Input value={businessType} onChange={(e) => setBusinessType(e.target.value)} disabled />
          </div>
          <Button size="sm" onClick={handleSaveBusiness} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Webhook */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Webhook URL</Label>
            </div>
            <p className="text-xs text-muted-foreground">Receive booking notifications at this URL</p>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-app.com/webhook"
              />
              <Button size="sm" variant="outline" onClick={() => toast.success('Webhook saved (demo)')}>
                Save
              </Button>
            </div>
          </div>

          <Separator />

          {/* Google Calendar */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Google Calendar</Label>
            </div>
            <p className="text-xs text-muted-foreground">Sync bookings to your Google Calendar</p>
            <Button size="sm" variant="outline" disabled>
              <Link2 className="w-4 h-4 mr-1" /> Connect Google Calendar (Coming Soon)
            </Button>
          </div>

          <Separator />

          {/* CRM */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">CRM Integration</Label>
            </div>
            <p className="text-xs text-muted-foreground">Connect your CRM via API key or webhook</p>
            <div className="flex gap-2">
              <Input
                type="password"
                value={crmApiKey}
                onChange={(e) => setCrmApiKey(e.target.value)}
                placeholder="CRM API Key"
              />
              <Button size="sm" variant="outline" onClick={() => toast.success('CRM key saved (demo)')}>
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={signOut}>
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
