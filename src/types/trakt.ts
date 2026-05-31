// Types for Trakt API responses used by this project.

export interface TraktMovie {
  title: string;
  year?: number;
  ids?: Record<string, any>;
}

export interface TraktTrendingItem {
  watchers: number;
  movie: TraktMovie;
}
