import { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { imageSrc } from '@/utils/imageSrc';
import { cn } from '@/utils/cn';

export function CoverImage({
  src,
  alt,
  className,
  blur = false,
  loading = 'lazy',
  decoding = 'async',
}: {
  src?: string | null;
  alt: string;
  className?: string;
  blur?: boolean;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
}) {
  const resolved = imageSrc(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [resolved]);

  const shouldRenderImage = resolved && failedSrc !== resolved;

  return (
    <div className={cn('relative overflow-hidden bg-[linear-gradient(135deg,rgb(var(--panel-strong-rgb)),rgb(var(--accent-strong-rgb))_62%,#1b2230)] shadow-inner', className)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_22%,rgba(255,255,255,0.18),transparent_30%),linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.30))]" />
      {shouldRenderImage ? (
        <img alt={alt} className={cn('relative h-full w-full object-cover', blur && 'blur-md scale-105')} decoding={decoding} loading={loading} src={resolved} onError={() => setFailedSrc(resolved)} />
      ) : (
        <div className="relative flex h-full w-full items-center justify-center text-white/45"><ImageIcon className="h-8 w-8" /></div>
      )}
    </div>
  );
}
