import type {
  TraktCastEntry,
  TraktIds,
  TraktImageSize,
  TraktMovieBase,
  TraktSearchItem,
  TraktShowBase,
} from '../types/trakt';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function truncate(text: string, maxLength: number): string {
  const cleaned = text?.trim() ?? '';
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

export function formatRating(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'N/A';
  }
  return value.toFixed(1);
}

export function formatGenres(genres?: string[]): string {
  if (!genres || genres.length === 0) {
    return 'N/A';
  }
  return genres.filter(Boolean).slice(0, 6).join(' • ') || 'N/A';
}

export function formatInlineGenres(genres?: string[]): string {
  if (!genres || genres.length === 0) {
    return 'N/A';
  }
  return genres.filter(Boolean).slice(0, 3).join(' • ') || 'N/A';
}

export function formatYear(year?: number | string): string {
  if (!year) {
    return 'TBD';
  }
  return String(year);
}

export function formatTraktUrl(type: 'movie' | 'show', ids: Record<string, unknown> | TraktIds): string {
  const slug = ids?.slug;
  if (typeof slug === 'string' && slug.length > 0) {
    return `https://trakt.tv/${type}s/${slug}`;
  }
  if (typeof ids?.imdb === 'string') {
    return `https://trakt.tv/search?query=${encodeURIComponent(ids.imdb)}`;
  }
  return 'https://trakt.tv';
}

function normalizeTraktImageUrl(value?: TraktImageSize): string | undefined {
  if (!value) {
    return undefined;
  }

  let url: string | undefined;
  if (Array.isArray(value)) {
    url = value[0];
  } else if (typeof value === 'string') {
    url = value;
  } else {
    url = value.full ?? value.medium ?? value.thumb;
  }

  if (!url) {
    return undefined;
  }

  if (!/^https?:\/\//i.test(url)) {
    return `https://${url.replace(/^\/\//, '')}`;
  }

  return url;
}

export function getPosterUrlFromItem(item: TraktSearchItem): string | undefined {
  const meta = item.movie ?? item.show;
  return (
    normalizeTraktImageUrl(meta?.images?.poster) ||
    normalizeTraktImageUrl(meta?.images?.fanart) ||
    normalizeTraktImageUrl(meta?.images?.thumb)
  );
}

export function getItemYear(
  meta: TraktSearchItem | TraktMovieBase | TraktShowBase | undefined
) {
  if (!meta) {
    return undefined;
  }

  let source: TraktMovieBase | TraktShowBase | undefined;
  if ('movie' in meta || 'show' in meta) {
    source = meta.movie ?? meta.show;
  } else {
    source = meta as TraktMovieBase | TraktShowBase;
  }

  if (!source) {
    return undefined;
  }

  if ('first_aired' in source && source.first_aired) {
    return source.first_aired.slice(0, 4);
  }
  if ('release_date' in source && source.release_date) {
    return source.release_date.slice(0, 4);
  }
  return source.year ?? undefined;
}

function buildCastHtml(cast: TraktCastEntry[]): string[] {
  return cast
    .filter((entry) => Boolean(entry.person?.name))
    .slice(0, 6)
    .map((entry) => {
      const name = escapeHtml(entry.person?.name ?? 'Unknown');
      const slug = entry.person?.ids?.slug;
      if (slug) {
        return `<a href="https://trakt.tv/people/${encodeURIComponent(slug)}">${name}</a>`;
      }
      return name;
    });
}

export function buildTraktReplyMarkup(
  type: 'movie' | 'show',
  ids?: TraktIds
): { inline_keyboard: Array<Array<{ text: string; url: string }>> } {
  return {
    inline_keyboard: [[{ text: '🎬 Open on Trakt', url: formatTraktUrl(type, ids ?? {}) }]],
  };
}

export function buildMessageCaption(item: TraktSearchItem, cast: TraktCastEntry[]): string {
  const meta = item.movie ?? item.show;
  const title = escapeHtml(meta?.title ?? meta?.name ?? 'Unknown title');
  const year = formatYear(getItemYear(meta));
  const rating = formatRating(meta?.rating as number | undefined);
  const genres = formatGenres(meta?.genres ?? []);
  const overview = escapeHtml(meta?.overview ?? 'No overview available.');
  const castHtml = buildCastHtml(cast);
  const castLines =
    castHtml.length > 0
      ? castHtml.map((actor) => `• ${actor}`)
      : ['• No cast available'];

  return [
    `<b>${title} (${year})</b>`,
    ``,
    `⭐ IMDb ${rating}`,
    ``,
    `🎭 ${genres}`,
    ``,
    `🎬 Cast`,
    ...castLines,
    ``,
    `📝 <tg-spoiler>${overview}</tg-spoiler>`,
  ].join('\n');
}

export function buildInlineResultTitle(item: TraktSearchItem): string {
  const meta = item.movie ?? item.show;
  const title = meta?.title ?? meta?.name ?? 'Unknown';
  const year = formatYear(getItemYear(item));
  return truncate(`${title} (${year})`, 64);
}

export function buildInlineResultDescription(item: TraktSearchItem): string {
  const meta = item.movie ?? item.show;
  const rating = formatRating(meta?.rating as number | undefined);
  const genres = formatInlineGenres(meta?.genres);
  return truncate(`⭐ IMDb ${rating} 🎭 ${genres}`, 255);
}

export function buildEmptyInlineResponse(query: string) {
  return `No Trakt matches found for "${escapeHtml(query)}". Try another movie or show title.`;
}
