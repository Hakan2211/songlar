'use client'

import { useState } from 'react'
import {
  ChevronDown,
  Cloud,
  CloudOff,
  Download,
  Heart,
  Loader2,
  Mic,
  MoreVertical,
  Music2,
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
  onConvertVoice?: (trackId: string, trackTitle: string) => void
  isTogglingFavorite?: boolean
  isDeleting?: boolean
  isRenaming?: boolean
  isUploading?: boolean
  hasBunnySettings?: boolean
  hasReplicateKey?: boolean
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
  onConvertVoice,
  isTogglingFavorite = false,
  isDeleting = false,
  isRenaming = false,
  isUploading = false,
  hasBunnySettings = false,
  hasReplicateKey = false,
}: TrackCardProps) {
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [newTitle, setNewTitle] = useState(track.title || '')
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

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
      <div className="group relative flex flex-col gap-2 p-3 rounded-xl border bg-card hover:shadow-[var(--shadow-md)] transition-all duration-300">
        {/* Header Row */}
        <div className="flex items-start gap-3">
          {/* Album Art Placeholder */}
          <div className="relative shrink-0 w-11 h-11 rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-transparent flex items-center justify-center overflow-hidden">
            <Music2 className="h-5 w-5 text-primary/40" />
            {/* Subtle shine effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10" />
          </div>

          {/* Track Info */}
          <div className="flex-1 min-w-0">
            <h3
              className="font-medium text-sm leading-tight truncate"
              title={displayTitle}
            >
              {displayTitle}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-[10px]">
                {getProviderDisplayName(track.provider)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(track.createdAt)}
              </span>
              {track.audioDurationMs && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDuration(track.audioDurationMs)}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {/* Favorite Toggle */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onToggleFavorite(track.id)}
              disabled={isTogglingFavorite}
              title={
                track.isFavorite ? 'Remove from favorites' : 'Add to favorites'
              }
              className="h-8 w-8"
            >
              {isTogglingFavorite ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Heart
                  className={cn(
                    'h-4 w-4 transition-all duration-200',
                    track.isFavorite
                      ? 'fill-red-500 text-red-500 scale-110'
                      : 'text-muted-foreground hover:text-red-500 hover:scale-110',
                  )}
                />
              )}
            </Button>

            {/* Cloud Status */}
            <div
              className={cn(
                'h-8 w-8 flex items-center justify-center rounded-lg',
                track.audioStored
                  ? 'text-emerald-500'
                  : 'text-muted-foreground/50',
              )}
              title={track.audioStored ? 'Stored on CDN' : 'Temporary storage'}
            >
              {track.audioStored ? (
                <Cloud className="h-4 w-4" />
              ) : (
                <CloudOff className="h-4 w-4" />
              )}
            </div>

            {/* More Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
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
              <DropdownMenuContent align="end" className="w-44">
                {isCompleted && (
                  <DropdownMenuItem onClick={handleDownload}>
                    <Download className="h-4 w-4" />
                    Download
                  </DropdownMenuItem>
                )}
                {isCompleted && hasReplicateKey && onConvertVoice && (
                  <DropdownMenuItem
                    onClick={() => onConvertVoice(track.id, displayTitle)}
                  >
                    <Mic className="h-4 w-4" />
                    Convert Voice
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

          {/* Always visible favorite indicator when favorited */}
          {track.isFavorite && (
            <div className="absolute top-3 right-3 opacity-100 group-hover:opacity-0 transition-opacity">
              <Heart className="h-4 w-4 fill-red-500 text-red-500" />
            </div>
          )}
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

        {/* Details Toggle & Content */}
        {isCompleted && (track.prompt || track.lyrics) && (
          <>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
            >
              <ChevronDown
                className={cn(
                  'h-3 w-3 transition-transform duration-200',
                  showDetails && 'rotate-180',
                )}
              />
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
            {showDetails && (
              <div className="space-y-2 text-xs border-t pt-2">
                {track.prompt && (
                  <div>
                    <span className="font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
                      Style
                    </span>
                    <p className="mt-0.5 text-foreground/80 leading-relaxed">
                      {track.prompt}
                    </p>
                  </div>
                )}
                {track.lyrics && (
                  <div>
                    <span className="font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
                      Lyrics
                    </span>
                    <p className="mt-0.5 text-foreground/80 whitespace-pre-line leading-relaxed max-h-40 overflow-y-auto">
                      {track.lyrics}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Status for non-completed tracks */}
        {!isCompleted && (
          <div className="flex items-center gap-3 py-2">
            {track.status === 'failed' ? (
              <span className="text-sm text-destructive">
                Generation failed
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative h-1 flex-1 min-w-[100px] bg-muted rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-primary/50 rounded-full animate-pulse w-1/3" />
                </div>
                <span className="text-xs text-muted-foreground">
                  {track.status === 'pending' ? 'Queued' : 'Generating'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Track</DialogTitle>
            <DialogDescription>
              Enter a new name for this track.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="track-title" className="sr-only">
              Title
            </Label>
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

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Track</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{displayTitle}&quot;? This
              action cannot be undone.
              {track.audioStored && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  This will also delete the audio file from CDN.
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

// Premium skeleton with refined animation
export function TrackCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border bg-card">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-11 h-11 rounded-lg bg-muted animate-pulse" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="h-3.5 bg-muted rounded w-3/4 animate-pulse" />
          <div className="h-3 bg-muted rounded w-1/3 animate-pulse" />
        </div>
        <div className="flex items-center gap-1">
          <div className="h-7 w-7 bg-muted rounded-lg animate-pulse" />
          <div className="h-7 w-7 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="h-10 bg-muted/50 rounded-lg animate-pulse" />
    </div>
  )
}
