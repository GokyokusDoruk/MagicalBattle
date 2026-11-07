export interface StoryLine {
  /** Konuşan; "Anlatıcı" ya da karakter adı */
  speaker: string;
  text: string;
}

export interface StoryScene {
  id: string;
  /** Sahne resminin anahtarı (ui/storyArt.ts) */
  image: string;
  lines: StoryLine[];
}
