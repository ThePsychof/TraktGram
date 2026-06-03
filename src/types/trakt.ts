// Types for Trakt API responses used by this project.

export interface TraktIds {
  trakt?: number;
  slug?: string;
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
}

export type TraktImageSize = string | string[] | {
  full?: string;
  thumb?: string;
  medium?: string;
};

export interface TraktImages {
  poster?: TraktImageSize;
  fanart?: TraktImageSize;
  banner?: TraktImageSize;
  thumb?: TraktImageSize;
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

export interface TraktProgressEpisode {
  season?: number;
  number?: number;
  title?: string;
  ids?: TraktIds;
  completed?: boolean;
  last_watched_at?: string;
  plays?: number;
  rating?: number;
  overview?: string;
}

export interface TraktProgressSeason {
  number?: number;
  aired?: number;
  completed?: number;
  episodes?: TraktProgressEpisode[];
}

export interface TraktShowProgress {
  aired?: number;
  completed?: number;
  aired_episodes?: number;
  completed_episodes?: number;
  last_watched_at?: string;
  next_episode?: TraktProgressEpisode;
  last_episode?: TraktProgressEpisode;
  seasons?: TraktProgressSeason[];
  hidden_seasons?: number[];
}

export interface TraktEpisodeBase {
  title?: string;
  season?: number;
  number?: number;
  ids?: TraktIds;
  overview?: string;
  rating?: number;
  votes?: number;
  runtime?: number;
  first_aired?: string;
  images?: TraktImages;
  show?: TraktShowBase;
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
