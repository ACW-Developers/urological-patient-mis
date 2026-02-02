import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { format, subDays, parseISO } from 'date-fns';
import { 
  Activity, 
  Search, 
  Filter, 
  Users, 
  Clock, 
  TrendingUp,
  FileText,
  UserCheck,
  Calendar,
  Download,
  Eye,
  Edit,
  Trash2,
  Plus,
  LogIn,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  session_duration_seconds: number | null;
  page_path: string | null;
  created_at: string;
  user_profile?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface UserSummary {
  user_id: string;
  name: string;
  email: string;
  total_actions: number;
  total_time_seconds: number;
  last_active: string;
  actions_by_type: Record<string, number>;
  role?: string;
}

const actionIcons: Record<string, React.ReactNode> = {
  login: <LogIn className="w-4 h-4" />,
  logout: <LogOut className="w-4 h-4" />,
  view: <Eye className="w-4 h-4" />,
  create: <Plus className="w-4 h-4" />,
  update: <Edit className="w-4 h-4" />,
  delete: <Trash2 className="w-4 h-4" />,
  download: <Download className="w-4 h-4" />,
  default: <Activity className="w-4 h-4" />,
};

const actionColors: Record<string, string> = {
  login: 'bg-green-500/10 text-green-600',
  logout: 'bg-gray-500/10 text-gray-600',
  view: 'bg-blue-500/10 text-blue-600',
  create: 'bg-emerald-500/10 text-emerald-600',
  update: 'bg-amber-500/10 text-amber-600',
  delete: 'bg-red-500/10 text-red-600',
  download: 'bg-purple-500/10 text-purple-600',
  default: 'bg-muted text-muted-foreground',
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const ITEMS_PER_PAGE = 20;

export default function ActivityLogs() {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7');
  const [currentPage, setCurrentPage] = useState(1);

  const startDate = subDays(new Date(), parseInt(dateRange));

  // Fetch all profiles for user filter dropdown
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .order('first_name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch user roles for display
  const { data: userRoles = [] } = useQuery({
    queryKey: ['user-roles-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (error) throw error;
      return data || [];
    },
  });

  const roleMap = new Map(userRoles.map(r => [r.user_id, r.role]));

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['activity-logs', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      // Fetch user profiles for each unique user_id
      const userIds = [...new Set(data?.map(log => log.user_id) || [])];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return (data || []).map(log => ({
        ...log,
        user_profile: profileMap.get(log.user_id),
      })) as ActivityLog[];
    },
  });

  const { data: userStats = [] } = useQuery({
    queryKey: ['user-activity-stats', dateRange],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email');

      const { data: logs } = await supabase
        .from('activity_logs')
        .select('user_id, action, session_duration_seconds, created_at')
        .gte('created_at', startDate.toISOString());

      const userStatsMap = new Map<string, UserSummary>();

      profiles?.forEach(profile => {
        userStatsMap.set(profile.user_id, {
          user_id: profile.user_id,
          name: `${profile.first_name} ${profile.last_name}`,
          email: profile.email,
          total_actions: 0,
          total_time_seconds: 0,
          last_active: '',
          actions_by_type: {},
          role: roleMap.get(profile.user_id),
        });
      });

      logs?.forEach(log => {
        const stats = userStatsMap.get(log.user_id);
        if (stats) {
          stats.total_actions++;
          stats.total_time_seconds += log.session_duration_seconds || 0;
          if (!stats.last_active || log.created_at > stats.last_active) {
            stats.last_active = log.created_at;
          }
          stats.actions_by_type[log.action] = (stats.actions_by_type[log.action] || 0) + 1;
        }
      });

      return Array.from(userStatsMap.values())
        .filter(s => s.total_actions > 0)
        .sort((a, b) => b.total_actions - a.total_actions);
    },
  });

  // Calculate analytics
  const actionBreakdown = logs.reduce((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(actionBreakdown).map(([name, value]) => ({
    name,
    value,
  }));

  // Activity over time
  const activityByDay = logs.reduce((acc, log) => {
    const day = format(parseISO(log.created_at), 'MMM dd');
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const timelineData = Object.entries(activityByDay)
    .map(([date, count]) => ({ date, count }))
    .reverse();

  // Page visits
  const pageVisits = logs.reduce((acc, log) => {
    if (log.page_path) {
      acc[log.page_path] = (acc[log.page_path] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const pageData = Object.entries(pageVisits)
    .map(([page, visits]) => ({ page, visits }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 10);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user_profile?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_profile?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_profile?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_type?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesUser = userFilter === 'all' || log.user_id === userFilter;

    return matchesSearch && matchesAction && matchesUser;
  });

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const uniqueActions = [...new Set(logs.map(log => log.action))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Activity Logs</h1>
        <p className="text-muted-foreground">Monitor all user activity and system usage analytics</p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
            <p className="text-xs text-muted-foreground">Last {dateRange} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.length}</div>
            <p className="text-xs text-muted-foreground">Unique users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Session Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(
                Math.round(
                  logs.reduce((sum, log) => sum + (log.session_duration_seconds || 0), 0) / 
                  Math.max(logs.filter(l => l.session_duration_seconds).length, 1)
                )
              )}
            </div>
            <p className="text-xs text-muted-foreground">Per session</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pages Visited</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(pageVisits).length}</div>
            <p className="text-xs text-muted-foreground">Unique pages</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Activity Timeline
            </CardTitle>
            <CardDescription>User actions over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Action Breakdown</CardTitle>
            <CardDescription>Distribution by action type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Pages Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Most Visited Pages</CardTitle>
          <CardDescription>Top 10 pages by visit count</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pageData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" />
                <YAxis dataKey="page" type="category" width={150} className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="visits" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* User Activity Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            User Activity Summary
          </CardTitle>
          <CardDescription>Aggregated activity per user</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Total Actions</TableHead>
                <TableHead>Time Spent</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Top Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userStats.map((stat) => (
                <TableRow key={stat.user_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{stat.name}</div>
                      <div className="text-sm text-muted-foreground">{stat.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {roleMap.get(stat.user_id) || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{stat.total_actions}</Badge>
                  </TableCell>
                  <TableCell>{formatDuration(stat.total_time_seconds)}</TableCell>
                  <TableCell>
                    {stat.last_active ? format(parseISO(stat.last_active), 'MMM d, h:mm a') : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {Object.entries(stat.actions_by_type)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 3)
                        .map(([action, count]) => (
                          <Badge key={action} variant="outline" className="text-xs">
                            {action}: {count}
                          </Badge>
                        ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Activity Logs Table with Pagination */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            All Activity Logs
          </CardTitle>
          <CardDescription>
            Showing {paginatedLogs.length} of {filteredLogs.length} logs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by user, action, or entity..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select value={userFilter} onValueChange={(v) => handleFilterChange(setUserFilter, v)}>
              <SelectTrigger className="w-[200px]">
                <Users className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {allProfiles.map((profile) => (
                  <SelectItem key={profile.user_id} value={profile.user_id}>
                    {profile.first_name} {profile.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={(v) => handleFilterChange(setActionFilter, v)}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((action) => (
                  <SelectItem key={action} value={action}>{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={(v) => handleFilterChange(setDateRange, v)}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24 hours</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading activity logs...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(parseISO(log.created_at), 'MMM d, yyyy h:mm:ss a')}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {log.user_profile?.first_name} {log.user_profile?.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {log.user_profile?.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          {roleMap.get(log.user_id) || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${actionColors[log.action] || actionColors.default}`}>
                          {actionIcons[log.action] || actionIcons.default}
                          {log.action}
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.entity_type && (
                          <Badge variant="outline">{log.entity_type}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.page_path || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.session_duration_seconds 
                          ? formatDuration(log.session_duration_seconds) 
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              onClick={() => setCurrentPage(pageNum)}
                              isActive={currentPage === pageNum}
                              className="cursor-pointer"
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
