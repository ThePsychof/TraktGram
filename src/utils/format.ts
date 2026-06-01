import type { TmdbDetails } from '../types/tmdb';
import type { TraktIds, TraktMovieBase, TraktSearchItem, TraktShowBase } from '../types/trakt';

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
  return `${value.toFixed(1)}/10`;
}

export function formatGenres(genres?: string[] | { name?: string }[]): string {
  if (!genres || genres.length === 0) {
    return 'N/A';
  }
  const genreNames = genres.map((genre) => (typeof genre === 'string' ? genre : genre.name)).filter(Boolean);
  return genreNames.slice(0, 5).join(', ') || 'N/A';
}

export function formatYear(year?: number | string): string {
  if (!year) {
    return 'TBD';
  }
  return String(year);
}

export function formatCast(credits?: TmdbDetails['credits']): string {
  if (!credits?.cast || credits.cast.length === 0) {
    return 'N/A';
  }
  return credits.cast
    .slice(0, 5)
    .map((member) => member.name)
    .join(', ');
}

export function formatDirector(credits?: TmdbDetails['credits']): string | undefined {
  if (!credits?.crew || credits.crew.length === 0) {
    return undefined;
  }
  const director = credits.crew.find((member) => member.job === 'Director');
  return director?.name;
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

function getItemYear(meta: TraktMovieBase | TraktShowBase | undefined) {
  if (!meta) {
    return undefined;
  }

  if ('first_aired' in meta && meta.first_aired) {
    return meta.first_aired.slice(0, 4);
  }
  if (meta.release_date) {
    return meta.release_date.slice(0, 4);
  }
  return meta.year ?? undefined;
}

export function buildSummaryText(item: TraktSearchItem, tmdb?: TmdbDetails) {
  const meta = item.movie ?? item.show;
  const title = escapeHtml(meta?.title ?? meta?.name ?? 'Unknown title');
  const year = formatYear(getItemYear(meta));
  const itemType = item.type === 'movie' ? 'Movie' : 'Show';
  const rating = formatRating(meta?.rating as number | undefined);
  const overview = escapeHtml(truncate(meta?.overview ?? 'No description available.', 120));
  return `${title} · ${year} · ${itemType} · ⭐ ${rating}
${overview}`;
}

export function buildMessageCaption(
  item: TraktSearchItem,
  tmdb?: TmdbDetails
): string {
  const meta = item.movie ?? item.show;
  const title = escapeHtml(meta?.title ?? meta?.name ?? 'Unknown title');
  const year = formatYear(getItemYear(meta));
  const itemType = item.type === 'movie' ? 'Movie' : 'Show';
  const rating = formatRating(meta?.rating as number | undefined);
  const genres = formatGenres(meta?.genres ?? tmdb?.genres ?? []);
  const overview = escapeHtml(truncate(meta?.overview ?? 'No summary available.', 360));
  const director = formatDirector(tmdb?.credits);
  const cast = formatCast(tmdb?.credits);
  const resultType = item.type === 'movie' || item.type === 'show' ? item.type : 'movie';
  const traktUrl = formatTraktUrl(resultType, meta?.ids ?? {});
  const votes = typeof meta?.votes === 'number' ? ` (${meta.votes.toLocaleString()} votes)` : '';

  const lines = [
    `<b>🎬 ${title}</b> <i>(${year})</i>`,
    `<b>Type:</b> ${itemType}`,
    `<b>Rating:</b> ${rating}${votes}`,
    `<b>Genres:</b> ${escapeHtml(genres)}`,
  ];

  if (director) {
    lines.push(`<b>Director:</b> ${escapeHtml(director)}`);
  }

  if (cast !== 'N/A') {
    lines.push(`<b>Cast:</b> ${escapeHtml(cast)}`);
  }

  lines.push(`<b>Overview:</b> ${overview}`);
  lines.push(`<b>Trakt:</b> <a href="${escapeHtml(traktUrl)}">Open on Trakt</a>`);
  lines.push(`<i>Powered by TraktGram</i>`);

  return lines.join('\n');
}

export function buildResultDescription(item: TraktSearchItem): string {
  const meta = item.movie ?? item.show;
  const title = escapeHtml(meta?.title ?? meta?.name ?? 'Unknown');
  const year = formatYear(getItemYear(meta));
  const rating = formatRating(meta?.rating as number | undefined);
  const typeLabel = item.type === 'movie' ? 'Movie' : 'Show';
  return `${title} · ${year} · ${typeLabel} · ⭐ ${rating}`;
}

export function buildEmptyInlineResponse(query: string) {
  return `No Trakt matches found for "${escapeHtml(query)}". Try another movie or show title.`;
}
