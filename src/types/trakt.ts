// Types for Trakt API responses used by this project.

export interface TraktIds {
  trakt?: number;
  slug?: string;
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
}

export interface TraktImageSize {
  full?: string;
  thumb?: string;
  medium?: string;
}

export interface TraktImages {
  poster?: TraktImageSize;
  fanart?: TraktImageSize;
  banner?: TraktImageSize;
}

export interface TraktMovieBase {
  title: string;
  name?: string;
  year?: number;
  release_date?: string;
  ids?: TraktIds;
  overview?: string;
  rating?: number;
  votes?: number;
  genres?: string[];
  runtime?: number;
  images?: TraktImages;
}

export interface TraktShowBase {
  title: string;
  name?: string;
  year?: number;
  first_aired?: string;
  release_date?: string;
  ids?: TraktIds;
  overview?: string;
  rating?: number;
  votes?: number;
  genres?: string[];
  images?: TraktImages;
}

export interface TraktTrendingItem {
  watchers: number;
  movie: TraktMovieBase;
}

export interface TraktPerson {
  name: string;
  ids?: TraktIds;
}

export interface TraktCastEntry {
  character?: string;
  person?: TraktPerson;
}

export interface TraktPeopleResponse {
  cast?: TraktCastEntry[];
}

export interface TraktSearchItem {
  type: 'movie' | 'show' | 'episode' | 'person';
  score?: number;
  movie?: TraktMovieBase;
  show?: TraktShowBase;
}

export interface TraktSearchResponse {
  result: TraktSearchItem[];
}
