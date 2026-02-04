import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listUsersFn, updateUserRoleFn } from '../../server/auth.fn'
import { Button } from '../../components/ui/button'

// Type for users returned from listUsersFn
interface AdminUser {
  id: string
  email: string
  name: string | null
  role: string
  emailVerified: boolean
  createdAt: Date
  subscriptionStatus: string | null
}

export const Route = createFileRoute('/_app/admin')({
  beforeLoad: ({ context }) => {
    // Additional admin check (middleware already checks in server functions)
    const user = context.user as { role?: string } | undefined
    if (user?.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AdminPage,
})

function AdminPage() {
  const queryClient = useQueryClient()

  const { data: users, isLoading } = useQuery<Array<AdminUser>>({
    queryKey: ['admin', 'users'],
    queryFn: () => listUsersFn() as Promise<Array<AdminUser>>,
  })

  const updateRoleMutation = useMutation({
    mutationFn: (input: { userId: string; role: 'user' | 'admin' }) =>
      updateUserRoleFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground">
          Manage users and system settings
        </p>
      </div>

      {/* Users Table */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-semibold">Users</h2>
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-muted-foreground">
            Loading users...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-6 py-3 text-left text-sm font-medium">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium">
                    Subscription
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user: AdminUser) => (
                  <tr key={user.id} className="border-b">
                    <td className="px-6 py-4 text-sm">{user.email}</td>
                    <td className="px-6 py-4 text-sm">{user.name ?? '-'}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.role === 'admin'
                            ? 'bg-purple-500/10 text-purple-600'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.emailVerified
                            ? 'bg-green-500/10 text-green-600'
                            : 'bg-yellow-500/10 text-yellow-600'
                        }`}
                      >
                        {user.emailVerified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.subscriptionStatus === 'active'
                            ? 'bg-green-500/10 text-green-600'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {user.subscriptionStatus ?? 'Free'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateRoleMutation.mutate({
                            userId: user.id,
                            role: user.role === 'admin' ? 'user' : 'admin',
                          })
                        }
                        disabled={updateRoleMutation.isPending}
                      >
                        {user.role === 'admin' ? 'Demote' : 'Promote'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* System Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Total Users
          </p>
          <p className="mt-2 text-3xl font-bold">{users?.length ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Admins</p>
          <p className="mt-2 text-3xl font-bold">
            {users?.filter((u: AdminUser) => u.role === 'admin').length ?? 0}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Pro Subscribers
          </p>
          <p className="mt-2 text-3xl font-bold">
            {users?.filter((u: AdminUser) => u.subscriptionStatus === 'active')
              .length ?? 0}
          </p>
        </div>
      </div>
    </div>
  )
}
