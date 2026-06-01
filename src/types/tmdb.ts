export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbCastMember {
  name: string;
  character?: string;
  order?: number;
}

export interface TmdbCrewMember {
  job?: string;
  name: string;
}

export interface TmdbCredits {
  cast: TmdbCastMember[];
  crew?: TmdbCrewMember[];
}

export interface TmdbDetails {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  homepage?: string | null;
  genres?: TmdbGenre[];
  credits?: TmdbCredits;
}
