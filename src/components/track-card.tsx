'use client'

import { useState } from 'react'
import {
  Cloud,
  CloudOff,
  Download,
  Heart,
  Loader2,
  MoreVertical,
  Music,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LazyWaveformPlayer } from '@/components/waveform-player'
import { cn } from '@/lib/utils'

export interface Track {
  id: string
  title: string | null
  provider: string
  prompt: string
  lyrics?: string | null
  status: string
  audioUrl: string | null
  audioStored: boolean
  isFavorite: boolean
  createdAt: string | Date
  audioDurationMs?: number | null
}

interface TrackCardProps {
  track: Track
  onToggleFavorite: (trackId: string) => void
  onDelete: (trackId: string) => void
  onRename: (trackId: string, newTitle: string) => void
  onUploadToCdn: (trackId: string) => void
  onDownload: (track: Track) => void
  isTogglingFavorite?: boolean
  isDeleting?: boolean
  isRenaming?: boolean
  isUploading?: boolean
  hasBunnySettings?: boolean
}

function getProviderDisplayName(provider: string): string {
  switch (provider) {
    case 'elevenlabs':
      return 'ElevenLabs'
    case 'minimax-v2':
      return 'MiniMax v2'
    case 'minimax-v2.5':
      return 'MiniMax v2.5'
    default:
      return provider
  }
}

function getProviderBadgeVariant(
  provider: string,
): 'default' | 'secondary' | 'outline' {
  switch (provider) {
    case 'elevenlabs':
      return 'default'
    case 'minimax-v2':
      return 'secondary'
    case 'minimax-v2.5':
      return 'outline'
    default:
      return 'secondary'
  }
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return ''
  const seconds = Math.floor(ms / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDate(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function TrackCard({
  track,
  onToggleFavorite,
  onDelete,
  onRename,
  onUploadToCdn,
  onDownload,
  isTogglingFavorite = false,
  isDeleting = false,
  isRenaming = false,
  isUploading = false,
  hasBunnySettings = false,
}: TrackCardProps) {
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [newTitle, setNewTitle] = useState(track.title || '')
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const displayTitle =
    track.title || track.prompt.slice(0, 50) || 'Untitled Track'
  const isCompleted = track.status === 'completed' && track.audioUrl

  const handleRename = () => {
    if (newTitle.trim() && newTitle.trim() !== track.title) {
      onRename(track.id, newTitle.trim())
    }
    setIsRenameDialogOpen(false)
  }

  const handleDelete = () => {
    onDelete(track.id)
    setIsDeleteDialogOpen(false)
  }

  const handleDownload = () => {
    if (track.audioUrl) {
      onDownload(track)
    }
  }

  return (
    <>
      <div className="group flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
        {/* Music Icon / Album Art Placeholder */}
        <div className="flex-shrink-0 w-12 h-12 rounded-md bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <Music className="h-6 w-6 text-primary/60" />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header Row: Title, Provider, Date, Actions */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {/* Title */}
              <h3 className="font-medium text-sm truncate" title={displayTitle}>
                {displayTitle}
              </h3>
              {/* Provider Badge + Date */}
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant={getProviderBadgeVariant(track.provider)}
                  className="text-[10px] px-1.5 py-0"
                >
                  {getProviderDisplayName(track.provider)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(track.createdAt)}
                </span>
                {track.audioDurationMs && (
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(track.audioDurationMs)}
                  </span>
                )}
              </div>
            </div>

            {/* Action Icons */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Favorite Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onToggleFavorite(track.id)}
                disabled={isTogglingFavorite}
                title={
                  track.isFavorite
                    ? 'Remove from favorites'
                    : 'Add to favorites'
                }
              >
                {isTogglingFavorite ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Heart
                    className={cn(
                      'h-4 w-4 transition-colors',
                      track.isFavorite
                        ? 'fill-red-500 text-red-500'
                        : 'text-muted-foreground hover:text-red-500',
                    )}
                  />
                )}
              </Button>

              {/* Cloud Status */}
              <div
                className={cn(
                  'h-8 w-8 flex items-center justify-center',
                  track.audioStored
                    ? 'text-green-500'
                    : 'text-muted-foreground',
                )}
                title={
                  track.audioStored
                    ? 'Stored on CDN'
                    : 'Temporary storage (may expire)'
                }
              >
                {track.audioStored ? (
                  <Cloud className="h-4 w-4" />
                ) : (
                  <CloudOff className="h-4 w-4" />
                )}
              </div>

              {/* More Actions Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={isDeleting || isRenaming || isUploading}
                  >
                    {isDeleting || isRenaming || isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreVertical className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isCompleted && (
                    <DropdownMenuItem onClick={handleDownload}>
                      <Download className="h-4 w-4" />
                      Download
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => {
                      setNewTitle(track.title || '')
                      setIsRenameDialogOpen(true)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                  {isCompleted && !track.audioStored && hasBunnySettings && (
                    <DropdownMenuItem onClick={() => onUploadToCdn(track.id)}>
                      <Upload className="h-4 w-4" />
                      Upload to CDN
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Waveform Player */}
          {isCompleted && (
            <LazyWaveformPlayer
              src={track.audioUrl!}
              height={40}
              compact
              threshold={0.1}
            />
          )}

          {/* Show status for non-completed tracks */}
          {!isCompleted && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {track.status === 'failed' ? (
                <span className="text-destructive">Generation failed</span>
              ) : (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {track.status === 'pending' ? 'Queued...' : 'Generating...'}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Track</DialogTitle>
            <DialogDescription>
              Enter a new name for this track.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="track-title">Title</Label>
              <Input
                id="track-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter track title"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRename()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRenameDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!newTitle.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Track</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{displayTitle}&quot;? This
              action cannot be undone.
              {track.audioStored && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  This will also delete the audio file from your CDN storage.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Skeleton component for loading states
export function TrackCardSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card animate-pulse">
      <div className="flex-shrink-0 w-12 h-12 rounded-md bg-muted" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5 flex-1">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/3" />
          </div>
          <div className="flex items-center gap-1">
            <div className="h-8 w-8 bg-muted rounded" />
            <div className="h-8 w-8 bg-muted rounded" />
            <div className="h-8 w-8 bg-muted rounded" />
          </div>
        </div>
        <div className="h-10 bg-muted rounded" />
      </div>
    </div>
  )
}
