import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Phone, CalendarDays, TrendingUp } from 'lucide-react';

export default function ClientDashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Dashboard</h1>
        <p className="page-description">Welcome to your VoiceOS workspace</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Active Agents', value: '0', icon: Bot, color: 'text-primary' },
          { title: 'Phone Numbers', value: '0', icon: Phone, color: 'text-success' },
          { title: 'Bookings', value: '0', icon: CalendarDays, color: 'text-warning' },
          { title: 'Minutes Used', value: '0', icon: TrendingUp, color: 'text-primary' },
        ].map((card) => (
          <Card key={card.title} className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-foreground">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Create your first AI voice agent in the <strong>Agents</strong> section</p>
          <p>2. Upload knowledge base files to improve agent responses</p>
          <p>3. Link a phone number to your agent to start receiving calls</p>
          <p>4. Monitor bookings and performance from this dashboard</p>
        </CardContent>
      </Card>
    </div>
  );
}
