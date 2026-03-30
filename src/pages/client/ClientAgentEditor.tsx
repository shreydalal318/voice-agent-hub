import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useClientId } from '@/hooks/useClientId';
import { ELEVENLABS_VOICES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ChevronLeft, Plus, MoreHorizontal, FileText, Settings, Bot, Webhook, Wrench, Activity, Shield, Code, BarChart, Book, Play } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  voice_id: string | null;
  prompt: string | null;
  status: string | null;
  elevenlabs_agent_id: string | null;
}

export default function ClientAgentEditor() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { clientId } = useClientId();
  const isNewAgent = agentId === 'new';
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [voiceId, setVoiceId] = useState('');

  useEffect(() => {
    if (clientId && agentId) {
      if (agentId === 'new') {
        setName('New Agent');
        setLoading(false);
      } else {
        fetchAgent();
      }
    }
  }, [clientId, agentId]);

  const fetchAgent = async () => {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('client_id', clientId)
      .single();

    if (error) {
      toast.error('Agent not found');
      navigate('/dashboard/agents');
      return;
    }

    if (data) {
      setAgent(data);
      setName(data.name || '');
      setPrompt(data.prompt || '');
      setVoiceId(data.voice_id || '');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    if (agentId === 'new') {
      const { data, error } = await supabase.from('agents').insert({
        client_id: clientId,
        name,
        prompt,
        voice_id: voiceId || null,
      }).select().single();

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Agent created');
        navigate(`/dashboard/agents/${data.id}`, { replace: true });
      }
    } else {
      const { error } = await supabase.from('agents').update({
        name,
        prompt,
        voice_id: voiceId || null,
      }).eq('id', agentId);

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Agent updated');
      }
    }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading agent details...</div>;

  return (
    <div className="flex flex-col h-full bg-background animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/agents')}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold">
              <input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                  onBlur={isNewAgent ? undefined : handleSave}
                className="bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 -ml-1"
              />
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="px-2.5 py-1 text-xs font-medium rounded-full bg-secondary text-secondary-foreground border">
            Public
          </div>
          <Button variant="outline" size="sm">
            Variables
          </Button>
          <Button variant="outline" size="sm">
            Enable Versioning
          </Button>
          <Button size="sm" className="gap-2" onClick={handleSave} disabled={saving}>
            <Play className="w-4 h-4" />
            {saving ? 'Saving...' : 'Preview'}
          </Button>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <div className="flex-1 overflow-auto">
        <Tabs defaultValue="agent" className="w-full">
          <div className="px-6 border-b">
            <TabsList className="bg-transparent h-12 p-0 space-x-6">
              <TabsTrigger value="agent" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 font-medium">
                Agent
              </TabsTrigger>
              <TabsTrigger value="workflow" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 font-medium text-muted-foreground">
                Workflow
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 font-medium text-muted-foreground">
                Knowledge Base
              </TabsTrigger>
              <TabsTrigger value="analysis" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 font-medium text-muted-foreground">
                Analysis
              </TabsTrigger>
              <TabsTrigger value="tools" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 font-medium text-muted-foreground">
                Tools
              </TabsTrigger>
              <TabsTrigger value="tests" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 font-medium text-muted-foreground">
                Tests
              </TabsTrigger>
              <TabsTrigger value="widget" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 font-medium text-muted-foreground">
                Widget
              </TabsTrigger>
              <TabsTrigger value="security" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 font-medium text-muted-foreground">
                Security
              </TabsTrigger>
              <TabsTrigger value="advanced" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 font-medium text-muted-foreground">
                Advanced
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6 max-w-7xl mx-auto">
            {/* AGENT TAB */}
            <TabsContent value="agent" className="m-0 focus-visible:outline-none focus-visible:-ring-2">
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Left Column */}
                <div className="flex-1 space-y-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label className="text-base font-semibold">System prompt</Label>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card relative shadow-sm">
                      <Textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onBlur={isNewAgent ? undefined : handleSave}
                        placeholder="You are a helpful voice assistant..."
                        className="min-h-[160px] border-0 focus-visible:ring-0 resize-y p-4 text-sm"
                      />
                      <div className="p-3 border-t bg-muted/20 flex items-center justify-between text-sm text-muted-foreground">
                        <button className="hover:text-foreground">Type &#123;&#123; to add variables</button>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Switch id="default-personality" />
                            <Label htmlFor="default-personality" className="text-xs">Default personality</Label>
                          </div>
                          <Button variant="outline" size="sm" className="h-7 text-xs">Set timezone</Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-semibold block">First message</Label>
                        <span className="text-sm text-muted-foreground">The first message the agent will say. If empty, the agent will wait for the user to start the conversation.</span>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card relative shadow-sm">
                      <Textarea 
                        placeholder="Hello! How can I help you today?"
                        className="min-h-[100px] border-0 focus-visible:ring-0 resize-y p-4 text-sm"
                        defaultValue="Hello! How can I help you regarding Powermind Automation today?"
                      />
                      <div className="p-3 border-t bg-muted/20 flex items-center justify-between text-sm text-muted-foreground">
                        <button className="hover:text-foreground">Type &#123;&#123; to add variables</button>
                        <div className="flex items-center gap-2">
                          <Switch id="interruptible" defaultChecked />
                          <Label htmlFor="interruptible" className="text-xs">Interruptible</Label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="w-full lg:w-[380px] space-y-8">
                  <div className="space-y-3 relative">
                    <div>
                      <Label className="text-base font-semibold block">Voices</Label>
                      <span className="text-sm text-muted-foreground">Select the ElevenLabs voices you want to use for the agent.</span>
                    </div>
                    <div className="border rounded-lg bg-card shadow-sm p-1 divide-y">
                      <div className="p-3 flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center">
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Eric" alt="avatar" className="w-full h-full" />
                          </div>
                          <Select 
                            value={voiceId} 
                            onValueChange={(v) => {
                              setVoiceId(v);
                              if (!isNewAgent) void handleSave();
                            }}
                          >
                            <SelectTrigger className="border-0 h-auto p-0 focus:ring-0 shadow-none font-medium gap-2">
                              <SelectValue placeholder="Select Voice" />
                            </SelectTrigger>
                            <SelectContent>
                              {ELEVENLABS_VOICES.map((v) => (
                                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <span className="text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground">Primary</span>
                      </div>
                      <button className="w-full text-left p-3 text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Add additional voice
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-base font-semibold block">Language</Label>
                      <span className="text-sm text-muted-foreground">Choose the default and additional languages the agent will communicate in.</span>
                    </div>
                    <div className="border rounded-lg bg-card shadow-sm p-1 divide-y">
                      <div className="p-3 flex items-center justify-between group">
                        <div className="flex items-center gap-3 font-medium text-sm">
                          🇺🇸 English
                        </div>
                        <span className="text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground">Default</span>
                      </div>
                      <button className="w-full text-left p-3 text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Add additional languages
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <Label className="text-base font-semibold block">LLM</Label>
                      <span className="text-sm text-muted-foreground">Select which provider and model to use for the LLM.</span>
                    </div>
                    <div className="border rounded-lg bg-card shadow-sm p-1">
                      <Select defaultValue="gemini">
                        <SelectTrigger className="border-0 h-auto p-3 focus:ring-0 shadow-none font-medium text-sm">
                          <SelectValue placeholder="Select LLM" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gemini">Gemini 2.5 Flash</SelectItem>
                          <SelectItem value="gpt4">GPT-4o Mini</SelectItem>
                          <SelectItem value="claude">Claude 3.5 Haiku</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                </div>
              </div>
            </TabsContent>

            {/* KNOWLEDGE BASE TAB */}
            <TabsContent value="knowledge" className="m-0 focus-visible:outline-none focus-visible:-ring-2">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold tracking-tight">Agent Knowledge Base</h2>
                  <div className="flex items-center gap-3">
                    <Button variant="outline">Configure RAG</Button>
                    <Button className="bg-foreground text-background hover:bg-foreground/90">Add document</Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <Input placeholder="Search Knowledge Base..." className="w-full pl-10 bg-card" />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs rounded-full">+ Type</Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs rounded-full">+ Creator</Button>
                  </div>
                </div>

                <div className="border border-dashed rounded-xl p-16 flex flex-col items-center justify-center text-center mt-6 bg-card/30">
                  <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mb-4">
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-1">No documents found</h3>
                  <p className="text-sm text-muted-foreground mb-6">This agent has no attached documents yet.</p>
                  <Button className="bg-foreground text-background hover:bg-foreground/90">Add document</Button>
                </div>
              </div>
            </TabsContent>

            {/* ANALYSIS TAB */}
            <TabsContent value="analysis" className="m-0 focus-visible:outline-none focus-visible:-ring-2">
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold tracking-tight">Analysis</h2>
                
                <div className="flex flex-col lg:flex-row gap-8">
                  <div className="flex-1 space-y-4">
                    <div className="relative">
                      <Input placeholder="Search conversations..." className="w-full pl-10 bg-card" />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {['Date After', 'Date Before', 'Call status', 'Criteria', 'Data', 'Duration', 'Rating', 'Comments', 'Tools', 'Language', 'User', 'Channel'].map(filter => (
                        <Button key={filter} variant="outline" size="sm" className="h-8 text-xs rounded-full bg-card">
                          + {filter}
                        </Button>
                      ))}
                    </div>

                    <div className="border rounded-xl p-16 flex flex-col items-center justify-center text-center mt-6 bg-card/30">
                      <div className="w-12 h-12 flex items-center justify-center mb-4 opacity-50">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                      </div>
                      <h3 className="text-lg font-medium mb-1">No conversations found</h3>
                      <p className="text-sm text-muted-foreground">This agent has no conversations yet.</p>
                    </div>
                  </div>

                  <div className="w-full lg:w-[350px] space-y-6">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-semibold block">Evaluation criteria</Label>
                        <span className="text-xs text-muted-foreground">Define criteria to evaluate whether conversations were successful or not.</span>
                      </div>
                      <div className="flex items-center justify-between bg-card border rounded-lg p-3 text-sm">
                        <span className="text-muted-foreground">0 criteria</span>
                        <Button variant="ghost" size="sm" className="h-6 text-xs">+ Add criteria</Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-semibold block">Data collection</Label>
                        <span className="text-xs text-muted-foreground">Define custom data specifications to extract from conversation transcripts.</span>
                      </div>
                      <div className="flex items-center justify-between bg-card border rounded-lg p-3 text-sm">
                        <span className="text-muted-foreground">0 data points</span>
                        <Button variant="ghost" size="sm" className="h-6 text-xs">+ Add data point</Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-semibold block">Analysis Language</Label>
                        <span className="text-xs text-muted-foreground">Language will be inferred from the conversation content.</span>
                      </div>
                      <Select defaultValue="auto">
                        <SelectTrigger className="bg-card w-full">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto (infer from conversation)</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Placeholder Tabs */}
            {['workflow', 'tools', 'tests', 'widget', 'security', 'advanced'].map(tab => (
              <TabsContent key={tab} value={tab} className="m-0 focus-visible:outline-none focus-visible:-ring-2">
                <div className="py-20 text-center text-muted-foreground">
                  <h3 className="text-lg font-medium capitalize mb-2">{tab} settings</h3>
                  <p className="text-sm">This section is currently under development.</p>
                </div>
              </TabsContent>
            ))}

          </div>
        </Tabs>
      </div>
    </div>
  );
}
