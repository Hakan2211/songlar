import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getSubscriptionFn } from '../../server/billing.fn'
import { Button } from '../../components/ui/button'

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const routeContext = Route.useRouteContext()
  const user = routeContext.user as { name?: string | null } | undefined
  const userName = user?.name || 'there'

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => getSubscriptionFn(),
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {userName}!</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Projects"
          value="3"
          change="+1 from last month"
        />
        <StatCard title="Active Users" value="12" change="+3 from last week" />
        <StatCard
          title="Revenue"
          value="$1,234"
          change="+12% from last month"
        />
        <StatCard
          title="Subscription"
          value={subscription?.status === 'active' ? 'Pro' : 'Free'}
          change={
            subscription?.status === 'active' ? 'Active' : 'Upgrade available'
          }
        />
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <Button>Create Project</Button>
          <Button variant="outline">View Reports</Button>
          <Link to="/profile">
            <Button variant="outline">Edit Profile</Button>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">Recent Activity</h2>
        <div className="space-y-4">
          <ActivityItem
            icon="🚀"
            title="Project created"
            description="You created a new project 'My App'"
            time="2 hours ago"
          />
          <ActivityItem
            icon="👤"
            title="Profile updated"
            description="You updated your profile information"
            time="1 day ago"
          />
          <ActivityItem
            icon="✨"
            title="Welcome!"
            description="You joined the platform"
            time="3 days ago"
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  change,
}: {
  title: string
  value: string
  change: string
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{change}</p>
    </div>
  )
}

function ActivityItem({
  icon,
  title,
  description,
  time,
}: {
  icon: string
  title: string
  description: string
  time: string
}) {
  return (
    <div className="flex items-start space-x-3">
      <span className="text-xl">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <span className="text-xs text-muted-foreground">{time}</span>
    </div>
  )
}
