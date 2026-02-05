import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Check,
  Cloud,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Types for API key status
interface ApiKeyStatus {
  provider: 'fal' | 'minimax'
  hasKey: boolean
  lastFour: string | null
  addedAt: Date | null
}

interface BunnyStatus {
  hasKey: boolean
  lastFour: string | null
  addedAt: Date | null
  storageZone: string | null
  pullZone: string | null
}

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const queryClient = useQueryClient()

  // Fetch API key statuses using dynamic import
  const { data: apiKeyStatuses, isLoading: isLoadingKeys } = useQuery<
    Array<ApiKeyStatus>
  >({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { getAllApiKeyStatusesFn } = await import('@/server/byok.fn')
      return getAllApiKeyStatusesFn()
    },
  })

  // Fetch Bunny status separately
  const { data: bunnyStatus, isLoading: isLoadingBunny } =
    useQuery<BunnyStatus>({
      queryKey: ['bunny-status'],
      queryFn: async () => {
        const { getBunnyStatusFn } = await import('@/server/byok.fn')
        return getBunnyStatusFn()
      },
    })

  const falStatus = apiKeyStatuses?.find((s) => s.provider === 'fal')
  const minimaxStatus = apiKeyStatuses?.find((s) => s.provider === 'minimax')
  const isLoading = isLoadingKeys || isLoadingBunny

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your API keys and storage settings
        </p>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Bring Your Own Key (BYOK):</strong> This app uses your own
            API keys for music generation and storage. Your keys are encrypted
            using AES-256-GCM and stored securely. We never have access to your
            keys in plaintext.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Section: Music Generation */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Music Generation</h2>
            <div className="space-y-4">
              {/* fal.ai API Key */}
              <ApiKeyCard
                provider="fal"
                title="fal.ai API Key"
                description="For ElevenLabs Music and MiniMax v2 (via fal.ai proxy)"
                status={falStatus}
                getKeyLink="https://fal.ai/dashboard/keys"
                onUpdate={() =>
                  queryClient.invalidateQueries({ queryKey: ['api-keys'] })
                }
              />

              {/* MiniMax Direct API Key */}
              <ApiKeyCard
                provider="minimax"
                title="MiniMax Direct API Key"
                description="For MiniMax Music v2.5 - get your key from platform.minimax.io"
                status={minimaxStatus}
                getKeyLink="https://platform.minimax.io/"
                onUpdate={() =>
                  queryClient.invalidateQueries({ queryKey: ['api-keys'] })
                }
              />
            </div>
          </div>

          {/* Section: Audio Storage */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Audio Storage</h2>
            <BunnySettingsCard
              status={bunnyStatus}
              onUpdate={() =>
                queryClient.invalidateQueries({ queryKey: ['bunny-status'] })
              }
            />
          </div>
        </>
      )}
    </div>
  )
}

interface ApiKeyCardProps {
  provider: 'fal' | 'minimax'
  title: string
  description: string
  status?: ApiKeyStatus
  getKeyLink: string
  onUpdate: () => void
}

