import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ELEVENLABS_VOICES, BUSINESS_USE_CASES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { AudioLines, Building2, Bot, Rocket, CheckCircle2, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';

const STEPS = ['Business Profile', 'Agent Goals', 'Voice & Launch'];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [provisioning, setProvisioning] = useState(false);
  const [done, setDone] = useState(false);

  const [form, setForm] = useState({
    business_name: '',
    business_type: 'other',
    business_details: '',
    agent_name: '',
    agent_goals: '',
    voice_id: 'JBFqnCBsd6RMkjVDRZzb',
  });

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const canProceed = () => {
    if (step === 0) return form.business_name.trim().length > 0;
    if (step === 1) return form.agent_goals.trim().length > 0;
    return true;
  };

  const handleProvision = async () => {
    setProvisioning(true);
    try {
      const { data, error } = await supabase.functions.invoke('provision-agent', {
        body: form,
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Provisioning failed');
      }

      setDone(true);
      toast.success('Your AI agent is live!');

      // Hard redirect to flush state
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create agent');
      setProvisioning(false);
    }
  };

  const stepIcons = [Building2, Bot, Rocket];

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center animate-fade-in space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">You're all set!</h1>
          <p className="text-muted-foreground">Your AI agent has been provisioned and is ready to go.</p>
          <p className="text-sm text-muted-foreground">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <AudioLines className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">VoiceOS</span>
          <span className="text-muted-foreground text-sm ml-2">Setup your workspace</span>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-2xl space-y-6 animate-fade-in">
          {/* Progress Steps */}
          <div className="flex items-center justify-between">
            {STEPS.map((label, i) => {
              const Icon = stepIcons[i];
              const isActive = i === step;
              const isCompleted = i < step;
              return (
                <div key={label} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    isActive ? 'bg-primary text-primary-foreground' :
                    isCompleted ? 'bg-primary/20 text-primary' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-sm hidden sm:block ${isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-px mx-2 ${i < step ? 'bg-primary/40' : 'bg-border'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step Content */}
          <Card className="border shadow-sm">
            {step === 0 && (
              <>
                <CardHeader>
                  <CardTitle>Tell us about your business</CardTitle>
                  <CardDescription>This helps us configure your AI agent with the right context</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Business Name *</Label>
                    <Input
                      value={form.business_name}
                      onChange={(e) => update('business_name', e.target.value)}
                      placeholder="e.g. Sunrise Medical Clinic"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <Select value={form.business_type} onValueChange={(v) => update('business_type', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="doctor">Healthcare / Medical</SelectItem>
                        <SelectItem value="restaurant">Restaurant / Food Service</SelectItem>
                        <SelectItem value="hotel">Hospitality / Hotel</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Business Details</Label>
                    <Textarea
                      value={form.business_details}
                      onChange={(e) => update('business_details', e.target.value)}
                      placeholder="Describe your business: services offered, operating hours, location, special instructions..."
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">The more detail you provide, the smarter your agent will be.</p>
                  </div>
                </CardContent>
              </>
            )}

            {step === 1 && (
              <>
                <CardHeader>
                  <CardTitle>Define your agent's goals</CardTitle>
                  <CardDescription>What should your AI agent do when handling calls?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Agent Name</Label>
                    <Input
                      value={form.agent_name}
                      onChange={(e) => update('agent_name', e.target.value)}
                      placeholder={`${form.business_name || 'My'} Assistant`}
                    />
                  </div>
                  {BUSINESS_USE_CASES[form.business_type] && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Suggested use cases for your industry:</Label>
                      <div className="flex flex-wrap gap-2">
                        {BUSINESS_USE_CASES[form.business_type].map((uc) => (
                          <button
                            key={uc}
                            type="button"
                            onClick={() => update('agent_goals', form.agent_goals ? `${form.agent_goals}\n- ${uc}` : `- ${uc}`)}
                            className="text-xs px-2.5 py-1 rounded-full border bg-card hover:bg-accent transition-colors text-foreground"
                          >
                            + {uc}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Agent Goals & Instructions *</Label>
                    <Textarea
                      value={form.agent_goals}
                      onChange={(e) => update('agent_goals', e.target.value)}
                      placeholder="Example:&#10;- Book appointments for patients&#10;- Collect patient name, phone number, and preferred time&#10;- Confirm availability before booking&#10;- Handle cancellations and rescheduling"
                      rows={6}
                    />
                  </div>
                </CardContent>
              </>
            )}

            {step === 2 && (
              <>
                <CardHeader>
                  <CardTitle>Choose a voice & launch</CardTitle>
                  <CardDescription>Select the voice personality for your AI agent</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Voice</Label>
                    <Select value={form.voice_id} onValueChange={(v) => update('voice_id', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ELEVENLABS_VOICES.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name} — {voice.gender}, {voice.accent}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Summary */}
                  <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                    <h4 className="font-medium text-foreground">Summary</h4>
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <span>Business:</span>
                      <span className="text-foreground">{form.business_name}</span>
                      <span>Industry:</span>
                      <span className="text-foreground capitalize">{form.business_type}</span>
                      <span>Agent:</span>
                      <span className="text-foreground">{form.agent_name || `${form.business_name} Assistant`}</span>
                      <span>Voice:</span>
                      <span className="text-foreground">{ELEVENLABS_VOICES.find(v => v.id === form.voice_id)?.name ?? 'George'}</span>
                    </div>
                  </div>
                </CardContent>
              </>
            )}
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>

            {step < 2 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>
                Continue <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleProvision} disabled={provisioning}>
                {provisioning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Provisioning Agent...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 mr-1" /> Launch Agent
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
