export function extractPoster(item: any): string | undefined {
  if (!item) return undefined;
  const movie = item.movie ?? item;
  const show = item.show ?? item;
  const images = movie?.images ?? show?.images ?? item.images;
  if (!images) return undefined;
  // poster can be string, array, or object with full/thumb
  if (typeof images.poster === 'string') return images.poster as string;
  if (Array.isArray(images.poster) && images.poster.length) return images.poster[0];
  if (typeof images.poster === 'object') return (images.poster as any).full || (images.poster as any).thumb;
  // fallback to any available image properties
  if (images.thumb) return images.thumb;
  if (images.full) return images.full;
  return undefined;
}