function ApiKeyCard({
  provider,
  title,
  description,
  status,
  getKeyLink,
  onUpdate,
}: ApiKeyCardProps) {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Save mutation using dynamic import
  const saveMutation = useMutation({
    mutationFn: async (key: string) => {
      const { saveApiKeyFn } = await import('@/server/byok.fn')
      return saveApiKeyFn({ data: { provider, apiKey: key } })
    },
    onSuccess: () => {
      toast.success('API key saved successfully')
      setApiKey('')
      setIsEditing(false)
      onUpdate()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save API key')
    },
  })

  // Delete mutation using dynamic import
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { deleteApiKeyFn } = await import('@/server/byok.fn')
      return deleteApiKeyFn({ data: { provider } })
    },
    onSuccess: () => {
      toast.success('API key deleted')
      onUpdate()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete API key')
    },
  })

  const handleSave = () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key')
      return
    }
    saveMutation.mutate(apiKey.trim())
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this API key?')) {
      deleteMutation.mutate()
    }
  }

  const isPending = saveMutation.isPending || deleteMutation.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {status?.hasKey && !isEditing ? (
          // Key exists - show status
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-10 flex-1 items-center rounded-md border bg-muted px-3">
                <span className="font-mono text-sm text-muted-foreground">
                  {status.lastFour}
                </span>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsEditing(true)}
                disabled={isPending}
              >
                <Key className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleDelete}
                disabled={isPending}
                className="text-destructive hover:bg-destructive/10"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
            {status.addedAt && (
              <p className="text-xs text-muted-foreground">
                Added {new Date(status.addedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : (
          // No key or editing - show form
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${provider}-key`}>API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id={`${provider}-key`}
                    type={showKey ? 'text' : 'password'}
                    placeholder="Enter your API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    disabled={isPending}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <a
                href={getKeyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                Get your API key
                <ExternalLink className="h-3 w-3" />
              </a>
              <div className="flex gap-2">
                {isEditing && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false)
                      setApiKey('')
                    }}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  onClick={handleSave}
                  disabled={isPending || !apiKey.trim()}
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Save Key
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Bunny.net Settings Card
// ============================================================================

interface BunnySettingsCardProps {
  status?: BunnyStatus
  onUpdate: () => void
}

function BunnySettingsCard({ status, onUpdate }: BunnySettingsCardProps) {
  const [apiKey, setApiKey] = useState('')
  const [storageZone, setStorageZone] = useState('')
  const [pullZone, setPullZone] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: {
      apiKey: string
      storageZone: string
      pullZone: string
    }) => {
      const { saveBunnySettingsFn } = await import('@/server/byok.fn')
      return saveBunnySettingsFn({ data })
    },
    onSuccess: () => {
      toast.success('Bunny.net settings saved')
      setApiKey('')
      setStorageZone('')
      setPullZone('')
      setIsEditing(false)
      onUpdate()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save settings')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { deleteBunnySettingsFn } = await import('@/server/byok.fn')
      return deleteBunnySettingsFn()
    },
    onSuccess: () => {
      toast.success('Bunny.net settings deleted')
      onUpdate()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete settings')
    },
  })

  const handleSave = () => {
    if (!apiKey.trim() || !storageZone.trim() || !pullZone.trim()) {
      toast.error('Please fill in all fields')
      return
    }
    saveMutation.mutate({
      apiKey: apiKey.trim(),
      storageZone: storageZone.trim(),
      pullZone: pullZone.trim(),
    })
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete your Bunny.net settings?')) {
      deleteMutation.mutate()
    }
  }

  const startEditing = () => {
    setIsEditing(true)
    setStorageZone(status?.storageZone || '')
    setPullZone(status?.pullZone || '')
  }

  const isPending = saveMutation.isPending || deleteMutation.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Bunny.net CDN
        </CardTitle>
        <CardDescription>
          Store your generated audio permanently on Bunny.net CDN
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status?.hasKey && !isEditing ? (
          // Settings exist - show status
          <div className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center justify-between p-3 rounded-md border bg-muted/50">
                <div>
                  <p className="text-sm font-medium">API Key</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {status.lastFour}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md border bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Storage Zone</p>
                  <p className="text-xs text-muted-foreground">
                    {status.storageZone}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md border bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Pull Zone</p>
                  <p className="text-xs text-muted-foreground">
                    {status.pullZone}.b-cdn.net
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              {status.addedAt && (
                <p className="text-xs text-muted-foreground">
                  Configured {new Date(status.addedAt).toLocaleDateString()}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={startEditing}
                  disabled={isPending}
                >
                  <Key className="mr-2 h-4 w-4" />
                  Update
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="text-destructive hover:bg-destructive/10"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // No settings or editing - show form
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bunny-key">Storage API Key</Label>
              <div className="relative">
                <Input
                  id="bunny-key"
                  type={showKey ? 'text' : 'password'}
                  placeholder="Enter your Bunny.net Storage API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isPending}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="storage-zone">Storage Zone Name</Label>
                <Input
                  id="storage-zone"
                  type="text"
                  placeholder="my-music-storage"
                  value={storageZone}
                  onChange={(e) => setStorageZone(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pull-zone">Pull Zone Name</Label>
                <Input
                  id="pull-zone"
                  type="text"
                  placeholder="my-music"
                  value={pullZone}
                  onChange={(e) => setPullZone(e.target.value)}
                  disabled={isPending}
                />
                <p className="text-xs text-muted-foreground">
                  Your CDN URL will be: {pullZone || 'my-music'}.b-cdn.net
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <a
                href="https://dash.bunny.net/storage"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                Bunny.net Dashboard
                <ExternalLink className="h-3 w-3" />
              </a>
              <div className="flex gap-2">
                {isEditing && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false)
                      setApiKey('')
                      setStorageZone('')
                      setPullZone('')
                    }}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  onClick={handleSave}
                  disabled={
                    isPending ||
                    !apiKey.trim() ||
                    !storageZone.trim() ||
                    !pullZone.trim()
                  }
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Create a Storage Zone and linked Pull Zone in your Bunny.net
              dashboard first. The Storage API key can be found in the Storage
              Zone settings under &quot;FTP &amp; API Access&quot;.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
