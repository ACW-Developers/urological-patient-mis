import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  Calendar, 
  FlaskConical, 
  Pill, 
  Syringe, 
  BedDouble,
  Activity,
  TrendingUp,
  Clock,
  Heart
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(199, 89%, 48%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(280, 68%, 60%)', 'hsl(0, 72%, 51%)'];

export default function Dashboard() {
  const { role } = useAuth();

  // Fetch dashboard stats
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const [patients, appointments, labTests, prescriptions, surgeries, icuAdmissions] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact' }),
        supabase.from('appointments').select('id', { count: 'exact' }).eq('appointment_date', today),
        supabase.from('lab_tests').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('prescriptions').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('surgeries').select('id', { count: 'exact' }).eq('scheduled_date', today),
        supabase.from('icu_admissions').select('id', { count: 'exact' }).eq('status', 'admitted'),
      ]);

      return {
        totalPatients: patients.count || 0,
        todayAppointments: appointments.count || 0,
        pendingLabTests: labTests.count || 0,
        pendingPrescriptions: prescriptions.count || 0,
        todaySurgeries: surgeries.count || 0,
        icuOccupancy: icuAdmissions.count || 0,
      };
    },
  });

  // Sample chart data (would be fetched from DB in production)
  const weeklyPatients = [
    { day: 'Mon', patients: 12 },
    { day: 'Tue', patients: 19 },
    { day: 'Wed', patients: 15 },
    { day: 'Thu', patients: 22 },
    { day: 'Fri', patients: 18 },
    { day: 'Sat', patients: 8 },
    { day: 'Sun', patients: 5 },
  ];

  const departmentData = [
    { name: 'Cardiology', value: 45 },
    { name: 'ICU', value: 15 },
    { name: 'Surgery', value: 25 },
    { name: 'Recovery', value: 15 },
  ];

  const statCards = [
    { 
      title: 'Total Patients', 
      value: stats?.totalPatients || 0, 
      icon: Users, 
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      roles: ['admin', 'nurse', 'doctor'] 
    },
    { 
      title: "Today's Appointments", 
      value: stats?.todayAppointments || 0, 
      icon: Calendar, 
      color: 'text-success',
      bgColor: 'bg-success/10',
      roles: ['admin', 'nurse', 'doctor'] 
    },
    { 
      title: 'Pending Lab Tests', 
      value: stats?.pendingLabTests || 0, 
      icon: FlaskConical, 
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      roles: ['admin', 'doctor', 'lab_technician'] 
    },
    { 
      title: 'Pending Prescriptions', 
      value: stats?.pendingPrescriptions || 0, 
      icon: Pill, 
      color: 'text-info',
      bgColor: 'bg-info/10',
      roles: ['admin', 'pharmacist', 'doctor'] 
    },
    { 
      title: "Today's Surgeries", 
      value: stats?.todaySurgeries || 0, 
      icon: Syringe, 
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      roles: ['admin', 'doctor', 'nurse'] 
    },
    { 
      title: 'ICU Occupancy', 
      value: stats?.icuOccupancy || 0, 
      icon: BedDouble, 
      color: 'text-chart-4',
      bgColor: 'bg-purple-500/10',
      roles: ['admin', 'doctor', 'nurse'] 
    },
  ];

  const filteredStats = statCards.filter(card => 
    role && card.roles.includes(role)
  );

  return (
    <div className="space-y-6 lg:space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-xl sm:text-2xl lg:text-3xl">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Overview of your cardiovascular patient registry
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        {filteredStats.map((stat) => (
          <Card key={stat.title} className="stat-card">
            <CardContent className="p-4 sm:pt-6 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{stat.title}</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold font-display mt-1 sm:mt-2">{stat.value}</p>
                </div>
                <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${stat.bgColor} flex-shrink-0`}>
                  <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Patient Admissions Chart */}
        <Card className="glass-card">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Weekly Patient Admissions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="h-[200px] sm:h-[250px] lg:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyPatients}>
                  <defs>
                    <linearGradient id="patientGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" className="text-muted-foreground text-xs" tick={{ fontSize: 10 }} />
                  <YAxis className="text-muted-foreground text-xs" tick={{ fontSize: 10 }} width={30} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="patients" 
                    stroke="hsl(199, 89%, 48%)" 
                    strokeWidth={2}
                    fill="url(#patientGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Department Distribution */}
        <Card className="glass-card">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Department Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="h-[180px] sm:h-[220px] lg:h-[260px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departmentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {departmentData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mt-3 sm:mt-4">
              {departmentData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 sm:w-3 sm:h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-xs sm:text-sm text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="glass-card">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {role && ['admin', 'nurse'].includes(role) && (
              <a href="/patients/register" className="p-3 sm:p-4 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors text-center group">
                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-primary mx-auto mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-xs sm:text-sm font-medium">Register Patient</span>
              </a>
            )}
            {role && ['admin', 'nurse'].includes(role) && (
              <a href="/vitals" className="p-3 sm:p-4 rounded-xl bg-success/5 hover:bg-success/10 transition-colors text-center group">
                <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-success mx-auto mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-xs sm:text-sm font-medium">Record Vitals</span>
              </a>
            )}
            {role && ['admin', 'nurse'].includes(role) && (
              <a href="/appointments" className="p-3 sm:p-4 rounded-xl bg-info/5 hover:bg-info/10 transition-colors text-center group">
                <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-info mx-auto mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-xs sm:text-sm font-medium">Book Appointment</span>
              </a>
            )}
            {role && ['admin', 'doctor'].includes(role) && (
              <a href="/lab/orders" className="p-3 sm:p-4 rounded-xl bg-warning/5 hover:bg-warning/10 transition-colors text-center group">
                <FlaskConical className="w-6 h-6 sm:w-8 sm:h-8 text-warning mx-auto mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-xs sm:text-sm font-medium">Order Lab Test</span>
              </a>
            )}
            {role && ['admin', 'doctor'].includes(role) && (
              <a href="/prescriptions" className="p-3 sm:p-4 rounded-xl bg-info/5 hover:bg-info/10 transition-colors text-center group">
                <Pill className="w-6 h-6 sm:w-8 sm:h-8 text-info mx-auto mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-xs sm:text-sm font-medium">Write Prescription</span>
              </a>
            )}
            {/* Lab Technician Quick Actions */}
            {role === 'lab_technician' && (
              <>
                <a href="/lab/orders" className="p-3 sm:p-4 rounded-xl bg-warning/5 hover:bg-warning/10 transition-colors text-center group">
                  <FlaskConical className="w-6 h-6 sm:w-8 sm:h-8 text-warning mx-auto mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs sm:text-sm font-medium">View Lab Orders</span>
                </a>
                <a href="/lab/results" className="p-3 sm:p-4 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors text-center group">
                  <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-primary mx-auto mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs sm:text-sm font-medium">Enter Results</span>
                </a>
              </>
            )}
            {/* Pharmacist Quick Actions */}
            {role === 'pharmacist' && (
              <>
                <a href="/pharmacy" className="p-3 sm:p-4 rounded-xl bg-info/5 hover:bg-info/10 transition-colors text-center group">
                  <Pill className="w-6 h-6 sm:w-8 sm:h-8 text-info mx-auto mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs sm:text-sm font-medium">Dispense Meds</span>
                </a>
                <a href="/prescriptions" className="p-3 sm:p-4 rounded-xl bg-warning/5 hover:bg-warning/10 transition-colors text-center group">
                  <FlaskConical className="w-6 h-6 sm:w-8 sm:h-8 text-warning mx-auto mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs sm:text-sm font-medium">View Prescriptions</span>
                </a>
                <a href="/pharmacy/history" className="p-3 sm:p-4 rounded-xl bg-success/5 hover:bg-success/10 transition-colors text-center group">
                  <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-success mx-auto mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs sm:text-sm font-medium">Dispensing History</span>
                </a>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
