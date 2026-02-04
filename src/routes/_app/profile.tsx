import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { updateProfileFn } from '../../server/auth.fn'
import {
  createBillingPortalFn,
  createCheckoutFn,
  getSubscriptionFn,
} from '../../server/billing.fn'
import { useSession } from '../../lib/auth-client'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'

// Type for user
interface ProfileUser {
  id: string
  email: string
  name: string | null
  image?: string | null
  role?: string
}

// Type for checkout/portal response
interface UrlResponse {
  url: string
}

export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
})

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
})

function ProfilePage() {
  const routeContext = Route.useRouteContext()
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [success, setSuccess] = useState(false)

  // User from session takes precedence, fallback to route context
  const sessionUser = session?.user as ProfileUser | undefined
  const contextUser = routeContext.user as ProfileUser | undefined
  const user = sessionUser ?? contextUser
  const userName = user?.name || ''
  const userEmail = user?.email || ''
  const userRole = user?.role || 'user'

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => getSubscriptionFn(),
  })

  const updateMutation = useMutation({
    mutationFn: (input: { name: string }) => updateProfileFn({ data: input }),
    onSuccess: () => {
      setSuccess(true)
      void queryClient.invalidateQueries({ queryKey: ['session'] })
      setTimeout(() => setSuccess(false), 3000)
    },
  })

  const checkoutMutation = useMutation({
    mutationFn: () => createCheckoutFn({ data: {} }),
    onSuccess: (response: UrlResponse) => {
      window.location.href = response.url
    },
  })

  const portalMutation = useMutation({
    mutationFn: () => createBillingPortalFn(),
    onSuccess: (data: UrlResponse) => {
      window.location.href = data.url
    },
  })

  const form = useForm({
    defaultValues: {
      name: userName,
    },
    onSubmit: ({ value }) => {
      updateMutation.mutate(value)
    },
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      {/* Profile Form */}
      <div className="max-w-2xl rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">Personal Information</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
          className="space-y-6"
        >
          {success && (
            <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600">
              Profile updated successfully!
            </div>
          )}

          {updateMutation.error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {updateMutation.error.message}
            </div>
          )}

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={userEmail}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed
            </p>
          </div>

          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => {
                const result = profileSchema.shape.name.safeParse(value)
                return result.success
                  ? undefined
                  : result.error.issues[0]?.message
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">
                    {field.state.meta.errors.join(', ')}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <div className="space-y-2">
            <Label>Role</Label>
            <Input value={userRole} disabled className="bg-muted capitalize" />
          </div>

          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </div>

      {/* Subscription */}
      <div className="max-w-2xl rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">Subscription</h2>

        <div className="mb-6 rounded-lg bg-muted/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {subscription?.status === 'active' ? 'Pro Plan' : 'Free Plan'}
              </p>
              <p className="text-sm text-muted-foreground">
                {subscription?.status === 'active'
                  ? 'You have access to all features'
                  : 'Upgrade to unlock all features'}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  subscription?.status === 'active'
                    ? 'bg-green-500/10 text-green-600'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {subscription?.status === 'active' ? 'Active' : 'Free'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          {subscription?.status === 'active' ? (
            <Button
              variant="outline"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
            >
              {portalMutation.isPending ? 'Loading...' : 'Manage Subscription'}
            </Button>
          ) : (
            <Button
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
            >
              {checkoutMutation.isPending ? 'Loading...' : 'Upgrade to Pro'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
