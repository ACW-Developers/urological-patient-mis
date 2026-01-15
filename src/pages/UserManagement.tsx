import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Users, Search, Edit, Shield, UserX, Trash2, UserCheck } from 'lucide-react';
import type { Profile, UserRole, AppRole } from '@/types/database';

const roleLabels: Record<AppRole, { label: string; color: string }> = {
  admin: { label: 'Administrator', color: 'bg-primary text-primary-foreground' },
  nurse: { label: 'Nurse', color: 'bg-emerald-500 text-white' },
  doctor: { label: 'Doctor', color: 'bg-blue-500 text-white' },
  lab_technician: { label: 'Lab Technician', color: 'bg-amber-500 text-white' },
  pharmacist: { label: 'Pharmacist', color: 'bg-purple-500 text-white' },
};

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<(Profile & { role?: UserRole }) | null>(null);
  const [newRole, setNewRole] = useState<string>('');
  const [userToDeactivate, setUserToDeactivate] = useState<(Profile & { role?: UserRole }) | null>(null);
  const [userToDelete, setUserToDelete] = useState<(Profile & { role?: UserRole }) | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');
      if (rolesError) throw rolesError;

      return profiles.map((profile) => ({
        ...profile,
        role: roles.find((r) => r.user_id === profile.user_id),
      })) as (Profile & { role?: UserRole })[];
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // Check if user already has a role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingRole) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role })
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('User role updated');
      setSelectedUser(null);
      setNewRole('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deactivateUserMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive } as any)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success(variables.isActive ? 'User account activated' : 'User account deactivated');
      setUserToDeactivate(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      // Delete user role first
      await supabase.from('user_roles').delete().eq('user_id', userId);
      
      // Delete profile
      const { error } = await supabase.from('profiles').delete().eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('User account deleted');
      setUserToDelete(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const filteredUsers = users?.filter((user) => {
    const matchesSearch =
      user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role?.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && user.is_active !== false) ||
      (statusFilter === 'inactive' && user.is_active === false);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadge = (role?: AppRole) => {
    if (!role) return <Badge variant="outline">No Role</Badge>;
    const config = roleLabels[role];
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getStatusBadge = (isActive?: boolean) => {
    if (isActive === false) {
      return <Badge variant="destructive">Inactive</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground">Manage staff accounts, roles, and access</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {Object.entries(roleLabels).map(([role, config]) => {
          const count = users?.filter((u) => u.role?.role === role).length || 0;
          return (
            <Card key={role}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${config.color.split(' ')[0]}/10`}>
                    <Shield className={`h-6 w-6 ${config.color.split(' ')[0].replace('bg-', 'text-')}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-sm text-muted-foreground">{config.label}s</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Administrators</SelectItem>
                <SelectItem value="doctor">Doctors</SelectItem>
                <SelectItem value="nurse">Nurses</SelectItem>
                <SelectItem value="lab_technician">Lab Technicians</SelectItem>
                <SelectItem value="pharmacist">Pharmacists</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredUsers?.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers?.map((user) => (
                    <TableRow key={user.id} className={user.is_active === false ? 'opacity-60' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback>
                              {user.first_name[0]}{user.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.first_name} {user.last_name}</div>
                            <div className="text-xs text-muted-foreground">{user.phone || 'No phone'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.department || '-'}</TableCell>
                      <TableCell>{getRoleBadge(user.role?.role as AppRole)}</TableCell>
                      <TableCell>{getStatusBadge(user.is_active)}</TableCell>
                      <TableCell>{format(new Date(user.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUser(user);
                              setNewRole(user.role?.role || '');
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setUserToDeactivate(user)}
                          >
                            {user.is_active === false ? (
                              <UserCheck className="h-4 w-4 text-success" />
                            ) : (
                              <UserX className="h-4 w-4 text-warning" />
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User Account</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to permanently delete the account for {user.first_name} {user.last_name}? 
                                  This action cannot be undone and will remove all associated data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => deleteUserMutation.mutate({ userId: user.user_id })}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <Avatar>
                  <AvatarImage src={selectedUser.avatar_url || undefined} />
                  <AvatarFallback>
                    {selectedUser.first_name[0]}{selectedUser.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{selectedUser.first_name} {selectedUser.last_name}</div>
                  <div className="text-sm text-muted-foreground">{selectedUser.email}</div>
                </div>
              </div>
              <div>
                <Label>Assign Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="nurse">Nurse</SelectItem>
                    <SelectItem value="lab_technician">Lab Technician</SelectItem>
                    <SelectItem value="pharmacist">Pharmacist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedUser(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => updateRoleMutation.mutate({ userId: selectedUser.user_id, role: newRole as AppRole })}
                  disabled={!newRole || updateRoleMutation.isPending}
                >
                  {updateRoleMutation.isPending ? 'Saving...' : 'Save Role'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Deactivate/Activate Dialog */}
      <Dialog open={!!userToDeactivate} onOpenChange={() => setUserToDeactivate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {userToDeactivate?.is_active === false ? 'Activate' : 'Deactivate'} User Account
            </DialogTitle>
            <DialogDescription>
              {userToDeactivate?.is_active === false 
                ? `This will restore access for ${userToDeactivate?.first_name} ${userToDeactivate?.last_name}.`
                : `This will prevent ${userToDeactivate?.first_name} ${userToDeactivate?.last_name} from accessing the system. Their data will be preserved.`
              }
            </DialogDescription>
          </DialogHeader>
          {userToDeactivate && (
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <Avatar>
                <AvatarImage src={userToDeactivate.avatar_url || undefined} />
                <AvatarFallback>
                  {userToDeactivate.first_name[0]}{userToDeactivate.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{userToDeactivate.first_name} {userToDeactivate.last_name}</div>
                <div className="text-sm text-muted-foreground">{userToDeactivate.email}</div>
                <div className="mt-1">{getStatusBadge(userToDeactivate.is_active)}</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToDeactivate(null)}>
              Cancel
            </Button>
            <Button
              variant={userToDeactivate?.is_active === false ? 'default' : 'destructive'}
              onClick={() => userToDeactivate && deactivateUserMutation.mutate({ 
                userId: userToDeactivate.user_id, 
                isActive: userToDeactivate.is_active === false 
              })}
              disabled={deactivateUserMutation.isPending}
            >
              {deactivateUserMutation.isPending 
                ? 'Processing...' 
                : userToDeactivate?.is_active === false ? 'Activate Account' : 'Deactivate Account'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
