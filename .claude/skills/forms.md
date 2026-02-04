# Forms Skill

This skill covers form handling using TanStack Form with Zod validation in this TanStack Start project.

## TanStack Form Overview

This project uses TanStack Form for form state management with:

- Zod schemas for validation
- Field-level validation with real-time feedback
- Integration with server functions via TanStack Query mutations
- Honeypot bot protection

## Basic Form Setup

```typescript
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// 1. Define Zod schema
const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
})

function ContactForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // 2. Initialize form
  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      message: '',
    },
    onSubmit: async ({ value }) => {
      setError(null)
      try {
        // Call server function
        await submitContactFn({ data: value })
        setSuccess(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

  // 3. Render form
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="space-y-4"
    >
      {/* Form fields go here */}
      <Button type="submit">Submit</Button>
    </form>
  )
}
```

## Field Components

### Basic Text Input

```typescript
<form.Field
  name="name"
  validators={{
    onChange: ({ value }) => {
      const result = contactSchema.shape.name.safeParse(value)
      return result.success ? undefined : result.error.issues[0]?.message
    },
  }}
>
  {(field) => (
    <div className="space-y-2">
      <Label htmlFor="name">Name</Label>
      <Input
        id="name"
        type="text"
        placeholder="Your name"
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
```

### Email Input

```typescript
<form.Field
  name="email"
  validators={{
    onChange: ({ value }) => {
      const result = z.string().email().safeParse(value)
      return result.success ? undefined : 'Invalid email address'
    },
  }}
>
  {(field) => (
    <div className="space-y-2">
      <Label htmlFor="email">Email</Label>
      <Input
        id="email"
        type="email"
        placeholder="you@example.com"
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
      />
      {field.state.meta.errors.length > 0 && (
        <p className="text-sm text-destructive">
          {field.state.meta.errors[0]}
        </p>
      )}
    </div>
  )}
</form.Field>
```

### Password Input

```typescript
<form.Field
  name="password"
  validators={{
    onChange: ({ value }) => {
      if (value.length < 8) {
        return 'Password must be at least 8 characters'
      }
      return undefined
    },
  }}
>
  {(field) => (
    <div className="space-y-2">
      <Label htmlFor="password">Password</Label>
      <Input
        id="password"
        type="password"
        placeholder="********"
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
      />
      {field.state.meta.errors.length > 0 && (
        <p className="text-sm text-destructive">
          {field.state.meta.errors[0]}
        </p>
      )}
    </div>
  )}
</form.Field>
```

### Textarea

```typescript
<form.Field
  name="message"
  validators={{
    onChange: ({ value }) => {
      if (value.length < 10) {
        return 'Message must be at least 10 characters'
      }
      return undefined
    },
  }}
>
  {(field) => (
    <div className="space-y-2">
      <Label htmlFor="message">Message</Label>
      <Textarea
        id="message"
        placeholder="Your message..."
        rows={4}
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
      />
      {field.state.meta.errors.length > 0 && (
        <p className="text-sm text-destructive">
          {field.state.meta.errors[0]}
        </p>
      )}
    </div>
  )}
</form.Field>
```

## Validation Patterns

### Validate on Change (Real-time)

```typescript
<form.Field
  name="username"
  validators={{
    onChange: ({ value }) => {
      if (value.length < 3) {
        return 'Username must be at least 3 characters'
      }
      if (!/^[a-zA-Z0-9_]+$/.test(value)) {
        return 'Username can only contain letters, numbers, and underscores'
      }
      return undefined
    },
  }}
>
```

### Validate on Blur Only

```typescript
<form.Field
  name="email"
  validators={{
    onBlur: ({ value }) => {
      const result = z.string().email().safeParse(value)
      return result.success ? undefined : 'Invalid email'
    },
  }}
>
```

### Async Validation

```typescript
<form.Field
  name="username"
  validators={{
    onChangeAsync: async ({ value }) => {
      // Debounce handled by TanStack Form
      const isAvailable = await checkUsernameAvailableFn({ data: { username: value } })
      return isAvailable ? undefined : 'Username is already taken'
    },
    onChangeAsyncDebounceMs: 500,  // Wait 500ms before validating
  }}
>
```

### Cross-Field Validation

```typescript
<form.Field
  name="confirmPassword"
  validators={{
    onChangeListenTo: ['password'],  // Re-validate when password changes
    onChange: ({ value, fieldApi }) => {
      const password = fieldApi.form.getFieldValue('password')
      if (value !== password) {
        return 'Passwords do not match'
      }
      return undefined
    },
  }}
>
```

## Form with Mutation

### Using TanStack Query Mutation

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { updateProfileFn } from '@/server/auth.fn'

function ProfileForm({ user }) {
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: (data: { name: string }) => updateProfileFn({ data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['session'] })
    },
  })

  const form = useForm({
    defaultValues: {
      name: user.name || '',
    },
    onSubmit: ({ value }) => {
      updateMutation.mutate(value)
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      className="space-y-6"
    >
      {updateMutation.isSuccess && (
        <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600">
          Profile updated successfully!
        </div>
      )}

      {updateMutation.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {updateMutation.error.message}
        </div>
      )}

      <form.Field name="name">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>

      <Button type="submit" disabled={updateMutation.isPending}>
        {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  )
}
```

## Honeypot Bot Protection

### Honeypot Component

```typescript
// src/components/common/Honeypot.tsx
export function Honeypot() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-9999px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    >
      <label htmlFor="_gotcha">Don't fill this out if you're human</label>
      <input
        type="text"
        id="_gotcha"
        name="_gotcha"
        tabIndex={-1}
        autoComplete="off"
      />
    </div>
  )
}

