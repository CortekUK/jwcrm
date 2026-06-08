"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Mail,
  Calendar,
  Loader2,
  Search,
  UserPlus,
  UserX,
  UserCheck,
  Trash2,
  AlertCircle,
  MoreHorizontal,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import { CreateClientModal } from "@/components/admin/CreateClientModal";

interface UserProfile {
  user_id: string;
  full_name: string | null;
  locale: string;
  created_at: string;
  email?: string;
  role?: string;
  roles?: string[];
  is_active?: boolean;
}

export default function ManageUsersPage() {
  const { t } = useTranslation(['admin', 'common', 'toast']);
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [createClientModalOpen, setCreateClientModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  const isSuperAdmin = profile?.roles?.includes("superadmin");

  // Redirect non-superadmin users
  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      router.push("/admin");
    }
  }, [authLoading, isSuperAdmin, router]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session found');
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gyikimtqsasryewwawgs.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/admin-get-users`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch users');
      }

      const result = await response.json();
      setUsers(result.data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        variant: "destructive",
        title: t('toast:error'),
        description: error.message || t('toast:admin.errorLoadingUsers'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleToggleActive = async (user: UserProfile) => {
    try {
      setTogglingUserId(user.user_id);
      const newStatus = !user.is_active;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session found');
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gyikimtqsasryewwawgs.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/-admin-toggle-user-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            userId: user.user_id,
            isActive: newStatus,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user status');
      }

      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.user_id === user.user_id
            ? { ...u, is_active: newStatus }
            : u
        )
      );

      toast({
        title: t('toast:success'),
        description: newStatus ? t('toast:admin.userActivated') : t('toast:admin.userDeactivated'),
      });
    } catch (error: any) {
      console.error('Error toggling user status:', error);
      toast({
        variant: "destructive",
        title: t('toast:error'),
        description: error.message || t('toast:admin.errorUpdatingUserStatus'),
      });
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      setDeletingUser(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session found');
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gyikimtqsasryewwawgs.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/admin-delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            userId: userToDelete.user_id,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }

      setUsers(prevUsers =>
        prevUsers.filter(u => u.user_id !== userToDelete.user_id)
      );

      toast({
        title: t('toast:success'),
        description: t('toast:admin.userDeleted'),
      });

      setUserToDelete(null);
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        variant: "destructive",
        title: t('toast:error'),
        description: error.message || t('toast:admin.errorDeletingUser'),
      });
    } finally {
      setDeletingUser(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Show loading while checking auth or if not superadmin (redirecting)
  if (authLoading || loading || !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Header */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 mb-6 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t('admin:manageUsers')}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
              {t('admin:createManageAccounts')}
            </p>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <Card className="rounded-lg border border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
        <CardHeader className="pb-4">
          {/* Search and Create Button Row */}
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#C6A03B]" />
              <input
                type="text"
                placeholder={t('admin:searchByNameOrEmail')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full ltr:pl-10 rtl:pr-10 ltr:pr-4 rtl:pl-4 py-2 text-sm border border-[#E6E6E4] rounded-md focus:outline-none focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B] transition-all"
              />
            </div>
            <Button
              onClick={() => setCreateClientModalOpen(true)}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
              size="sm"
            >
              <UserPlus className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              {t('admin:createUser')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-[#E6E6E4] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAF8] border-b border-[#EAEAE8]">
                  <TableHead className="font-semibold text-[#555555]">{t('admin:user')}</TableHead>
                  <TableHead className="font-semibold text-[#555555]">{t('admin:email')}</TableHead>
                  <TableHead className="font-semibold text-[#555555]">{t('admin:role')}</TableHead>
                  <TableHead className="font-semibold text-[#555555]">{t('admin:created')}</TableHead>
                  <TableHead className="font-semibold text-[#555555]">{t('admin:status')}</TableHead>
                  <TableHead className="ltr:text-right rtl:text-left font-semibold text-[#555555] w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-[#777777]">
                      {searchQuery ? t('admin:noUsersMatch') : t('admin:noUsersFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow
                      key={user.user_id}
                      className="transition-colors hover:bg-[#FDFBF4] border-b border-[#EAEAE8]"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-[#C6A03B]/20">
                            <AvatarFallback className="bg-[rgba(198,160,59,0.12)] text-[#0C5536] text-xs font-semibold">
                              {getInitials(user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-[#222222]">
                            {user.full_name || t('admin:unknownUser')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-[#777777]">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-[#999999]" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(user.roles && user.roles.length > 0 ? user.roles : [user.role || 'client']).map((role) => {
                            const getRoleStyle = (r: string) => {
                              switch (r) {
                                case 'admin':
                                  return 'bg-[rgba(139,92,246,0.1)] text-[#7C3AED]';
                                case 'hr':
                                  return 'bg-[rgba(20,184,166,0.1)] text-[#0D9488]';
                                case 'finance':
                                  return 'bg-[rgba(234,179,8,0.1)] text-[#CA8A04]';
                                case 'lead_management':
                                  return 'bg-[rgba(245,158,11,0.1)] text-[#D97706]';
                                case 'salesperson':
                                  return 'bg-[rgba(59,130,246,0.1)] text-[#2563EB]';
                                default:
                                  return 'bg-[rgba(12,85,54,0.08)] text-[#0C5536]';
                              }
                            };
                            const getRoleLabel = (r: string) => {
                              switch (r) {
                                case 'superadmin': return t('admin:superAdmin');
                                case 'admin': return t('admin:administrator');
                                case 'hr': return t('admin:hr');
                                case 'finance': return t('admin:finance');
                                case 'lead_management': return t('admin:leadManagement');
                                case 'salesperson': return t('admin:salesperson');
                                case 'client': return t('admin:client');
                                default: return r;
                              }
                            };
                            return (
                              <Badge
                                key={role}
                                className={`rounded-md border-0 text-xs font-medium px-2 py-0.5 ${getRoleStyle(role)}`}
                              >
                                {getRoleLabel(role)}
                              </Badge>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-[#777777]">
                          <Calendar className="h-3.5 w-3.5 text-[#999999]" />
                          {format(new Date(user.created_at), 'PP')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`rounded-md border text-xs font-medium ${
                            user.is_active
                              ? 'bg-[rgba(22,163,74,0.1)] text-[#16A34A] border-[#16A34A]/20'
                              : 'bg-[rgba(153,153,153,0.1)] text-[#999999] border-[#999999]/20'
                          }`}
                        >
                          {user.is_active ? t('admin:active') : t('admin:inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className="ltr:text-right rtl:text-left">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-[#F5F5F3]"
                              disabled={togglingUserId !== null || deletingUser}
                            >
                              {togglingUserId === user.user_id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-[#777777]" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4 text-[#777777]" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={() => handleToggleActive(user)}
                              className={`cursor-pointer ${
                                user.is_active
                                  ? 'text-[#DC2626] focus:text-[#DC2626] focus:bg-[rgba(220,38,38,0.08)]'
                                  : 'text-[#16A34A] focus:text-[#16A34A] focus:bg-[rgba(22,163,74,0.08)]'
                              }`}
                            >
                              {user.is_active ? (
                                <>
                                  <UserX className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                                  {t('admin:deactivate')}
                                </>
                              ) : (
                                <>
                                  <UserCheck className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                                  {t('admin:activate')}
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setUserToDelete(user)}
                              className="cursor-pointer text-[#DC2626] focus:text-[#DC2626] focus:bg-[rgba(220,38,38,0.08)]"
                            >
                              <Trash2 className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                              {t('admin:delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Client Modal */}
      <CreateClientModal
        open={createClientModalOpen}
        onOpenChange={setCreateClientModalOpen}
        onUserCreated={() => {
          fetchUsers();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-[#DC2626]">
              <AlertCircle className="h-5 w-5" />
              Delete User
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.full_name}</strong>?
              This action cannot be undone. All user data including wills and documents will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUser}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deletingUser}
              className="bg-[#DC2626] hover:bg-[#B91C1C] text-white"
            >
              {deletingUser ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete User'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
