import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClientId } from '@/hooks/useClientId';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Upload, FileText, Trash2, BookOpen } from 'lucide-react';

interface KnowledgeItem {
  id: string;
  title: string;
  content: string | null;
  file_url: string | null;
  file_type: string | null;
  agent_id: string | null;
  created_at: string;
}

interface AgentOption {
  id: string;
  name: string;
}

export default function ClientKnowledge() {
  const { clientId, loading: clientLoading } = useClientId();
  const { user } = useAuth();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<'text' | 'file'>('text');
  const [form, setForm] = useState({ title: '', content: '', agent_id: '' });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    if (!clientId) return;
    const [kbRes, agentsRes] = await Promise.all([
      supabase.from('knowledge_base').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('agents').select('id, name').eq('client_id', clientId),
    ]);
    setItems(kbRes.data ?? []);
    setAgents(agentsRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (clientId) fetchData(); }, [clientId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !user) return;
    setSaving(true);

    let fileUrl: string | null = null;
    let fileType: string | null = null;

    if (mode === 'file' && file) {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('knowledge-files').upload(path, file);
      if (uploadError) {
        toast.error('File upload failed: ' + uploadError.message);
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('knowledge-files').getPublicUrl(path);
      fileUrl = urlData.publicUrl;
      fileType = file.type;
    }

    const { error } = await supabase.from('knowledge_base').insert({
      client_id: clientId,
      title: form.title,
      content: mode === 'text' ? form.content : null,
      file_url: fileUrl,
      file_type: fileType,
      agent_id: form.agent_id || null,
    });

    if (error) toast.error(error.message);
    else {
      toast.success('Knowledge added');
      setDialogOpen(false);
      setForm({ title: '', content: '', agent_id: '' });
      setFile(null);
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('knowledge_base').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Deleted');
      fetchData();
    }
  };

  const getAgentName = (id: string | null) => {
    if (!id) return 'All agents';
    return agents.find(a => a.id === id)?.name ?? 'Unknown';
  };

  if (clientLoading) return <div className="text-muted-foreground p-8">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Knowledge Base</h1>
          <p className="page-description">Upload files and add knowledge to improve agent responses</p>
        </div>
        <Button size="sm" onClick={() => { setDialogOpen(true); setMode('text'); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Knowledge
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-16">Loading...</div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">No knowledge yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Add documents or text to help your agents answer better</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setDialogOpen(true); setMode('file'); }}>
                <Upload className="w-4 h-4 mr-1" /> Upload File
              </Button>
              <Button onClick={() => { setDialogOpen(true); setMode('text'); }}>
                <FileText className="w-4 h-4 mr-1" /> Add Text
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>
                      <span className={item.file_url ? 'status-active' : 'status-pending'}>
                        {item.file_url ? 'File' : 'Text'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{getAgentName(item.agent_id)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Knowledge</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-4">
            <Button variant={mode === 'text' ? 'default' : 'outline'} size="sm" onClick={() => setMode('text')}>
              <FileText className="w-4 h-4 mr-1" /> Text
            </Button>
            <Button variant={mode === 'file' ? 'default' : 'outline'} size="sm" onClick={() => setMode('file')}>
              <Upload className="w-4 h-4 mr-1" /> File
            </Button>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Business FAQ"
                required
              />
            </div>
            {mode === 'text' ? (
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Enter knowledge content..."
                  rows={6}
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>File (PDF, TXT, DOCX)</Label>
                <Input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.txt,.doc,.docx"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Assign to Agent (optional)</Label>
              <Select value={form.agent_id} onValueChange={(v) => setForm({ ...form, agent_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="All agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All agents</SelectItem>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Saving...' : 'Add Knowledge'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
