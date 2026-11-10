export interface Meal {
  id: string; date: string; time: string; meal: string; name: string;
  kcal: number; protein: number; carbs: number; fats: number; fiber: number;
  deleted: boolean; updatedAt: number;
}
export interface DailyLog {
  id: string; date: string; steps: number; strengthMin: number;
  nutritionDone: boolean; stepsDone: boolean; trainingDone: boolean;
  notes: string; updatedAt: number;
}
export interface WorkoutItem { id: string; date: string; exercise: string; group: string; done: boolean; updatedAt: number }
export interface Weight { id: string; date: string; kg: number; deleted: boolean; updatedAt: number }
export interface DaySplit { title: string; exercises: string[]; training: boolean }
export interface Settings {
  startWeight: number; challengeStart: string; challengeEnd: string;
  kcalMin: number; kcalMax: number; protein: number; fats: number; carbs: number; fiber: number;
  steps: number; strengthMin: number;
  split: Record<string, DaySplit>;
  updatedAt: number;
}
export type Table = 'meals' | 'logs' | 'workouts' | 'weights';
export interface State {
  v: 1;
  settings: Settings;
  meals: Record<string, Meal>;
  logs: Record<string, DailyLog>;
  workouts: Record<string, WorkoutItem>;
  weights: Record<string, Weight>;
  dirty: Record<Table, string[]> & { settings: boolean };
  sync: { spreadsheetId?: string; lastSync?: number; email?: string };
}
export interface Prefs { clientId: string; sheetId: string; allowedEmail: string; playIntro: boolean; autoSync: boolean }
