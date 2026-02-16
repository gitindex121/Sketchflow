
export interface Scene {
  id: string;
  order: number;
  description: string;
  dialogue: string;
  storyboardImageUrl?: string;
  storyboardPrompt?: string;
  videoUrl?: string;
  audioUrl?: string;
  isApproved: boolean;
}

export type ImageSize = '1K' | '2K' | '4K';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface Project {
  title: string;
  script: string;
  scenes: Scene[];
}
