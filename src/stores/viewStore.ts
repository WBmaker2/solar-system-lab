export type ViewMode = 'space' | 'earth' | 'moon' | 'observer';
export type ScaleMode = 'classroom' | 'realistic';

type Listener = (s: ViewState) => void;

export interface ViewState {
  mode: ViewMode;
  scale: ScaleMode;
  showOrbits: boolean;
  showLabels: boolean;
  followEarth: boolean;
  selectedId: string | null;
}

export class ViewStore {
  private state: ViewState = {
    mode: 'space',
    scale: 'classroom',
    showOrbits: true,
    showLabels: true,
    followEarth: false,
    selectedId: 'earth',
  };
  private listeners = new Set<Listener>();

  get(): ViewState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.state);
  }

  patch(p: Partial<ViewState>): void {
    this.state = { ...this.state, ...p };
    this.emit();
  }
}