// Helper to check if honeypot was filled
export function isHoneypotFilled(data: { _gotcha?: string }): boolean {
  return !!data._gotcha && data._gotcha.length > 0
}
```

### Using Honeypot in Forms

```typescript
import { Honeypot, isHoneypotFilled } from '@/components/common/Honeypot'

function SignupForm() {
  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      _gotcha: '',  // Honeypot field
    },
    onSubmit: async ({ value }) => {
      // Check honeypot first
      if (isHoneypotFilled(value)) {
        // Silently fail for bots
        return
      }

      // Proceed with real submission
      await signUp.email({
        email: value.email,
        password: value.password,
      })
    },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      {/* Hidden honeypot field */}
      <Honeypot />

      {/* Real form fields */}
      <form.Field name="email">...</form.Field>
      <form.Field name="password">...</form.Field>

      <Button type="submit">Sign Up</Button>
    </form>
  )
}
```

## Complete Login Form Example

```typescript
// src/routes/_auth/login.tsx
import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { signIn } from '@/lib/auth-client'
import { Honeypot, isHoneypotFilled } from '@/components/common/Honeypot'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  _gotcha: z.string().optional(),
})

function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      _gotcha: '',
    },
    onSubmit: async ({ value }) => {
      // Honeypot check
      if (isHoneypotFilled(value)) {
        return
      }

      setError(null)
      setLoading(true)

      try {
        const result = await signIn.email({
          email: value.email,
          password: value.password,
        })

        if (result.error) {
          setError(result.error.message || 'Invalid credentials')
          setLoading(false)
          return
        }

        // Invalidate router to refresh auth state
        await router.invalidate()
        window.location.href = '/dashboard'
      } catch (err) {
        setError('An unexpected error occurred')
        setLoading(false)
      }
    },
  })

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-muted-foreground">Sign in to your account</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
        className="space-y-4"
      >
        {/* Error message */}
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Honeypot */}
        <Honeypot />

        {/* Email field */}
        <form.Field
          name="email"
          validators={{
            onChange: ({ value }) => {
              const result = loginSchema.shape.email.safeParse(value)
              return result.success ? undefined : result.error.issues[0]?.message
            },
          }}
        >
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
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

        {/* Password field */}
        <form.Field
          name="password"
          validators={{
            onChange: ({ value }) => {
              const result = loginSchema.shape.password.safeParse(value)
              return result.success ? undefined : result.error.issues[0]?.message
            },
          }}
        >
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
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

        {/* Submit button */}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
    </div>
  )
}
```

## Form State Helpers

### Check if Form is Valid

```typescript
const canSubmit = form.state.canSubmit // true if no errors
const isSubmitting = form.state.isSubmitting
const isDirty = form.state.isDirty // true if values changed
```

### Reset Form

```typescript
// Reset to default values
form.reset()

// Reset to specific values
form.reset({
  name: 'New Name',
  email: 'new@example.com',
})
```

### Set Field Value Programmatically

```typescript
form.setFieldValue('name', 'New Value')
```

### Get Field Value

```typescript
const name = form.getFieldValue('name')
```

## Error and Success States

### Display Form-Level Errors

```typescript
{error && (
  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
    {error}
  </div>
)}
```

### Display Success Messages

```typescript
{success && (
  <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600">
    Form submitted successfully!
  </div>
)}
```

### Auto-Dismiss Success Message

```typescript
const [success, setSuccess] = useState(false)

const form = useForm({
  onSubmit: async ({ value }) => {
    await submitFn({ data: value })
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000) // Hide after 3s
  },
})
```

## Troubleshooting

### Validation Not Showing

**Cause**: Missing `validators` prop or not rendering errors.

**Solution**:

```typescript
<form.Field
  name="email"
  validators={{
    onChange: ({ value }) => {
      // Must return string for error, undefined for valid
      if (!value) return 'Required'
      return undefined
    },
  }}
>
  {(field) => (
    <>
      <Input ... />
      {/* Must render errors */}
      {field.state.meta.errors.length > 0 && (
        <p className="text-destructive">{field.state.meta.errors[0]}</p>
      )}
    </>
  )}
</form.Field>
```

### Form Not Submitting

**Cause**: Missing `e.preventDefault()` or `form.handleSubmit()`.

**Solution**:

```typescript
<form
  onSubmit={(e) => {
    e.preventDefault()  // Required!
    form.handleSubmit()  // Required!
  }}
>
```

### Field Value Not Updating

**Cause**: Missing `onChange` handler.

**Solution**:

```typescript
<Input
  value={field.state.value}
  onChange={(e) => field.handleChange(e.target.value)}  // Required!
/>
```

### Honeypot Being Filled by Autofill

**Cause**: Browser autofill targeting hidden fields.

**Solution**: Use unique field name and disable autofill:

```typescript
<input
  name="_gotcha"
  autoComplete="off"
  tabIndex={-1}
/>
```

## File References

- Login form: `src/routes/_auth/login.tsx`
- Signup form: `src/routes/_auth/signup.tsx`
- Profile form: `src/routes/_app/profile.tsx`
- Honeypot component: `src/components/common/Honeypot.tsx`
- UI Input: `src/components/ui/input.tsx`
- UI Button: `src/components/ui/button.tsx`
- UI Label: `src/components/ui/label.tsx`
